// ============================================================
// SystemRecords Routes — /api/system-records
// Admin-only access to audit logs.
// ============================================================
const express = require("express");
const SystemRecordService = require("../services/SystemRecordService");
const { authenticate, hasPermission } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/system-records
 * Query params: page, limit, search
 */
router.get("/", hasPermission("checkBoxSystemRecords"), async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await SystemRecordService.getAll({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search || "",
  });
  // Since our service now returns { success: true, data: records, meta: ... }
  // we just return result directly
  res.json(result);
});

module.exports = router;
