const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { authenticate, authorize } = require("../middleware/auth");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.get("/stats", dashboardController.getDashboardStats);
router.get("/employees-by-province", dashboardController.getEmployeesByProvince);
router.get("/resuming-soon", dashboardController.getResumingSoon);
router.get("/overdue-resumes", dashboardController.getOverdueResumes);
router.get("/user-kpis", authorize(ROLES.ADMIN), dashboardController.getUserKpis);

module.exports = router;
