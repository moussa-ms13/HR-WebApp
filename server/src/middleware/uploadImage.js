const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

// Configure Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const employeeId = req.params.id || "temp";
    const dir = path.join(__dirname, "../../../uploads/employee_images", String(employeeId));
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for Images only
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("نوع الملف غير مدعوم. مسموح فقط بالصور (JPEG/PNG/WEBP)."), false);
  }
};

const uploadImage = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB Limit
  fileFilter
});

module.exports = uploadImage;
