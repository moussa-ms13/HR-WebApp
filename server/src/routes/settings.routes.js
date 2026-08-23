const express = require("express");
const SettingsService = require("../services/SettingsService");
const { authenticate, authorize } = require("../middleware/auth");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/settings
 * Fetch all settings
 */
router.get("/", async (req, res) => {
  const settings = await SettingsService.getAllSettings();
  res.json({ success: true, data: settings });
});

/**
 * PUT /api/settings
 * Update settings (Admin only)
 */
router.put("/", authorize(ROLES.ADMIN), async (req, res) => {
  const updatedSettings = await SettingsService.updateSettings(req.body);
  res.json({ success: true, data: updatedSettings });
});

module.exports = router;
