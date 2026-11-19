// ============================================================
// Export Routes — /api/exports
// Dedicated Custom Data Export & Nominal Lists Studio
// ============================================================
const express = require("express");
const { authenticate, hasAnyPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");
const ExportService = require("../services/ExportService");

const router = express.Router();

router.use(authenticate);
router.use(hasAnyPermission(PERMISSIONS.EXPORT, PERMISSIONS.REPORT));

function parseColumnsParam(columns) {
  if (!columns) return [];
  if (Array.isArray(columns)) return columns.map((c) => String(c).trim()).filter(Boolean);
  if (typeof columns === "string") {
    return columns.split(",").map((c) => c.trim()).filter(Boolean);
  }
  return [];
}

/**
 * GET /api/exports/filter-options
 * Cascading filter data scoped to user's geographic permissions
 */
router.get("/filter-options", async (req, res) => {
  const data = await ExportService.getFilterOptions(req.user);
  res.json({ success: true, data });
});

/**
 * GET /api/exports/preview
 * Fetch real-time matching rows (limited to 50) and active columns definition
 */
router.get("/preview", async (req, res) => {
  const { reportType, columns, ...filters } = req.query;
  const result = await ExportService.getPreview(
    reportType || "nominal",
    filters,
    parseColumnsParam(columns),
    req.user
  );
  res.json(result);
});

/**
 * GET /api/exports/excel
 * Stream official RTL Excel workbook formatted for Algerian Public Administration
 */
router.get("/excel", async (req, res, next) => {
  try {
    const { reportType, columns, customTitle, ...filters } = req.query;
    await ExportService.exportCustomExcel(
      reportType || "nominal",
      filters,
      parseColumnsParam(columns),
      customTitle || "",
      req.user,
      res
    );
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    }
  }
});

module.exports = router;
