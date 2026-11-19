// ============================================================
// Employee Files Download Route — /api/employee-files
// Secure file streaming endpoint with RBAC + Stored-XSS prevention
// ============================================================
const express = require("express");
const path = require("path");
const EmployeeFilesService = require("../services/EmployeeFilesService");
const { authenticate } = require("../middleware/auth");
const ApiError = require("../utils/ApiError");

const router = express.Router();

router.use(authenticate);

// Safe inline-viewable MIME types (excludes SVG/HTML/JS to prevent stored XSS)
const SAFE_INLINE_MIME_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * GET /api/employee-files/:docId/view
 * Serves safe file types inline; forces attachment download for non-inline/active formats.
 */
router.get("/:docId/view", async (req, res) => {
  const docId = Number(req.params.docId);
  if (!Number.isInteger(docId) || docId <= 0) {
    throw ApiError.badRequest("معرف الوثيقة غير صالح.");
  }

  const { fullPath, fileName } = await EmployeeFilesService.downloadFile(docId, req.user);
  const ext = path.extname(fileName || fullPath).toLowerCase();
  const safeMime = SAFE_INLINE_MIME_TYPES[ext];

  res.setHeader("X-Content-Type-Options", "nosniff");
  if (safeMime) {
    res.setHeader("Content-Type", safeMime);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
  } else {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  }
  res.sendFile(fullPath);
});

/**
 * GET /api/employee-files/:docId/download
 * Streams a physical file to the client after RBAC + path validation.
 */
router.get("/:docId/download", async (req, res) => {
  const docId = Number(req.params.docId);
  if (!Number.isInteger(docId) || docId <= 0) {
    throw ApiError.badRequest("معرف الوثيقة غير صالح.");
  }

  const { fullPath, fileName } = await EmployeeFilesService.downloadFile(docId, req.user);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.download(fullPath, fileName);
});

module.exports = router;
