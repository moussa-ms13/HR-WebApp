// ============================================================
// EmployeeStates Routes — /api/employee-states
// CRUD for leaves & special cases with RBAC
// ============================================================
const express = require("express");
const EmployeeStatesService = require("../services/EmployeeStatesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");
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
router.post("/", hasPermission(PERMISSIONS.ADD), async (req, res, next) => {
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
    } = req.body;

    const employeesId = parseInt(EmployeesId, 10);
    // The frontend modals send either DaysCount, or both
    // DaysCount + RequestedDays — accept whichever is present.
    const daysCount = parseInt(DaysCount ?? RequestedDays ?? 0, 10);

    if (isNaN(employeesId) || employeesId <= 0) {
      return res.status(400).json({ success: false, message: "معرّف الموظف غير صالح" });
    }
    const parsedStartDate = new Date(StartDate);
    if (!RecordCategory || !StateTypeOrReason || !StartDate || isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({ success: false, message: "الحقول المطلوبة ناقصة أو تاريخ البدء غير صالح" });
    }
    if (isNaN(daysCount) || daysCount < 0) {
      return res.status(400).json({ success: false, message: "عدد الأيام غير صالح" });
    }

    // ADAPT THIS LINE to match how this project's `authenticate`
    // middleware actually populates req.user.
    const usersId = req.user?.userName ?? req.user?.userId ?? req.user?.UserId ?? String(req.user?.id ?? req.user?.Id ?? "system");

    const baseData = {
      EmployeesId: employeesId,
      RecordCategory,
      CurrentJobTitle: CurrentJobTitle || "",
      StateTypeOrReason,
      DaysCount: daysCount,
      RequestedDays: daysCount,
      StartDate: parsedStartDate,
      EndDate: EndDate && !isNaN(new Date(EndDate).getTime()) ? new Date(EndDate) : parsedStartDate,
      AddedDate: new Date(),
      UsersId: usersId,
      IsResumed: Boolean(IsResumed),
      ActualReturnDate: ActualReturnDate && !isNaN(new Date(ActualReturnDate).getTime()) ? new Date(ActualReturnDate) : null,
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
    };

    const isAnnualLeave =
      RecordCategory === "تسجيل عطلة" &&
      StateTypeOrReason === ANNUAL_LEAVE_TYPE &&
      daysCount > 0;

    // Non-annual entries (sick/maternity/unpaid leave, permanent special
    // states, etc.) don't touch LeaveBalance at all — plain create.
    if (!isAnnualLeave) {
      const created = await prisma.employeeStates.create({ data: baseData });
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

        return tx.employeeStates.create({
          data: {
            ...baseData,
            RemainingBalanceAfter: totalAvailable - daysCount,
          },
        });
      },
      { maxWait: 15000, timeout: 60000 }
    );

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
router.put("/:id", hasPermission(PERMISSIONS.EDIT), async (req, res, next) => {
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
router.put("/:id/resume", hasPermission(PERMISSIONS.EDIT), async (req, res, next) => {
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
