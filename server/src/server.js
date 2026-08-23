// ============================================================
// HR-WebApp — Express Server Entry Point
// ============================================================
console.log('--- SERVER RESTARTED AT:', new Date().toISOString(), '---');

require("express-async-errors"); // Must be imported before routes
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");

dotenv.config();

const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true,
  })
);

// Mount file uploads BEFORE express.json() to prevent multipart stream consumption
const employeeFilesRoutes = require('./routes/employeeFiles.routes');
app.use('/api/employees/:id/files', employeeFilesRoutes);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Serve static files (Employee documents, profile images, etc.)
// MUST be after cors middleware
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// Request logging (dev only)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── Health Check ─────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "HR-WebApp API is running.",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────
app.use("/api", routes);

// ─── 404 Handler ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "The requested endpoint does not exist.",
  });
});

// ─── Global Multer Error Handler ──────────────────────────
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    console.error("Multer error:", err.code, "field:", err.field);
    return res.status(400).json({ success: false, message: `Multer Error: ${err.code} on field ${err.field}` });
  }
  next(err);
});

// ─── Centralized Error Handler (must be last) ─────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 HR-WebApp API Server`);
  console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
  console.log(`   Port        : ${PORT}`);
  console.log(`   Health      : http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
