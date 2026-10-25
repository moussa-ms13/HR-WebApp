// ============================================================
// Export Routes — /api/exports
// Dedicated Custom Data Export & Nominal Lists Studio
// ============================================================
const express = require("express");
const { authenticate } = require("../middleware/auth");
const ExportService = require("../services/ExportService");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/exports/filter-options
 * Cascading filter data scoped to user's geographic permissions
 */
router.get("/filter-options", async (req, res) => {
  try {
    const data = await ExportService.getFilterOptions(req.user);
    res.json({ success: true, data });
  } catch (error) {
    console.error("ExportRoutes.getFilterOptions Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/exports/preview
 * Fetch real-time matching rows (limited to 50) and active columns definition
 */
router.get("/preview", async (req, res) => {
  try {
    const { reportType, columns, ...filters } = req.query;

    let selectedColumns = [];
    if (columns) {
      if (Array.isArray(columns)) selectedColumns = columns;
      else if (typeof columns === "string") {
        selectedColumns = columns.split(",").map((c) => c.trim()).filter(Boolean);
      }
    }

    const result = await ExportService.getPreview(
      reportType || "nominal",
      filters,
      selectedColumns,
      req.user
    );

    res.json(result);
  } catch (error) {
    console.error("ExportRoutes.getPreview Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/exports/excel
 * Stream official RTL Excel workbook formatted for Algerian Public Administration
 */
router.get("/excel", async (req, res) => {
  try {
    const { reportType, columns, customTitle, ...filters } = req.query;

    let selectedColumns = [];
    if (columns) {
      if (Array.isArray(columns)) selectedColumns = columns;
      else if (typeof columns === "string") {
        selectedColumns = columns.split(",").map((c) => c.trim()).filter(Boolean);
      }
    }

    await ExportService.exportCustomExcel(
      reportType || "nominal",
      filters,
      selectedColumns,
      customTitle || "",
      req.user,
      res
    );
  } catch (error) {
    console.error("ExportRoutes.excel Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

module.exports = router;
