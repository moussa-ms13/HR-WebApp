const express = require("express");
const EmployeeFilesService = require("../services/EmployeeFilesService");
const EmployeesService = require("../services/EmployeesService");
const { authenticate, hasPermission, hasAnyPermission } = require("../middleware/auth");
const upload = require("../middleware/upload");
const ApiError = require("../utils/ApiError");
const { PERMISSIONS } = require("../config/constants");

// mergeParams allows this router to access :id from the parent router (employees.routes.js)
const router = express.Router({ mergeParams: true });

router.use(authenticate);

/**
 * Validates numeric employee ID and enforces Geographic RBAC BEFORE Multer touches the filesystem.
 */
const verifyEmployeeAccess = async (req, _res, next) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw ApiError.badRequest("معرف الموظف غير صالح.");
  }
  await EmployeesService.getById(employeeId, req.user);
  next();
};

/**
 * GET /api/employees/:id/files
 * Fetch all files for an employee
 */
router.get("/", async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw ApiError.badRequest("معرف الموظف غير صالح.");
  }
  const result = await EmployeeFilesService.getFilesByEmployee(
    employeeId,
    req.user,
    { page: req.query.page, limit: req.query.limit }
  );
  res.json({ success: true, ...result });
});

/**
 * POST /api/employees/:id/files
 * Batch upload up to 20 files
 */
router.post(
  "/",
  hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT),
  verifyEmployeeAccess,
  upload.any(),
  async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "لم يتم تحديد أي ملفات للرفع." });
    }
    const result = await EmployeeFilesService.uploadMultipleFiles(
      Number(req.params.id),
      files,
      req.body || {},
      req.user
    );
    res.status(201).json({ success: true, data: result });
  }
);

/**
 * POST /api/employees/:id/files/batch
 * Alias batch upload endpoint
 */
router.post(
  "/batch",
  hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT),
  verifyEmployeeAccess,
  upload.any(),
  async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "لم يتم تحديد أي ملفات للرفع." });
    }
    const result = await EmployeeFilesService.uploadMultipleFiles(
      Number(req.params.id),
      files,
      req.body || {},
      req.user
    );
    res.status(201).json({ success: true, data: result });
  }
);

/**
 * POST /api/employees/:id/files/bulk-delete
 * Bulk delete multiple documents by their IDs.
 */
router.post(
  "/bulk-delete",
  express.json({ limit: "1mb" }),
  hasPermission(PERMISSIONS.DELETE),
  verifyEmployeeAccess,
  async (req, res) => {
    const { documentIds } = req.body || {};
    const result = await EmployeeFilesService.bulkDeleteFiles(
      Number(req.params.id),
      documentIds,
      req.user
    );
    res.json({ success: true, ...result });
  }
);

/**
 * DELETE /api/employees/:id/files/:fileId
 * Delete a document (verifies file belongs to employee :id)
 */
router.delete("/:fileId", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const employeeId = Number(req.params.id);
  const fileId = Number(req.params.fileId);
  if (!Number.isInteger(employeeId) || !Number.isInteger(fileId)) {
    throw ApiError.badRequest("معرف غير صالح.");
  }
  const result = await EmployeeFilesService.deleteFile(fileId, req.user, employeeId);
  res.json({ success: true, ...result });
});

/**
 * PUT /api/employees/:id/files/:fileId
 * Update a document's metadata or replace file (verifies access BEFORE upload)
 */
router.put(
  "/:fileId",
  hasAnyPermission(PERMISSIONS.ADD, PERMISSIONS.EDIT),
  verifyEmployeeAccess,
  upload.single("file"),
  async (req, res) => {
    const fileId = Number(req.params.fileId);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      EmployeeFilesService.cleanupUploadedFiles(req.file ? [req.file] : []);
      throw ApiError.badRequest("معرف الوثيقة غير صالح.");
    }
    const result = await EmployeeFilesService.updateFile(
      fileId,
      req.body || {},
      req.file,
      req.user,
      Number(req.params.id)
    );
    res.json({ success: true, data: result });
  }
);

module.exports = router;
