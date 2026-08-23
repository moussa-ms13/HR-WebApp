// ============================================================
// Route Index — Mounts all API route modules
// ============================================================
const express = require("express");
const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const systemRecordsRoutes = require("./systemRecords.routes");
const employeesRoutes = require("./employees.routes");
const jobTitlesRoutes = require("./jobTitles.routes");
const employeeStatesRoutes = require("./employeeStates.routes");
const dashboardRoutes = require("./dashboard.routes");
const employeeFilesDownloadRoutes = require("./employeeFilesDownload.routes");
const settingsRoutes = require("./settings.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/system-records", systemRecordsRoutes);
router.use("/employees", employeesRoutes);
router.use("/job-titles", jobTitlesRoutes);
router.use("/employee-states", employeeStatesRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/employee-files", employeeFilesDownloadRoutes);
router.use("/settings", settingsRoutes);

module.exports = router;
