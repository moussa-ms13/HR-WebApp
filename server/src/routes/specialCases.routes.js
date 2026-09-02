// ============================================================
// SpecialCases Routes — /api/employees/:id/special-cases
// CRUD for structural cases (انتداب, تحويل, استيداع, استقالة)
// ============================================================
const express = require("express");
const SpecialCasesService = require("../services/SpecialCasesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

/**
 * GET /api/employees/:id/special-cases
 * List all special cases for a given employee
 */
router.get("/", async (req, res) => {
  const data = await SpecialCasesService.getByEmployee(Number(req.params.id), req.user);
  res.json({ success: true, data });
});

/**
 * POST /api/employees/:id/special-cases
 * Create a new special case + auto-sync employee status
 */
router.post("/", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  const record = await SpecialCasesService.create(Number(req.params.id), req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

/**
 * PUT /api/employees/:id/special-cases/:caseId
 * Update a special case + re-sync employee status
 */
router.put("/:caseId", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const record = await SpecialCasesService.update(
    Number(req.params.id),
    Number(req.params.caseId),
    req.body,
    req.user
  );
  res.json({ success: true, data: record });
});

/**
 * DELETE /api/employees/:id/special-cases/:caseId
 * Delete a special case
 */
router.delete("/:caseId", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await SpecialCasesService.delete(
    Number(req.params.id),
    Number(req.params.caseId),
    req.user
  );
  res.json({ success: true, ...result });
});

module.exports = router;
