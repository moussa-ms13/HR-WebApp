const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

// Configure Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dynamic path: uploads/employee_documents/:id
    const employeeId = req.params.id || "temp";
    const dir = path.join(__dirname, "../../../uploads/employee_documents", String(employeeId));
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Unique filename: Date + random string + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for Documents & Images (PDF, Word, Excel, Images)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream"
  ];

  const allowedExtensions = [
    ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".svg",
    ".doc", ".docx", ".xls", ".xlsx"
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("نوع الملف غير مدعوم. مسموح فقط بـ PDF، Word، Excel، أو صور (JPEG/PNG/WebP)."), false);
  }
};

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB Limit
  fileFilter
});

module.exports = upload;
