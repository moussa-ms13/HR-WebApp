// ============================================================
// Employee Files Download Route — /api/employee-files
// Secure file streaming endpoint (Endpoint 7)
// ============================================================
const express = require("express");
const path = require("path");
const EmployeeFilesService = require("../services/EmployeeFilesService");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

// Extension → MIME type lookup for inline viewing
const MIME_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain",
};

/**
 * GET /api/employee-files/:docId/view
 * Serves a file inline (for in-browser viewing) with the correct Content-Type.
 * Falls back to octet-stream for unknown types.
 */
router.get("/:docId/view", async (req, res) => {
  const { fullPath, fileName } = await EmployeeFilesService.downloadFile(
    Number(req.params.docId),
    req.user
  );
  const ext = path.extname(fileName || fullPath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
  res.sendFile(fullPath);
});

/**
 * GET /api/employee-files/:docId/download
 * Streams a physical file to the client after RBAC + path validation.
 */
router.get("/:docId/download", async (req, res) => {
  const { fullPath, fileName } = await EmployeeFilesService.downloadFile(
    Number(req.params.docId),
    req.user
  );
  res.download(fullPath, fileName);
});

module.exports = router;
