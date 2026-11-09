// ============================================================
// EmployeeStates Routes — /api/employee-states
// CRUD for leaves & special cases with RBAC
// ============================================================
const express = require("express");
const EmployeeStatesService = require("../services/EmployeeStatesService");
const CacheService = require("../services/CacheService");
const SystemRecordService = require("../services/SystemRecordService");
const { authenticate, hasPermission, hasAnyPermission } = require("../middleware/auth");
const { PERMISSIONS, ROLES, getAllowedProvinces } = require("../config/constants");
const prisma = require("../config/database");

const ANNUAL_LEAVE_TYPE = "عطلة سنوية";

class InsufficientBalanceError extends Error {
  constructor(available, requested) {
    super("Insufficient leave balance");
    this.name = "InsufficientBalanceError";
    this.available = available;
    this.requested = requested;
  }
}

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/employee-states
 * Paginated list with optional category filter
 */
router.get("/", async (req, res, next) => {
  try {
    const {
      page,
      limit,
      category,
      employeeId,
      search,
      directorate,
      province,
      sortBy,
      sortOrder,
      statusFilter,
      stateType,
      year,
    } = req.query;
    const result = await EmployeeStatesService.getAll(
      req.user,
      Number(page) || 1,
      Number(limit) || 25,
      category || "",
      employeeId || null,
      search || "",
      directorate || "",
      province || "",
      sortBy || "Id",
      sortOrder || "desc",
      statusFilter || (employeeId ? "all" : "active"),
      stateType || "",
      year || ""
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee-states/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const state = await EmployeeStatesService.getById(Number(req.params.id), req.user);
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employee-states
 */
router.post("/", hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT), async (req, res, next) => {
  try {
    const {
      EmployeesId,
      RecordCategory,
      StateTypeOrReason,
      DaysCount,
      RequestedDays,
      StartDate,
      EndDate,
      IsResumed,
      ActualReturnDate,
      CurrentJobTitle,
      Notes,
      DoctorName,
      CertificateDate,
      SecondDoctorName,
      SecondCertificateDate,
      ExceptionalReason,
      exceptionalReason,
    } = req.body;

    const employeesId = parseInt(EmployeesId, 10);
    // The frontend modals send either DaysCount, or both
    // DaysCount + RequestedDays — accept whichever is present.
    const daysCount = parseInt(DaysCount ?? RequestedDays ?? 0, 10);

    if (isNaN(employeesId) || employeesId <= 0) {
      return res.status(400).json({ success: false, message: "معرّف الموظف غير صالح" });
    }

    const employee = await prisma.employees.findUnique({
      where: { Id: employeesId },
      include: { JobTitle: true },
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }

    if (req.user?.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(req.user);
      if (!allowed.includes(employee.Province)) {
        return res.status(403).json({
          success: false,
          message: `غير مصرح لك بإدارة سجلات ولاية: ${employee.Province}`,
        });
      }
    }

    // Scenario B: If the user selected 'إدراج استئناف' or submitted a resumption in Create mode,
    // find the employee's active un-resumed leave and resume it directly instead of creating a duplicate entry.
    const isResumptionRequest =
      RecordCategory === "إدراج استئناف" ||
      StateTypeOrReason === "إدراج استئناف" ||
      Boolean(IsResumed) === true;

    if (isResumptionRequest) {
      const activeLeave = await prisma.employeeStates.findFirst({
        where: { EmployeesId: employeesId, IsResumed: false },
        orderBy: { Id: "desc" },
      });

      if (activeLeave) {
        const resumed = await EmployeeStatesService.resumeLeaveEarly(
          activeLeave.Id,
          {
            actualReturnDate:
              ActualReturnDate || StartDate || new Date().toISOString().split("T")[0],
            notes: Notes,
          },
          req.user
        );
        return res.status(200).json({
          success: true,
          data: resumed.data || resumed,
          breakdown: resumed.breakdown || [],
        });
      }
    }

    const effectiveCategory =
      RecordCategory === "إدراج استئناف" ? "تسجيل عطلة" : RecordCategory;
    const effectiveStateType =
      StateTypeOrReason === "إدراج استئناف" ? "عطلة سنوية" : StateTypeOrReason;

    const parsedStartDate = new Date(StartDate);
    if (!effectiveCategory || !effectiveStateType || !StartDate || isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({ success: false, message: "الحقول المطلوبة ناقصة أو تاريخ البدء غير صالح" });
    }
    if (isNaN(daysCount) || daysCount < 0) {
      return res.status(400).json({ success: false, message: "عدد الأيام غير صالح" });
    }

    // If creating a new active leave, automatically mark any previous un-resumed leave for this employee as resumed
    if (!isResumptionRequest) {
      await prisma.employeeStates.updateMany({
        where: { EmployeesId: employeesId, IsResumed: false },
        data: { IsResumed: true },
      });
    }

    const usersId = req.user?.userName ?? req.user?.userId ?? req.user?.UserId ?? String(req.user?.id ?? req.user?.Id ?? "system");

    const baseData = {
      EmployeesId: employeesId,
      RecordCategory: effectiveCategory,
      CurrentJobTitle: CurrentJobTitle || employee.JobTitle?.RankName || "",
      StateTypeOrReason: effectiveStateType,
      DaysCount: daysCount,
      RequestedDays: daysCount,
      StartDate: parsedStartDate,
      EndDate: EndDate && !isNaN(new Date(EndDate).getTime()) ? new Date(EndDate) : parsedStartDate,
      AddedDate: new Date(),
      UsersId: usersId,
      IsResumed: Boolean(isResumptionRequest),
      ActualReturnDate: ActualReturnDate && !isNaN(new Date(ActualReturnDate).getTime()) ? new Date(ActualReturnDate) : (isResumptionRequest ? parsedStartDate : null),
      IsResumedEarly: false,
      Notes: Notes || null,
      DoctorName: (DoctorName !== undefined ? DoctorName : req.body.doctorName) ? String(DoctorName || req.body.doctorName).trim() : null,
      CertificateDate: (() => {
        const d = CertificateDate !== undefined ? CertificateDate : req.body.certificateDate;
        return d && !isNaN(new Date(d).getTime()) ? new Date(d) : null;
      })(),
      SecondDoctorName: (() => {
        const d = SecondDoctorName !== undefined ? SecondDoctorName : (req.body.secondDoctorName !== undefined ? req.body.secondDoctorName : req.body.doctorName2);
        return d ? String(d).trim() : null;
      })(),
      SecondCertificateDate: (() => {
        const d = SecondCertificateDate !== undefined ? SecondCertificateDate : (req.body.secondCertificateDate !== undefined ? req.body.secondCertificateDate : req.body.certificateDate2);
        return d && !isNaN(new Date(d).getTime()) ? new Date(d) : null;
      })(),
      ExceptionalReason: (() => {
        if (!String(effectiveStateType || "").includes("استثنائية")) return null;
        const raw = ExceptionalReason !== undefined ? ExceptionalReason : exceptionalReason;
        const cleaned = raw ? String(raw).replace(/^[(\s]+|[)\s]+$/g, "").trim() : "";
        return cleaned || null;
      })(),
    };

    const isAnnualLeave =
      effectiveCategory === "تسجيل عطلة" &&
      effectiveStateType === ANNUAL_LEAVE_TYPE &&
      daysCount > 0 &&
      !isResumptionRequest;

    // Non-annual entries (sick/maternity/unpaid leave, permanent special
    // states, etc.) don't touch LeaveBalance at all — plain create.
    if (!isAnnualLeave) {
      const created = await prisma.employeeStates.create({ data: baseData });
      await SystemRecordService.log({
        userFullName: req.user?.fullName || usersId,
        title: "إضافة وضعية/إجازة موظف",
        description: `تمت إضافة ${effectiveCategory}: '${effectiveStateType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${usersId}'.`,
        usersId: req.user?.id || 1,
        employeesId,
        ipAddress: req.user?.ipAddress,
      }).catch(() => {});
      CacheService.invalidateEmployeeEcosystem();
      return res.status(201).json({ success: true, data: created });
    }

    // ── Annual leave: FIFO deduction across LeaveBalance rows ──────────
    const result = await prisma.$transaction(
      async (tx) => {
        const balances = await tx.leaveBalance.findMany({
          where: { EmployeeId: employeesId, RemainingDays: { gt: 0 } },
          orderBy: { Year: "asc" }, // oldest first = FIFO
        });

        const totalAvailable = balances.reduce((sum, b) => sum + b.RemainingDays, 0);
        if (totalAvailable < daysCount) {
          throw new InsufficientBalanceError(totalAvailable, daysCount);
        }

        let remaining = daysCount;
        for (const balance of balances) {
          if (remaining <= 0) break;
          const deduction = Math.min(balance.RemainingDays, remaining);

          // Sequential await — DO NOT parallelize with Promise.all.
          // SQL Server's mssql/tedious driver cannot multiplex concurrent
          // requests over a single connection inside an interactive
          // transaction; doing so previously caused "Requests can only
          // be made in the LoggedIn state, not the Final state".
          await tx.leaveBalance.update({
            where: { Id: balance.Id },
            data: {
              ConsumedDays: balance.ConsumedDays + deduction,
              RemainingDays: balance.RemainingDays - deduction,
            },
          });

          remaining -= deduction;
        }

        const positiveAfter = await tx.leaveBalance.findMany({
          where: { EmployeeId: employeesId, RemainingDays: { gt: 0 } },
          orderBy: { Year: "asc" },
        });
        const remainingBreakdown = positiveAfter.map((b) => ({
          year: b.Year,
          days: b.RemainingDays,
        }));
        const remainingBalanceAfter = remainingBreakdown.reduce((sum, r) => sum + r.days, 0);

        const created = await tx.employeeStates.create({
          data: {
            ...baseData,
            RemainingBalanceAfter: remainingBalanceAfter,
          },
        });
        created._remainingBreakdown = remainingBreakdown;
        return created;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: req.user?.fullName || usersId,
      title: "إضافة وضعية/إجازة موظف",
      description: `تمت إضافة ${effectiveCategory}: '${effectiveStateType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${usersId}'.`,
      usersId: req.user?.id || 1,
      employeesId,
      ipAddress: req.user?.ipAddress,
    }).catch(() => {});
    CacheService.invalidateEmployeeEcosystem();

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return res.status(400).json({
        success: false,
        message: `الرصيد غير كافٍ لتسجيل هذه العطلة (المتاح: ${error.available} يوم، المطلوب: ${error.requested} يوم)`,
      });
    }
    console.error("EmployeeStates POST Error:", error);
    return res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
});

/**
 * PUT /api/employee-states/:id
 */
router.put("/:id", hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT), async (req, res, next) => {
  try {
    const state = await EmployeeStatesService.update(Number(req.params.id), req.body, req.user);
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/employee-states/:id/resume
 */
router.put("/:id/resume", hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT), async (req, res, next) => {
  try {
    const result = await EmployeeStatesService.resumeLeaveEarly(Number(req.params.id), req.body, req.user);
    res.json({
      success: true,
      data: result.data || result,
      breakdown: result.breakdown || [],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employee-states/:id
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), async (req, res, next) => {
  try {
    const result = await EmployeeStatesService.delete(Number(req.params.id), req.user);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
