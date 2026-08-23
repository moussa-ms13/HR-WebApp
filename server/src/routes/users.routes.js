// ============================================================
// Users Routes — /api/users
// All routes require authentication.
// Create/Update/Delete require Admin role OR specific permissions.
// ============================================================
const express = require("express");
const UsersService = require("../services/UsersService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

/**
 * GET /api/users
 * Returns all users (Admin) or only linked users (non-Admin).
 */
router.get("/", async (req, res) => {
  const users = await UsersService.getAll(req.user);
  res.json({ success: true, data: users });
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
 * Creates a new user. Requires Admin role or 'checkBoxAdd' permission.
 */
router.post("/", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  const user = await UsersService.create(req.body, req.user);
  res.status(201).json({ success: true, data: user });
});

/**
 * PUT /api/users/:id
 * Updates an existing user. Requires Admin role or 'checkBoxEdit' permission.
 */
router.put("/:id", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const user = await UsersService.update(Number(req.params.id), req.body, req.user);
  res.json({ success: true, data: user });
});

/**
 * DELETE /api/users/:id
 * Deletes a user. Requires Admin role or 'checkBoxDelete' permission.
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await UsersService.delete(Number(req.params.id), req.user);
  res.json({ success: true, data: result });
});

module.exports = router;
