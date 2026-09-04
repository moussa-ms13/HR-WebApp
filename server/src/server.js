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

// ─── Process-Level Error Handlers ─────────────────────────
const fatalError = (label, error) => {
  console.error(`[${label}]`, error);
  process.exit(1);
};
process.on("uncaughtException", (error) => fatalError("uncaughtException", error));
process.on("unhandledRejection", (reason) => fatalError("unhandledRejection", reason instanceof Error ? reason : new Error(String(reason))));

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
    origin: [
      process.env.CLIENT_URL,
      'http://10.128.21.97',
      'http://localhost:5173',
      'http://localhost:5174',
    ].filter(Boolean),
    credentials: true,
  })
);

// Mount file uploads BEFORE express.json() to prevent multipart stream consumption
const employeeFilesRoutes = require('./routes/employeeFiles.routes');
app.use('/api/employees/:id/files', employeeFilesRoutes);

app.use(express.json({ limit: "55mb" }));
app.use(express.urlencoded({ extended: true, limit: "55mb" }));

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
const server = app.listen(PORT, () => {
  console.log(`\n🚀 HR-WebApp API Server`);
  console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
  console.log(`   Port        : ${PORT}`);
  console.log(`   Health      : http://localhost:${PORT}/api/health\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ FATAL: Port ${PORT} is already in use.`);
    console.error(`   Run: netstat -ano | findstr ":${PORT}" to find the culprit.`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

// ─── Graceful Shutdown (release port on SIGTERM/SIGINT) ───
const shutdown = (signal) => {
  console.log(`\n⏹ Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("   Server closed. Exiting.");
    process.exit(0);
  });
  // Force exit after 10s if graceful close stalls
  setTimeout(() => process.exit(1), 10000);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;
