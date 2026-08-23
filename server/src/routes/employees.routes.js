// ============================================================
// Employees Routes — /api/employees
// Handles Employee CRUD operations, enforcing RBAC
// ============================================================
const express = require("express");
const EmployeesService = require("../services/EmployeesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

// File routes moved to server.js before express.json

const ExportService = require("../services/ExportService");

router.use(authenticate);

/**
 * GET /api/employees/export
 * Export employees to Excel
 */
router.get("/export", async (req, res) => {
  await ExportService.exportEmployeesToExcel(res);
});


/**
 * GET /api/employees
 * Fetches employees with server-side pagination and Geographic RBAC
 */
router.get("/", async (req, res) => {
  const { page, limit, search, province } = req.query;
  const result = await EmployeesService.getAll(
    req.user,
    Number(page) || 1,
    Number(limit) || 20,
    search || "",
    province || ""
  );
  res.json({ success: true, ...result });
});

/**
 * GET /api/employees/:id/summary
 * Fetches a lightweight profile summary (Profile DTO) — no arrays.
 */
router.get("/:id/summary", async (req, res) => {
  const employee = await EmployeesService.getSummary(Number(req.params.id), req.user);
  res.json({ success: true, data: employee });
});

/**
 * GET /api/employees/:id
 * Fetches a single employee (respecting geographic boundaries)
 */
router.get("/:id", async (req, res) => {
  const employee = await EmployeesService.getById(Number(req.params.id), req.user);
  res.json({ success: true, data: employee });
});

/**
 * POST /api/employees
 * Creates a new employee
 */
router.post("/", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  const employee = await EmployeesService.create(req.body, req.user);
  res.status(201).json({ success: true, data: employee });
});

/**
 * PUT /api/employees/:id
 * Updates an employee
 */
router.put("/:id", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const employee = await EmployeesService.update(Number(req.params.id), req.body, req.user);
  res.json({ success: true, data: employee });
});

/**
 * POST /api/employees/:id/image
 * Uploads a profile image for an employee
 */
const uploadImage = require("../middleware/uploadImage");
router.post("/:id/image", hasPermission(PERMISSIONS.EDIT), uploadImage.single("profileImage"), async (req, res) => {
  const result = await EmployeesService.uploadProfileImage(Number(req.params.id), req.file, req.user);
  res.json({ success: true, data: result });
});

/**
 * DELETE /api/employees/:id
 * Deletes an employee
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await EmployeesService.delete(Number(req.params.id), req.user);
  res.json({ success: true, ...result });
});

module.exports = router;
