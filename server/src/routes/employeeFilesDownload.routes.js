// ============================================================
// Employee Files Download Route — /api/employee-files
// Secure file streaming endpoint (Endpoint 7)
// ============================================================
const express = require("express");
const EmployeeFilesService = require("../services/EmployeeFilesService");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

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
