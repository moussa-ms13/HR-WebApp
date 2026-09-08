// ============================================================
// EmployeeStates Routes — /api/employee-states
// CRUD for leaves & special cases with RBAC
// ============================================================
const express = require("express");
const EmployeeStatesService = require("../services/EmployeeStatesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/employee-states
 * Paginated list with optional category filter
 */
router.get("/", async (req, res) => {
  const { page, limit, category, employeeId, search, directorate, province } = req.query;
  const result = await EmployeeStatesService.getAll(
    req.user,
    Number(page) || 1,
    Number(limit) || 25,
    category || "",
    employeeId || null,
    search || "",
    directorate || "",
    province || ""
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
 */
router.post("/", hasPermission(PERMISSIONS.ADD), async (req, res, next) => {
  try {
    const state = await EmployeeStatesService.create(req.body, req.user);
    res.status(201).json({ success: true, data: state });
  } catch (error) {
    console.error("🔥 CRITICAL LEAVE CREATE ERROR:", error);
    next(error);
  }
});

/**
 * PUT /api/employee-states/:id
 */
router.put("/:id", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const state = await EmployeeStatesService.update(Number(req.params.id), req.body, req.user);
  res.json({ success: true, data: state });
});

/**
 * DELETE /api/employee-states/:id
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await EmployeeStatesService.delete(Number(req.params.id), req.user);
  res.json({ success: true, ...result });
});

module.exports = router;
