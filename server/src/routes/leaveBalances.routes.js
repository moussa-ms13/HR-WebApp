const express = require("express");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");
const prisma = require("../config/database");
const LeaveBalanceService = require("../services/LeaveBalanceService");

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/leave-balances/employee/:id/leave-balances
 * Fetch ALL balance records for a specific employee, ordered by year DESC.
 *
 * IMPORTANT — route ordering:
 * This route MUST stay declared BEFORE "/employee/:id/:year" below.
 * Express matches routes top-down, and both paths have the same shape
 * ("/employee/:X/:Y"). With the old ordering, a request to
 * ".../123/leave-balances" was being caught by the generic
 * "/employee/:id/:year" route first — Express bound
 * req.params.year = "leave-balances", Number("leave-balances") produced
 * NaN, and Prisma rejected `Year: NaN` as an invalid filter for an Int
 * column. That was the actual root cause of the 500.
 */
router.get("/employee/:id/leave-balances", async (req, res, next) => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ success: false, message: "معرّف الموظف غير صالح" });
    }

    const balances = await prisma.leaveBalance.findMany({
      where: { EmployeeId: employeeId },
      orderBy: { Year: "desc" },
    });

    res.json({ success: true, data: balances });
  } catch (error) {
    console.error("Leave Balances Error:", error);
    return res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
});

/**
 * GET /api/leave-balances/employee/:id/:year
 * The ":year(\\d+)" constraint is a second, independent safety net: even
 * if another literal route is added later and mistakenly placed after
 * this one, a non-numeric segment (like "leave-balances") can never be
 * captured here again. If this project's Express/path-to-regexp version
 * rejects the inline regex, fall back to ":year" — the ordering fix
 * above is what actually resolves the bug.
 */
router.get("/employee/:id/:year(\\d+)", async (req, res, next) => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    const year = parseInt(req.params.year, 10);

    if (!Number.isInteger(employeeId) || employeeId <= 0 || !Number.isInteger(year)) {
      return res.status(400).json({ success: false, message: "معرّف الموظف أو السنة غير صالحة" });
    }

    const balance = await prisma.leaveBalance.findFirst({
      where: {
        EmployeeId: employeeId,
        Year: year,
      },
    });
    res.json({ success: true, data: balance });
  } catch (error) {
    console.error("Leave Balance Single Year Error:", error);
    return res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leave-balances/employee/:id
// Upsert (create or update) a leave balance record for a specific employee.
// Body: { year, totalDays, remainingDays, notes? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/employee/:id", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    const { year, totalDays, remainingDays, notes } = req.body;

    const record = await LeaveBalanceService.upsertBalance(employeeId, {
      year,
      totalDays: totalDays ?? 30,
      remainingDays: remainingDays ?? 0,
      notes,
    });

    res.json({ success: true, data: record, message: `تم حفظ رصيد السنة ${year} بنجاح.` });
  } catch (error) {
    console.error("Leave Balance Upsert Error:", error);
    const status = error.message.includes("غير") ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/leave-balances/employee/:id/:year
// Remove a specific year's balance record for an employee.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/employee/:id/:year", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    const year = parseInt(req.params.year, 10);

    const result = await LeaveBalanceService.deleteBalance(employeeId, year);
    res.json(result);
  } catch (error) {
    console.error("Leave Balance Delete Error:", error);
    const status = error.message.includes("غير") || error.message.includes("لا يوجد") ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

module.exports = router;

