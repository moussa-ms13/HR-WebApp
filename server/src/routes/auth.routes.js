// ============================================================
// Auth Routes — /api/auth
// ============================================================
const express = require("express");
const AuthService = require("../services/AuthService");
const { extractClientIp } = require("../utils/requestContext");
const { createRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: "تم تجاوز الحد المسموح لمحاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.",
});

/**
 * POST /api/auth/login
 * Body: { userName, password }
 * Returns: { success, data: { token, user } }
 */
router.post("/login", loginRateLimiter, async (req, res) => {
  const { userName, password } = req.body;
  const ipAddress = extractClientIp(req);
  const result = await AuthService.login(userName, password, ipAddress);
  res.json({ success: true, data: result });
});

module.exports = router;
