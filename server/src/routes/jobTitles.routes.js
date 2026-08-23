const express = require("express");
const JobTitlesService = require("../services/JobTitlesService");
const { authenticate, hasPermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/job-titles
 */
router.get("/", async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await JobTitlesService.getAll(
    Number(page) || 1, 
    Number(limit) || 100, 
    search || ""
  );
  res.json({ success: true, ...result });
});

/**
 * GET /api/job-titles/:id
 */
router.get("/:id", async (req, res) => {
  const job = await JobTitlesService.getById(Number(req.params.id));
  res.json({ success: true, data: job });
});

/**
 * POST /api/job-titles
 */
router.post("/", hasPermission(PERMISSIONS.ADD), async (req, res) => {
  const job = await JobTitlesService.create(req.body, req.user);
  res.status(201).json({ success: true, data: job });
});

/**
 * PUT /api/job-titles/:id
 */
router.put("/:id", hasPermission(PERMISSIONS.EDIT), async (req, res) => {
  const job = await JobTitlesService.update(Number(req.params.id), req.body, req.user);
  res.json({ success: true, data: job });
});

/**
 * DELETE /api/job-titles/:id
 */
router.delete("/:id", hasPermission(PERMISSIONS.DELETE), async (req, res) => {
  const result = await JobTitlesService.delete(Number(req.params.id), req.user);
  res.json({ success: true, ...result });
});

module.exports = router;
