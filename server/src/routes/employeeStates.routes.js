// ============================================================
// EmployeeStates Routes — /api/employee-states & /api/leaves
// Thin HTTP layer delegating all business logic to EmployeeStatesService
// ============================================================
const express = require("express");
const EmployeeStatesService = require("../services/EmployeeStatesService");
const { authenticate, hasPermission, hasAnyPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/employee-states
 */
router.get("/", async (req, res) => {
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
});

/**
 * GET /api/employee-states/:id
 */
router.get("/:id", async (req, res) => {
  const state = await EmployeeStatesService.getById(Number(req.params.id), req.user);
  res.json({ success: true, data: state });
});

/**
 * POST /api/employee-states
 * Atomic leave creation / resumption — errors flow through global errorHandler (no stack leaks)
 */
router.post("/", hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT), async (req, res) => {
  const result = await EmployeeStatesService.create(req.body || {}, req.user);
  if (result.wasResumption) {
    return res.status(200).json({
      success: true,
      data: result.data,
      breakdown: result.breakdown || [],
    });
  }
  return res.status(201).json({ success: true, data: result.data });
});

/**
 * PUT /api/employee-states/:id
 */
router.put("/:id", hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT), async (req, res) => {
  const state = await EmployeeStatesService.update(Number(req.params.id), req.body || {}, req.user);
  res.json({ success: true, data: state });
});

/**
 * PUT /api/employee-states/:id/resume
 */
router.put("/:id/resume", hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT), async (req, res) => {
  const result = await EmployeeStatesService.resumeLeaveEarly(Number(req.params.id), req.body || {}, req.user);
  res.json({
    success: true,
    data: result.data || result,
    breakdown: result.breakdown || [],
  });
});

/**
 * DELETE /api/employee-states/:id
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await EmployeeStatesService.delete(Number(req.params.id), req.user);
  res.json({ success: true, ...result });
});

module.exports = router;
