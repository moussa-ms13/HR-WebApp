// ============================================================
// EmployeeStatesService — CRUD with Geographic RBAC
// Handles leaves, special cases, and status tracking.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const LeaveBalanceService = require("./LeaveBalanceService");
const { ROLES } = require("../config/constants");
const {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
} = require("../utils/queryBuilder");
const CacheService = require("./CacheService");

class EmployeeStatesService {
  /**
   * Fetch all employee states with pagination and geographic RBAC.
   */
  static async getAll(requestingUser, page = 1, limit = 25, category = "", employeeId = null, search = "", directorate = "", province = "") {
    const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

    // Build where clause with geographic filter via Employee relation
    const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
    if (isForbidden) {
      return { data: [], meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0 } };
    }

    const employeeFilter = {
      Province: provinceFilter,
      ...(employeeId ? { Id: Number(employeeId) } : {}),
      ...(directorate ? { Directorate: directorate } : {}),
    };

    const whereClause = {
      Employee: employeeFilter,
      ...(category ? { RecordCategory: category } : {}),
    };

    // Search: tokenized multi-word search across employee name, state type, notes, etc.
    const tokenSearch = buildTokenizedSearch(search, (token) => [
      { Employee: { LastName: { contains: token } } },
      { Employee: { Name: { contains: token } } },
      { Employee: { NIN: { contains: token } } },
      { StateTypeOrReason: { contains: token } },
      { CurrentJobTitle: { contains: token } },
      { Notes: { contains: token } },
      { Employee: { JobTitle: { RankName: { contains: token } } } },
    ]);
    if (tokenSearch) {
      whereClause.AND = [...(whereClause.AND || []), ...tokenSearch.AND];
    }

    const countCacheKey = `state_count_${JSON.stringify({
      prov: provinceFilter,
      emp: employeeId || "",
      dir: directorate || "",
      cat: category || "",
      s: search || "",
    })}`;

    const cachedTotal = CacheService.get(countCacheKey);

    const statesPromise = prisma.employeeStates.findMany({
      where: whereClause,
      select: {
        Id: true,
        EmployeesId: true,
        RecordCategory: true,
        CurrentJobTitle: true,
        StateTypeOrReason: true,
        DaysCount: true,
        StartDate: true,
        EndDate: true,
        AddedDate: true,
        IsResumed: true,
        ActualReturnDate: true,
        RemainingBalanceAfter: true,
        Notes: true,
        DoctorName: true,
        CertificateDate: true,
        SecondDoctorName: true,
        SecondCertificateDate: true,
        Employee: {
          select: {
            Name: true,
            LastName: true,
            Province: true,
            Gender: true,
            DateOfBirth: true,
            Directorate: true,
            AssignedPosition: true,
            CorpsType: true,
            JobTitle: {
              select: {
                RankName: true,
                EmploymentCategory: true,
              }
            }
          }
        }
      },
      skip,
      take: safeLimit,
      orderBy: { Id: "desc" },
    });

    let total, states;
    if (cachedTotal !== undefined) {
      states = await statesPromise;
      total = cachedTotal;
    } else {
      const [totalCount, statesResult] = await Promise.all([
        prisma.employeeStates.count({ where: whereClause }),
        statesPromise,
      ]);
      total = totalCount;
      states = statesResult;
      CacheService.set(countCacheKey, total, 60);
    }

    return {
      data: states,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get a single state by ID with RBAC check.
   */
  static async getById(id, requestingUser) {
    const state = await prisma.employeeStates.findUnique({
      where: { Id: id },
      include: { Employee: true },
    });

    if (!state) throw ApiError.notFound(`EmployeeState ${id} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(state.Employee.Province)) {
        throw ApiError.forbidden("Geographic access denied for this state record.");
      }
    }

    return state;
  }

  /**
   * Create a new employee state (leave or special case).
   * Implements Annual Leave Engine and Balance Tracking.
   */
  static async create(data, requestingUser) {
    const employee = await prisma.employees.findFirst({
      where: { Id: Number(data.EmployeesId) },
      include: { JobTitle: true },
    });
    if (!employee) throw ApiError.notFound(`Employee ${data.EmployeesId} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(employee.Province)) {
        throw ApiError.forbidden(`Geographic access denied for province: ${employee.Province}`);
      }
    }

    const reqDays = parseInt(data.RequestedDays || data.DaysCount || 0, 10);
    let remainingBalanceAfter = null;
    let consumedBreakdown = null;
    let primaryLeaveYear = new Date(data.StartDate).getFullYear();
    let remainingBreakdown = [];

    const isAnnualLeave =
      (data.RecordCategory === "تسجيل عطلة" || !data.RecordCategory) &&
      data.StateTypeOrReason === "عطلة سنوية" &&
      reqDays > 0;

    if (isAnnualLeave) {
      if (!prisma.leaveBalance) {
        throw new Error("[EmployeeStatesService] prisma.leaveBalance is undefined. Prisma Client is out of sync. Run npx prisma generate.");
      }

      // ── FIFO cascading deduction (oldest debt first) ──────────
      const result = await LeaveBalanceService.consumeLeaveAcrossYears(
        Number(data.EmployeesId),
        reqDays,
        data.StartDate
      );
      consumedBreakdown = result.consumedBreakdown;
      remainingBreakdown = result.remainingBreakdown;
      primaryLeaveYear = result.primaryYear;

      // Scalar snapshot: total remaining across all years (for backwards compat)
      remainingBalanceAfter = remainingBreakdown.reduce((sum, r) => sum + r.days, 0);
    }

    let state;
    try {
      state = await prisma.employeeStates.create({
        data: {
          EmployeesId: Number(data.EmployeesId),
          RecordCategory: data.RecordCategory,
          CurrentJobTitle: data.CurrentJobTitle || employee.JobTitle?.RankName || "",
          StateTypeOrReason: data.StateTypeOrReason,
          DaysCount: reqDays,
          StartDate: new Date(data.StartDate),
          EndDate: new Date(data.EndDate),
          AddedDate: new Date(),
          UsersId: requestingUser.userName,
          IsResumed: false,
          RequestedDays: reqDays > 0 ? reqDays : null,
          IsResumedEarly: false,
          RemainingBalanceAfter: remainingBalanceAfter,
          Notes: data.Notes || null,
          DoctorName: (data.DoctorName !== undefined ? data.DoctorName : data.doctorName) ? String(data.DoctorName || data.doctorName).trim() : null,
          CertificateDate: (() => {
            const d = data.CertificateDate !== undefined ? data.CertificateDate : data.certificateDate;
            return d && !isNaN(new Date(d).getTime()) ? new Date(d) : null;
          })(),
          SecondDoctorName: (() => {
            const d = data.SecondDoctorName !== undefined ? data.SecondDoctorName : (data.secondDoctorName !== undefined ? data.secondDoctorName : data.doctorName2);
            return d ? String(d).trim() : null;
          })(),
          SecondCertificateDate: (() => {
            const d = data.SecondCertificateDate !== undefined ? data.SecondCertificateDate : (data.secondCertificateDate !== undefined ? data.secondCertificateDate : data.certificateDate2);
            return d && !isNaN(new Date(d).getTime()) ? new Date(d) : null;
          })(),
        },
      });
    } catch (err) {
      // Compensate: refund all deducted balances since the leave record failed
      if (reqDays > 0 && consumedBreakdown) {
        await LeaveBalanceService.rollbackConsumedBreakdown(consumedBreakdown);
      }
      throw err;
    }

    // Attach the rich breakdown so callers (API response / print) can use it
    state._remainingBreakdown = remainingBreakdown;
    state._consumedBreakdown = consumedBreakdown;

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة وضعية/إجازة موظف",
      description: `تمت إضافة ${data.RecordCategory}: '${data.StateTypeOrReason}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: data.EmployeesId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return state;
  }

  /**
   * Update an existing employee state.
   */
  static async update(id, data, requestingUser) {
    const existing = await this.getById(id, requestingUser);

    const state = await prisma.employeeStates.update({
      where: { Id: id },
      data: {
        RecordCategory: data.RecordCategory ?? existing.RecordCategory,
        CurrentJobTitle: data.CurrentJobTitle ?? existing.CurrentJobTitle,
        StateTypeOrReason: data.StateTypeOrReason ?? existing.StateTypeOrReason,
        DaysCount: data.DaysCount ?? existing.DaysCount,
        StartDate: data.StartDate ? new Date(data.StartDate) : existing.StartDate,
        EndDate: data.EndDate ? new Date(data.EndDate) : existing.EndDate,
        IsResumed: data.IsResumed !== undefined ? data.IsResumed : existing.IsResumed,
        ActualReturnDate: data.ActualReturnDate ? new Date(data.ActualReturnDate) : existing.ActualReturnDate,
        Notes: data.Notes !== undefined ? data.Notes : existing.Notes,
        DoctorName: (() => {
          const hasDoc = data.DoctorName !== undefined || data.doctorName !== undefined;
          if (!hasDoc) return existing.DoctorName;
          const val = data.DoctorName !== undefined ? data.DoctorName : data.doctorName;
          return val ? String(val).trim() : null;
        })(),
        CertificateDate: (() => {
          const hasDate = data.CertificateDate !== undefined || data.certificateDate !== undefined;
          if (!hasDate) return existing.CertificateDate;
          const val = data.CertificateDate !== undefined ? data.CertificateDate : data.certificateDate;
          return val && !isNaN(new Date(val).getTime()) ? new Date(val) : null;
        })(),
        SecondDoctorName: (() => {
          const hasSecondDoc = data.SecondDoctorName !== undefined || data.secondDoctorName !== undefined || data.doctorName2 !== undefined;
          if (!hasSecondDoc) return existing.SecondDoctorName;
          const val = data.SecondDoctorName !== undefined ? data.SecondDoctorName : (data.secondDoctorName !== undefined ? data.secondDoctorName : data.doctorName2);
          return val ? String(val).trim() : null;
        })(),
        SecondCertificateDate: (() => {
          const hasSecondDate = data.SecondCertificateDate !== undefined || data.secondCertificateDate !== undefined || data.certificateDate2 !== undefined;
          if (!hasSecondDate) return existing.SecondCertificateDate;
          const val = data.SecondCertificateDate !== undefined ? data.SecondCertificateDate : (data.secondCertificateDate !== undefined ? data.secondCertificateDate : data.certificateDate2);
          return val && !isNaN(new Date(val).getTime()) ? new Date(val) : null;
        })(),
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل وضعية/إجازة موظف",
      description: `تم تعديل وضعية '${state.StateTypeOrReason}' للموظف (رقم: ${state.EmployeesId}) بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: state.EmployeesId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return state;
  }

  /**
   * Delete an employee state.
   */
  static async delete(id, requestingUser) {
    const existing = await this.getById(id, requestingUser); // RBAC checked inside

    await prisma.employeeStates.delete({ where: { Id: id } });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف وضعية/إجازة موظف",
      description: `تم حذف وضعية '${existing.StateTypeOrReason}' للموظف '${existing.Employee.LastName} ${existing.Employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: existing.EmployeesId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return { message: "State deleted successfully." };
  }

  /**
   * Resume a leave early — Reverse-FIFO balance refund engine.
   * Marks the leave as resumed, calculates actual consumed days,
   * refunds unused days to LeaveBalance (Reverse-FIFO: newest year first),
   * records the breakdown, and updates EmployeeStates inside a prisma transaction.
   *
   * @param {number} id - EmployeeStates ID
   * @param {Object} data - { actualReturnDate, notes }
   * @param {Object} requestingUser
   * @returns {Promise<{ data: Object, breakdown: Array }>}
   */
  static async resumeLeaveEarly(id, data, requestingUser) {
    const existing = await this.getById(id, requestingUser);

    if (existing.IsResumed) {
      throw ApiError.badRequest(`سجل العطلة رقم ${id} تم استئنافه مسبقاً.`);
    }

    const returnDateVal = data.actualReturnDate || data.ActualReturnDate;
    if (!returnDateVal) {
      throw ApiError.badRequest("يرجى تحديد تاريخ استئناف العمل الفعلي.");
    }

    const actualReturn = new Date(returnDateVal);
    if (isNaN(actualReturn.getTime())) {
      throw ApiError.badRequest("تاريخ استئناف العمل الفعلي غير صالح.");
    }

    const startDate = new Date(existing.StartDate);
    if (isNaN(startDate.getTime())) {
      throw ApiError.badRequest("تاريخ بداية العطلة المسجل غير صالح.");
    }

    // Normalized calendar comparison (UTC midnight) to prevent timezone drift
    const actualUtc = Date.UTC(actualReturn.getFullYear(), actualReturn.getMonth(), actualReturn.getDate());
    const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    if (actualUtc < startUtc) {
      throw ApiError.badRequest("تاريخ استئناف العمل الفعلي لا يمكن أن يكون قبل تاريخ بداية العطلة.");
    }

    // Calculate consumed days and refund days
    const diffDays = Math.round((actualUtc - startUtc) / (1000 * 60 * 60 * 24));
    const newDaysCount = Math.max(1, diffDays);
    const originalDays = existing.DaysCount || existing.RequestedDays || 0;
    const refundDaysNeeded = Math.max(0, originalDays - newDaysCount);
    const isEarly = refundDaysNeeded > 0;

    const isAnnualLeave = existing.StateTypeOrReason === "عطلة سنوية";

    const transactionResult = await prisma.$transaction(
      async (tx) => {
        let breakdown = [];
        let totalRefunded = 0;

        if (isAnnualLeave && refundDaysNeeded > 0) {
          // Reverse-FIFO: order by Year DESC (newest year first)
          const balances = await tx.leaveBalance.findMany({
            where: { EmployeeId: existing.EmployeesId },
            orderBy: { Year: "desc" },
          });

          let remainingToRefund = refundDaysNeeded;

          for (const balance of balances) {
            if (remainingToRefund <= 0) break;

            // Headroom is how much can be refunded back (equal to consumed days)
            const headroom = balance.TotalDays - balance.RemainingDays;
            if (headroom > 0) {
              const take = Math.min(remainingToRefund, headroom);

              await tx.leaveBalance.update({
                where: { Id: balance.Id },
                data: {
                  ConsumedDays: balance.ConsumedDays - take,
                  RemainingDays: balance.RemainingDays + take,
                },
              });

              breakdown.push({ year: balance.Year, refunded: take });
              remainingToRefund -= take;
              totalRefunded += take;
            }
          }
        }

        const inputNotes = (data.notes || data.Notes || "").trim();
        let updatedNotes = existing.Notes;
        if (inputNotes) {
          updatedNotes = existing.Notes ? `${existing.Notes} | ${inputNotes}` : inputNotes;
        }

        const updatedState = await tx.employeeStates.update({
          where: { Id: id },
          data: {
            IsResumed: true,
            IsResumedEarly: isEarly,
            ActualReturnDate: actualReturn,
            DaysCount: isEarly ? newDaysCount : existing.DaysCount,
            RequestedDays: existing.RequestedDays || existing.DaysCount,
            RefundedDays: totalRefunded,
            RefundedBreakdown: breakdown.length > 0 ? JSON.stringify(breakdown) : null,
            Notes: updatedNotes,
          },
          include: {
            Employee: {
              select: {
                Id: true,
                Name: true,
                LastName: true,
                Province: true,
              },
            },
          },
        });

        return { updatedState, breakdown };
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName || requestingUser.userName || "System",
      title: "استئناف إجازة مبكراً",
      description: `تم استئناف إجازة '${existing.StateTypeOrReason}' للموظف (رقم: ${existing.EmployeesId}) واسترجاع ${transactionResult.updatedState.RefundedDays || 0} يوم بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id || 1,
      employeesId: existing.EmployeesId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return {
      data: transactionResult.updatedState,
      breakdown: transactionResult.breakdown,
    };
  }
}

module.exports = EmployeeStatesService;

