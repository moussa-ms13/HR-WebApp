// ============================================================
// Auth Routes — /api/auth
// ============================================================
const express = require("express");
const AuthService = require("../services/AuthService");

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { userName, password }
 * Returns: { success, data: { token, user } }
 */
router.post("/login", async (req, res) => {
  const { userName, password } = req.body;
  const result = await AuthService.login(userName, password);
  res.json({ success: true, data: result });
});

module.exports = router;
