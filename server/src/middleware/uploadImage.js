const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

const IMAGES_BASE_DIR = path.resolve(__dirname, "../../../uploads/employee_images");
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(rawId)) {
      return cb(ApiError.badRequest("معرف الموظف غير صالح."));
    }

    const dir = path.resolve(IMAGES_BASE_DIR, rawId);
    if (!dir.toLowerCase().startsWith(IMAGES_BASE_DIR.toLowerCase() + path.sep)) {
      return cb(ApiError.forbidden("مسار التخزين غير مصرح به."));
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + safeExt);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("نوع الملف غير مدعوم. مسموح فقط بالصور (JPEG/PNG/WEBP)."), false);
  }
};

const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB max for profile photo
  fileFilter,
});

module.exports = uploadImage;
