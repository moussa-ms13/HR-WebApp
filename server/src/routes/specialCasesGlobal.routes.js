// ============================================================
// SpecialCases Global Routes — /api/special-cases
// Global paginated list across all employees (RBAC enforced)
// ============================================================
const express = require("express");
const SpecialCasesService = require("../services/SpecialCasesService");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/special-cases?page&limit&search&province&directorate
 */
router.get("/", async (req, res) => {
  const { page, limit, search, province, directorate } = req.query;
  const result = await SpecialCasesService.getAll(
    req.user,
    Number(page) || 1,
    Number(limit) || 25,
    search || "",
    province || "",
    directorate || ""
  );
  res.json({ success: true, ...result });
});

module.exports = router;
