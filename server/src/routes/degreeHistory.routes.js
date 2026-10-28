// ============================================================
// Degree History Routes — /api/degree-history
// ============================================================
const express = require("express");
const DegreeHistoryController = require("../controllers/degreeHistory.controller");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

/**
 * PUT /api/degree-history/:id
 * Body: { DegreeLevel, EffectiveDate, PromotionDuration/Pace, ReferenceDoc, Notes }
 */
router.put("/:id", hasPermission(PERMISSIONS.EDIT), DegreeHistoryController.update);

/**
 * DELETE /api/degree-history/:id
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), DegreeHistoryController.delete);

module.exports = router;
