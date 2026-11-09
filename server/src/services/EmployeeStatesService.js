// ============================================================
// EmployeeStatesService — CRUD with Geographic RBAC
// Handles leaves, special cases, and status tracking.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const LeaveBalanceService = require("./LeaveBalanceService");
const { ROLES, getAllowedProvinces } = require("../config/constants");
const {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
} = require("../utils/queryBuilder");
const CacheService = require("./CacheService");

/**
 * Builds Prisma where condition for leave lifecycle filtering.
 * Active: not resumed AND EndDate >= today (start of day)
 * Resumed: manually resumed (IsResumed: true) OR EndDate < today (start of day)
 * All: no lifecycle filter
 */
function getLeaveLifecycleCondition(statusFilter) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeCondition = {
    IsResumed: false,
    EndDate: { gte: today },
  };

  const resumedCondition = {
    OR: [
      { IsResumed: true },
      { EndDate: { lt: today } },
    ],
  };

  switch (statusFilter) {
    case "active":
      return activeCondition;
    case "resumed":
      return resumedCondition;
    case "all":
      return null;
    default:
      return activeCondition;
  }
}

/**
 * Builds a StartDate or EndDate range condition for a given calendar year.
 */
function getYearCondition(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return null;
  const startOfYear = new Date(y, 0, 1);
  const endOfYear = new Date(y + 1, 0, 1);
  return {
    OR: [
      { StartDate: { gte: startOfYear, lt: endOfYear } },
      { EndDate: { gte: startOfYear, lt: endOfYear } },
    ],
  };
}

/**
 * Returns distinct StartDate/EndDate years present in EmployeeStates (desc).
 */
async function getDistinctYears() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT YEAR(StartDate) AS y
      FROM EmployeeStates
      WHERE StartDate IS NOT NULL
      UNION
      SELECT DISTINCT YEAR(EndDate) AS y
      FROM EmployeeStates
      WHERE EndDate IS NOT NULL
      ORDER BY y DESC`;
    return rows.map((r) => Number(r.y)).filter((y) => Number.isInteger(y) && y > 0);
  } catch (_) {
    return [];
  }
}

/**
 * Attaches live remaining annual leave breakdown (`_remainingBreakdown`) and
 * syncs `RemainingBalanceAfter` from `Employee.LeaveBalances` whenever available.
 */
function attachLiveRemainingBreakdown(st) {
  if (!st || st.StateTypeOrReason !== "عطلة سنوية") return st;
  const rawBalances = st.Employee?.LeaveBalances;
  if (!Array.isArray(rawBalances)) return st;

  const positive = rawBalances
    .filter((b) => Number(b.RemainingDays) > 0)
    .sort((a, b) => Number(a.Year) - Number(b.Year));

  const breakdown = positive.map((b) => ({
    year: b.Year,
    days: Number(b.RemainingDays),
  }));
  const liveTotal = breakdown.reduce((sum, r) => sum + r.days, 0);

  return {
    ...st,
    RemainingBalanceAfter: liveTotal,
    _remainingBreakdown: breakdown,
  };
}

class EmployeeStatesService {
  /**
   * Fetch all employee states with pagination, geographic RBAC, lifecycle filtering, leave type, and year stepper.
   */
  static async getAll(
    requestingUser,
    page = 1,
    limit = 25,
    category = "",
    employeeId = null,
    search = "",
    directorate = "",
    province = "",
    sortBy = "Id",
    sortOrder = "desc",
    statusFilter = "active",
    stateType = "",
    year = ""
  ) {
    const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

    // Build where clause with geographic filter via Employee relation
    const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
    if (isForbidden) {
      return {
        data: [],
        meta: {
          total: 0,
          page: safePage,
          limit: safeLimit,
          totalPages: 0,
          counts: { active: 0, resumed: 0, all: 0 },
          years: [],
        },
      };
    }

    const employeeFilter = {
      Province: provinceFilter,
      ...(employeeId && Number.isInteger(Number(employeeId)) ? { Id: Number(employeeId) } : {}),
      ...(directorate ? { Directorate: directorate } : {}),
    };

    const baseWhere = {
      Employee: employeeFilter,
      ...(category ? { RecordCategory: category } : {}),
      ...(stateType && String(stateType).trim() ? { StateTypeOrReason: String(stateType).trim() } : {}),
    };

    // Search: tokenized multi-word search across employee name, state type, notes, etc.
    const tokenSearch = buildTokenizedSearch(search, (token) => [
      { Employee: { LastName: { contains: token } } },
      { Employee: { Name: { contains: token } } },
      { Employee: { NIN: { contains: token } } },
      { StateTypeOrReason: { contains: token } },
      { ExceptionalReason: { contains: token } },
      { CurrentJobTitle: { contains: token } },
      { Notes: { contains: token } },
      { Employee: { JobTitle: { RankName: { contains: token } } } },
    ]);
    if (tokenSearch) {
      baseWhere.AND = [...(baseWhere.AND || []), ...tokenSearch.AND];
    }

    const yearCondition = getYearCondition(year);
    if (yearCondition) {
      baseWhere.AND = [...(baseWhere.AND || []), yearCondition];
    }

    const buildWhereForStatus = (status) => {
      const cond = getLeaveLifecycleCondition(status);
      if (!cond) return baseWhere;
      return {
        ...baseWhere,
        AND: [...(baseWhere.AND || []), cond],
      };
    };

    // Default to 'all' if employeeId is explicitly targeted (e.g. employee profile leaves tab)
    const effectiveDefaultStatus = employeeId ? "all" : "active";
    const requestedStatus = statusFilter || effectiveDefaultStatus;

    // Smart auto-expand: when searching (>= 2 chars) or selecting a past year from 'active', expand to 'all'
    const currentYear = new Date().getFullYear();
    const isSearchExpanded = Boolean(search && search.trim().length >= 2) && requestedStatus === "active";
    const isPastYearExpanded = Boolean(year && Number(year) < currentYear) && requestedStatus === "active";
    const effectiveStatus = (isSearchExpanded || isPastYearExpanded) ? "all" : requestedStatus;

    const whereClause = buildWhereForStatus(effectiveStatus);

    let orderBy = { Id: "desc" };
    const safeOrder = String(sortOrder || "").toLowerCase() === "asc" ? "asc" : "desc";
    if (sortBy === "Employee" || sortBy === "employee" || sortBy === "Name") {
      orderBy = { Employee: { LastName: safeOrder } };
    } else if (sortBy === "RecordCategory" || sortBy === "category" || sortBy === "Category") {
      orderBy = { RecordCategory: safeOrder };
    } else if (sortBy === "StateTypeOrReason" || sortBy === "type" || sortBy === "StateType") {
      orderBy = { StateTypeOrReason: safeOrder };
    } else if (sortBy === "StartDate" || sortBy === "startDate") {
      orderBy = { StartDate: safeOrder };
    } else if (sortBy === "EndDate" || sortBy === "endDate") {
      orderBy = { EndDate: safeOrder };
    } else if (sortBy === "DaysCount" || sortBy === "TotalDays" || sortBy === "daysCount") {
      orderBy = { DaysCount: safeOrder };
    } else if (sortBy === "IsResumed" || sortBy === "status" || sortBy === "Status") {
      orderBy = { IsResumed: safeOrder };
    } else if (sortBy === "Id" || sortBy === "id") {
      orderBy = { Id: safeOrder };
    }

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
        ExceptionalReason: true,
        Employee: {
          select: {
            Id: true,
            Name: true,
            LastName: true,
            Province: true,
            Gender: true,
            DateOfBirth: true,
            Directorate: true,
            AssignedPosition: true,
            EmployeeStatus: true,
            CorpsType: true,
            JobTitleId: true,
            JobTitle: {
              select: {
                Id: true,
                RankName: true,
                EmploymentCategory: true,
              }
            },
            LeaveBalances: {
              orderBy: { Year: "asc" },
              select: {
                Year: true,
                TotalDays: true,
                ConsumedDays: true,
                RemainingDays: true,
              },
            },
          }
        }
      },
      skip,
      take: safeLimit,
      orderBy,
    });

    const [total, states, activeCount, resumedCount, allCount, years] = await Promise.all([
      prisma.employeeStates.count({ where: whereClause }),
      statesPromise,
      prisma.employeeStates.count({ where: buildWhereForStatus("active") }),
      prisma.employeeStates.count({ where: buildWhereForStatus("resumed") }),
      prisma.employeeStates.count({ where: buildWhereForStatus("all") }),
      getDistinctYears(),
    ]);

    const enrichedStates = states.map(attachLiveRemainingBreakdown);

    return {
      data: enrichedStates,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        counts: {
          active: activeCount,
          resumed: resumedCount,
          all: allCount,
        },
        years,
      },
    };
  }

  /**
   * Get a single state by ID with RBAC check.
   */
  static async getById(id, requestingUser) {
    const state = await prisma.employeeStates.findUnique({
      where: { Id: id },
      include: {
        Employee: {
          include: {
            JobTitle: true,
            LeaveBalances: {
              orderBy: { Year: "asc" },
            },
          },
        },
      },
    });

    if (!state) throw ApiError.notFound(`EmployeeState ${id} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser);
      if (!allowed.includes(state.Employee.Province)) {
        throw ApiError.forbidden("Geographic access denied for this state record.");
      }
    }

    return attachLiveRemainingBreakdown(state);
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
      const allowed = getAllowedProvinces(requestingUser);
      if (!allowed.includes(employee.Province)) {
        throw ApiError.forbidden(`Geographic access denied for province: ${employee.Province}`);
      }
    }

    // Scenario B: If the user selected 'إدراج استئناف' or submitted a resumption in Create mode,
    // find the employee's active un-resumed leave and resume it directly instead of creating a duplicate entry.
    const isResumptionEntry =
      data.RecordCategory === "إدراج استئناف" ||
      data.StateTypeOrReason === "إدراج استئناف" ||
      Boolean(data.IsResumed) === true;

    if (isResumptionEntry) {
      const activeLeave = await prisma.employeeStates.findFirst({
        where: { EmployeesId: Number(data.EmployeesId), IsResumed: false },
        orderBy: { Id: "desc" },
      });

      if (activeLeave) {
        const resumed = await this.resumeLeaveEarly(
          activeLeave.Id,
          {
            actualReturnDate:
              data.ActualReturnDate ||
              data.actualReturnDate ||
              data.StartDate ||
              new Date().toISOString().split("T")[0],
            notes: data.Notes || data.notes,
          },
          requestingUser
        );
        return resumed.data || resumed;
      }
    } else {
      // Ensure any prior un-resumed leave for this employee is marked as resumed
      // so the employee never remains stuck with a stale un-resumed leave.
      await prisma.employeeStates.updateMany({
        where: { EmployeesId: Number(data.EmployeesId), IsResumed: false },
        data: { IsResumed: true },
      });
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
          IsResumed: Boolean(data.IsResumed) || data.RecordCategory === "إدراج استئناف",
          ActualReturnDate:
            data.ActualReturnDate && !isNaN(new Date(data.ActualReturnDate).getTime())
              ? new Date(data.ActualReturnDate)
              : null,
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
          ExceptionalReason: (() => {
            if (!String(data.StateTypeOrReason || "").includes("استثنائية")) return null;
            const raw = data.ExceptionalReason !== undefined ? data.ExceptionalReason : data.exceptionalReason;
            const cleaned = raw ? String(raw).replace(/^[(\s]+|[)\s]+$/g, "").trim() : "";
            return cleaned || null;
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

    // If transitioning from un-resumed to resumed (or category set to 'إدراج استئناف'),
    // run through resumeLeaveEarly so early-return balance refunds and ActualReturnDate are handled properly.
    const wantsResume =
      Boolean(data.IsResumed) === true || data.RecordCategory === "إدراج استئناف";

    if (wantsResume && !existing.IsResumed) {
      const resumed = await this.resumeLeaveEarly(
        id,
        {
          actualReturnDate:
            data.ActualReturnDate ||
            data.actualReturnDate ||
            existing.EndDate ||
            new Date().toISOString().split("T")[0],
          notes: data.Notes !== undefined ? data.Notes : data.notes,
          ExceptionalReason: data.ExceptionalReason !== undefined ? data.ExceptionalReason : data.exceptionalReason,
        },
        requestingUser
      );
      return resumed.data || resumed;
    }

    const nextStateType = data.StateTypeOrReason ?? existing.StateTypeOrReason;
    const isAnnualLeave = nextStateType === "عطلة سنوية";
    const oldDays = Number(existing.DaysCount || 0);
    const newDays = data.DaysCount !== undefined ? Number(data.DaysCount) : oldDays;

    const state = await prisma.$transaction(
      async (tx) => {
        let remainingBreakdown = [];
        let remainingBalanceAfter = existing.RemainingBalanceAfter;

        if (isAnnualLeave) {
          const daysDiff = newDays - oldDays;

          if (daysDiff < 0) {
            // Duration reduced: refund (-daysDiff) via Reverse-FIFO (newest year first)
            let remainingToRefund = Math.abs(daysDiff);
            const balances = await tx.leaveBalance.findMany({
              where: { EmployeeId: existing.EmployeesId },
              orderBy: { Year: "desc" },
            });

            for (const balance of balances) {
              if (remainingToRefund <= 0) break;
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
                remainingToRefund -= take;
              }
            }
          } else if (daysDiff > 0) {
            // Duration increased: deduct daysDiff via FIFO (oldest year first)
            let remainingToDeduct = daysDiff;
            const balances = await tx.leaveBalance.findMany({
              where: { EmployeeId: existing.EmployeesId, RemainingDays: { gt: 0 } },
              orderBy: { Year: "asc" },
            });

            const totalAvailable = balances.reduce((sum, b) => sum + b.RemainingDays, 0);
            if (totalAvailable < remainingToDeduct) {
              throw ApiError.badRequest(
                `الرصيد غير كافٍ لتمديد العطلة (المتاح: ${totalAvailable} يوم، الإضافي المطلوب: ${remainingToDeduct} يوم)`
              );
            }

            for (const balance of balances) {
              if (remainingToDeduct <= 0) break;
              const deduct = Math.min(balance.RemainingDays, remainingToDeduct);
              await tx.leaveBalance.update({
                where: { Id: balance.Id },
                data: {
                  ConsumedDays: balance.ConsumedDays + deduct,
                  RemainingDays: balance.RemainingDays - deduct,
                },
              });
              remainingToDeduct -= deduct;
            }
          }

          // Re-query live positive balances to ensure RemainingBalanceAfter is always accurate
          const positiveAfter = await tx.leaveBalance.findMany({
            where: { EmployeeId: existing.EmployeesId, RemainingDays: { gt: 0 } },
            orderBy: { Year: "asc" },
          });
          remainingBreakdown = positiveAfter.map((b) => ({
            year: b.Year,
            days: b.RemainingDays,
          }));
          remainingBalanceAfter = remainingBreakdown.reduce((sum, r) => sum + r.days, 0);
        }

        const updated = await tx.employeeStates.update({
          where: { Id: id },
          data: {
            RecordCategory:
              data.RecordCategory === "إدراج استئناف"
                ? existing.RecordCategory
                : data.RecordCategory ?? existing.RecordCategory,
            CurrentJobTitle: data.CurrentJobTitle ?? existing.CurrentJobTitle,
            StateTypeOrReason: nextStateType,
            DaysCount: newDays,
            StartDate: data.StartDate ? new Date(data.StartDate) : existing.StartDate,
            EndDate: data.EndDate ? new Date(data.EndDate) : existing.EndDate,
            IsResumed: wantsResume ? true : data.IsResumed !== undefined ? data.IsResumed : existing.IsResumed,
            ActualReturnDate: data.ActualReturnDate ? new Date(data.ActualReturnDate) : existing.ActualReturnDate,
            RemainingBalanceAfter: remainingBalanceAfter,
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
            ExceptionalReason: (() => {
              if (!String(nextStateType || "").includes("استثنائية")) return null;
              const hasReason = data.ExceptionalReason !== undefined || data.exceptionalReason !== undefined;
              if (!hasReason) return existing.ExceptionalReason ?? null;
              const raw = data.ExceptionalReason !== undefined ? data.ExceptionalReason : data.exceptionalReason;
              const cleaned = raw ? String(raw).replace(/^[(\s]+|[)\s]+$/g, "").trim() : "";
              return cleaned || null;
            })(),
          },
          include: {
            Employee: {
              include: {
                JobTitle: true,
                LeaveBalances: {
                  orderBy: { Year: "asc" },
                },
              },
            },
          },
        });

        updated._remainingBreakdown = remainingBreakdown;
        return updated;
      },
      { maxWait: 15000, timeout: 60000 }
    );

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

        let remainingBalanceAfter = existing.RemainingBalanceAfter;
        let remainingBreakdown = [];

        if (isAnnualLeave) {
          const positiveAfter = await tx.leaveBalance.findMany({
            where: { EmployeeId: existing.EmployeesId, RemainingDays: { gt: 0 } },
            orderBy: { Year: "asc" },
          });
          remainingBreakdown = positiveAfter.map((b) => ({
            year: b.Year,
            days: b.RemainingDays,
          }));
          remainingBalanceAfter = remainingBreakdown.reduce((sum, r) => sum + r.days, 0);
        }

        const inputNotes = (data.notes || data.Notes || "").trim();
        let updatedNotes = existing.Notes;
        if (inputNotes) {
          updatedNotes = existing.Notes ? `${existing.Notes} | ${inputNotes}` : inputNotes;
        }

        const recalculatedEndDate = isEarly
          ? new Date(startUtc + (newDaysCount - 1) * 86400000)
          : existing.EndDate;

        const updatedState = await tx.employeeStates.update({
          where: { Id: id },
          data: {
            IsResumed: true,
            IsResumedEarly: isEarly,
            ActualReturnDate: actualReturn,
            DaysCount: isEarly ? newDaysCount : existing.DaysCount,
            EndDate: recalculatedEndDate,
            RequestedDays: existing.RequestedDays || existing.DaysCount,
            RefundedDays: totalRefunded,
            RefundedBreakdown: breakdown.length > 0 ? JSON.stringify(breakdown) : null,
            RemainingBalanceAfter: remainingBalanceAfter,
            Notes: updatedNotes,
            ExceptionalReason: (() => {
              if (!String(existing.StateTypeOrReason || "").includes("استثنائية")) return null;
              const hasReason = data.ExceptionalReason !== undefined || data.exceptionalReason !== undefined;
              if (!hasReason) return existing.ExceptionalReason ?? null;
              const raw = data.ExceptionalReason !== undefined ? data.ExceptionalReason : data.exceptionalReason;
              const cleaned = raw ? String(raw).replace(/^[(\s]+|[)\s]+$/g, "").trim() : "";
              return cleaned || null;
            })(),
          },
          include: {
            Employee: {
              select: {
                Id: true,
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
                  },
                },
                LeaveBalances: {
                  orderBy: { Year: "asc" },
                  select: {
                    Year: true,
                    TotalDays: true,
                    ConsumedDays: true,
                    RemainingDays: true,
                  },
                },
              },
            },
          },
        });

        updatedState._remainingBreakdown = remainingBreakdown;

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

