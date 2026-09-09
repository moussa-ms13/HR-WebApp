const express = require("express");
const { authenticate, hasPermission } = require("../middleware/auth");
const prisma = require("../config/database");

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/leave-balances/employee/:id/:year
 */
router.get("/employee/:id/:year", async (req, res, next) => {
  try {
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        EmployeeId: Number(req.params.id),
        Year: Number(req.params.year)
      }
    });
    res.json({ success: true, data: balance });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
