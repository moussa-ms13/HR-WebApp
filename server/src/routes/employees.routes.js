// ============================================================
// Employees Routes — /api/employees
// Handles Employee CRUD operations, enforcing RBAC
// ============================================================
const express = require("express");
const EmployeesService = require("../services/EmployeesService");
const CareerHistoryService = require("../services/CareerHistoryService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

// File routes moved to server.js before express.json

const ExportService = require("../services/ExportService");
const specialCasesRoutes = require("./specialCases.routes");

router.use(authenticate);

// Mount nested special-cases routes under /api/employees/:id/special-cases
router.use("/:id/special-cases", specialCasesRoutes);

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
  const { page, limit, search, province, directorate, fileStatus } = req.query;
  const result = await EmployeesService.getAll(
    req.user,
    Number(page) || 1,
    Number(limit) || 20,
    search || "",
    province || "",
    directorate || "",
    fileStatus || ""
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

/**
 * GET /api/employees/:id/career-history
 * Fetches both rank & position histories, ordered by InstallDate desc
 */
router.get("/:id/career-history", async (req, res) => {
  const data = await CareerHistoryService.get(Number(req.params.id), req.user);
  res.json({ success: true, data });
});

/**
 * POST /api/employees/:id/rank-history
 */
router.post("/:id/rank-history", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  const record = await CareerHistoryService.createRank(Number(req.params.id), req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

/**
 * PUT /api/employees/:id/rank-history/:recordId
 */
router.put("/:id/rank-history/:recordId", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const record = await CareerHistoryService.updateRank(
    Number(req.params.id),
    Number(req.params.recordId),
    req.body,
    req.user
  );
  res.json({ success: true, data: record });
});

/**
 * DELETE /api/employees/:id/rank-history/:recordId
 */
router.delete("/:id/rank-history/:recordId", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await CareerHistoryService.deleteRank(
    Number(req.params.id),
    Number(req.params.recordId),
    req.user
  );
  res.json({ success: true, ...result });
});

/**
 * POST /api/employees/:id/position-history
 */
router.post("/:id/position-history", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  const record = await CareerHistoryService.createPosition(Number(req.params.id), req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

/**
 * PUT /api/employees/:id/position-history/:recordId
 */
router.put("/:id/position-history/:recordId", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const record = await CareerHistoryService.updatePosition(
    Number(req.params.id),
    Number(req.params.recordId),
    req.body,
    req.user
  );
  res.json({ success: true, data: record });
});

/**
 * DELETE /api/employees/:id/position-history/:recordId
 */
router.delete("/:id/position-history/:recordId", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await CareerHistoryService.deletePosition(
    Number(req.params.id),
    Number(req.params.recordId),
    req.user
  );
  res.json({ success: true, ...result });
});

module.exports = router;
