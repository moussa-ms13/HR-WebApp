const express = require("express");
const EmployeeFilesService = require("../services/EmployeeFilesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { PERMISSIONS } = require("../config/constants");

// mergeParams allows this router to access :id from the parent router (employees.routes.js)
const router = express.Router({ mergeParams: true });

router.use(authenticate);

/**
 * GET /api/employees/:id/files
 * Fetch all files for an employee
 */
router.get("/", async (req, res, next) => {
  try {
    const result = await EmployeeFilesService.getFilesByEmployee(
      Number(req.params.id),
      req.user,
      { page: req.query.page, limit: req.query.limit }
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees/:id/files
 * Batch upload up to 15 files under the 'files' form-data key
 */
router.post("/", hasPermission(PERMISSIONS.EDIT), upload.any(), async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees/:id/files/batch
 * Alias batch upload endpoint
 */
router.post("/batch", hasPermission(PERMISSIONS.EDIT), upload.any(), async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees/:id/files/bulk-delete
 * Bulk delete multiple documents by their IDs.
 * Body: { documentIds: [1, 2, 3] }
 *
 * NOTE: express.json() is applied inline because this router is mounted
 * BEFORE the global express.json() middleware in server.js (required for
 * multipart upload routes). Without it, req.body is undefined.
 */
router.post("/bulk-delete", express.json(), hasPermission(PERMISSIONS.DELETE), async (req, res, next) => {
  try {
    const { documentIds } = req.body;
    const result = await EmployeeFilesService.bulkDeleteFiles(
      Number(req.params.id),
      documentIds,
      req.user
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employees/:id/files/:fileId
 * Delete a document
 */
router.delete("/:fileId", hasPermission(PERMISSIONS.DELETE), async (req, res, next) => {
  try {
    const result = await EmployeeFilesService.deleteFile(Number(req.params.fileId), req.user);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/employees/:id/files/:fileId
 * Update a document's metadata
 */
router.put("/:fileId", hasPermission(PERMISSIONS.EDIT), upload.single("file"), async (req, res, next) => {
  try {
    const result = await EmployeeFilesService.updateFile(
      Number(req.params.fileId),
      req.body || {},
      req.file,
      req.user
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
