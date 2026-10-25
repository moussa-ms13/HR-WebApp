// ============================================================
// SpecialCases Global Routes — /api/special-cases
// Global paginated list across all employees (RBAC enforced)
// ============================================================
const express = require("express");
const SpecialCasesService = require("../services/SpecialCasesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const prisma = require("../config/database");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/special-cases?page&limit&search&province&directorate&statusFilter&caseType
 */
router.get("/", hasPermission(PERMISSIONS.SPECIAL_CASES), async (req, res) => {
  const { page, limit, search, province, directorate, statusFilter, caseType } = req.query;
  const result = await SpecialCasesService.getAll(
    req.user,
    Number(page) || 1,
    Number(limit) || 25,
    search || "",
    province || "",
    directorate || "",
    statusFilter || "active",
    caseType || ""
  );
  res.json({ success: true, ...result });
});

/**
 * PUT /api/special-cases/:caseId/end
 * End / reintegrate a special case from the global list
 */
router.put("/:caseId/end", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const caseId = Number(req.params.caseId);
  const existing = await prisma.specialCases.findUnique({
    where: { Id: caseId },
    select: { EmployeesId: true },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "الحالة الخاصة غير موجودة" });
  }

  const record = await SpecialCasesService.endCase(
    existing.EmployeesId,
    caseId,
    req.body,
    req.user
  );
  res.json({ success: true, data: record });
});

module.exports = router;
