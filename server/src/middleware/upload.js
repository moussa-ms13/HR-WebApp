const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

const DOCUMENTS_BASE_DIR = path.resolve(__dirname, "../../../uploads/employee_documents");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".doc", ".docx", ".xls", ".xlsx",
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(rawId)) {
      return cb(ApiError.badRequest("معرف الموظف غير صالح."));
    }

    const dir = path.resolve(DOCUMENTS_BASE_DIR, rawId);
    if (!dir.toLowerCase().startsWith(DOCUMENTS_BASE_DIR.toLowerCase() + path.sep)) {
      return cb(ApiError.forbidden("مسار التخزين غير مصرح به."));
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + safeExt);
  },
});

// Strict filter: extension MUST be in allowlist AND MIME must match (or octet-stream for legacy clients)
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimeAllowed = ALLOWED_MIME_TYPES.has(file.mimetype) || file.mimetype === "application/octet-stream";

  if (ALLOWED_EXTENSIONS.has(ext) && mimeAllowed) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest("نوع الملف غير مدعوم. مسموح فقط بـ PDF، Word، Excel، أو صور (JPEG/PNG/WebP)."),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20, // Max 20 files per batch upload
  },
  fileFilter,
});

module.exports = upload;
