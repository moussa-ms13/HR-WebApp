// ============================================================
// Users Routes — /api/users
// All routes require authentication.
// Create/Update/Delete require Admin role OR specific permissions.
// ============================================================
const express = require("express");
const UsersService = require("../services/UsersService");
const { authenticate, authorize } = require("../middleware/auth");
const { ROLES } = require("../config/constants");

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

/**
 * GET /api/users
 * Returns all users (Admin) or only linked users (non-Admin).
 */
router.get("/", async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await UsersService.getAll(
    req.user,
    Number(page) || 1,
    Number(limit) || 50,
    search || ""
  );
  res.json({ success: true, ...result });
});

/**
 * GET /api/users/:id
 * Returns a single user by ID.
 */
router.get("/:id", async (req, res) => {
  const user = await UsersService.getById(Number(req.params.id), req.user);
  res.json({ success: true, data: user });
});

/**
 * POST /api/users
 * Creates a new user. Strictly Admin-only to prevent privilege escalation.
 */
router.post("/", authorize(ROLES.ADMIN), async (req, res) => {
  const user = await UsersService.create(req.body, req.user);
  res.status(201).json({ success: true, data: user });
});

/**
 * PUT /api/users/:id
 * Updates an existing user. Strictly Admin-only.
 */
router.put("/:id", authorize(ROLES.ADMIN), async (req, res) => {
  const user = await UsersService.update(Number(req.params.id), req.body, req.user);
  res.json({ success: true, data: user });
});

/**
 * DELETE /api/users/:id
 * Deletes a user. Strictly Admin-only.
 */
router.delete("/:id", authorize(ROLES.ADMIN), async (req, res) => {
  const result = await UsersService.delete(Number(req.params.id), req.user);
  res.json({ success: true, data: result });
});

module.exports = router;
