const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const EmployeesService = require("./EmployeesService"); // To verify access
const CacheService = require("./CacheService");
const fs = require("fs");
const path = require("path");

function parseValidDate(val, fallback) {
  if (!val || val === "null" || val === "undefined") return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

class EmployeeFilesService {
  /**
   * Helper: Resolve physical file path safely inside uploads folder
   */
  static getPhysicalPath(filePath) {
    if (!filePath) return null;
    const uploadsRoot = path.resolve(__dirname, "../../../uploads");
    const cleanRelative = String(filePath).replace(/^[/\\]+/, "").replace(/^uploads[/\\]+/i, "");
    const fullPath = path.resolve(uploadsRoot, cleanRelative);

    if (!fullPath.toLowerCase().startsWith(uploadsRoot.toLowerCase() + path.sep)) {
      throw ApiError.forbidden("Invalid file path.");
    }
    return fullPath;
  }

  static cleanupUploadedFiles(files = []) {
    for (const file of files) {
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {}
      }
    }
  }

  /**
   * Upload and save multiple file records for an employee (Batch Upload)
   */
  static async uploadMultipleFiles(employeeId, files = [], data = {}, requestingUser) {
    let employee;
    try {
      // 1. Verify employee access via Geographic RBAC
      employee = await EmployeesService.getById(employeeId, requestingUser);
    } catch (err) {
      this.cleanupUploadedFiles(files);
      throw err;
    }

    if (!files || files.length === 0) {
      throw ApiError.badRequest("No files provided.");
    }

    const { DocumentName, Category, DocumentDate } = data || {};
    const docDate = parseValidDate(DocumentDate, new Date());
    const category = Category || "ملف التوظيف";

    const createdRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const decodedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const relativePath = `/uploads/employee_documents/${employeeId}/${file.filename}`;

      // If single file and custom DocumentName provided, use it; otherwise fallback to original name
      const recordDocName = (files.length === 1 && DocumentName)
        ? DocumentName
        : (DocumentName && files.length > 1 ? `${DocumentName} (${i + 1})` : decodedOriginalName);

      const newFile = await prisma.employeeFiles.create({
        data: {
          EmployeesId: employeeId,
          DocumentName: recordDocName,
          Category: category,
          DocumentDate: docDate,
          FileName: decodedOriginalName,
          FilePath: relativePath,
          UploadDate: new Date()
        }
      });

      createdRecords.push(newFile);
    }

    // Single audit log for batch operation
    const empLastName = employee.LastName || "";
    const empName = employee.Name || "";
    const empFullName = `${empLastName} ${empName}`.trim();
    const username = requestingUser.userName || requestingUser.fullName;

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "رفع وثائق للموظف",
      description: `تم رفع ${createdRecords.length} وثيقة للموظف '${empFullName}' بواسطة '${username}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return createdRecords;
  }

  /**
   * Get files for a specific employee — paginated, metadata only.
   */
  static async getFilesByEmployee(employeeId, requestingUser, { page = 1, limit = 1000 } = {}) {
    // RBAC check
    await EmployeesService.getById(employeeId, requestingUser);

    const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 1000);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const where = { EmployeesId: employeeId };

    const [total, records] = await Promise.all([
      prisma.employeeFiles.count({ where }),
      prisma.employeeFiles.findMany({
        where,
        select: {
          Id: true,
          DocumentName: true,
          FileName: true,
          FilePath: true,
          Category: true,
          UploadDate: true,
        },
        orderBy: { UploadDate: 'desc' },
        skip,
        take: safeLimit,
      }),
    ]);

    return {
      data: records,
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Securely download a file by document ID.
   * Validates the file exists on disk and prevents path traversal.
   */
  static async downloadFile(docId, requestingUser) {
    const file = await prisma.employeeFiles.findUnique({
      where: { Id: docId },
    });

    if (!file) throw ApiError.notFound("File not found.");

    // RBAC check on the parent employee
    await EmployeesService.getById(file.EmployeesId, requestingUser);

    // Resolve and validate the physical path
    const fullPath = this.getPhysicalPath(file.FilePath);

    if (!fs.existsSync(fullPath)) {
      throw ApiError.notFound("Physical file not found on disk.");
    }

    return { fullPath, fileName: file.FileName || file.DocumentName };
  }

  /**
   * Delete a file
   */
  static async deleteFile(fileId, requestingUser, expectedEmployeeId = null) {
    const file = await prisma.employeeFiles.findUnique({
      where: { Id: fileId },
      include: { Employee: { select: { Id: true, Name: true, LastName: true, Province: true } } }
    });

    if (!file) throw ApiError.notFound("File not found.");
    if (expectedEmployeeId && file.EmployeesId !== Number(expectedEmployeeId)) {
      throw ApiError.forbidden("الوثيقة لا تنتمي لهذا الموظف.");
    }

    // RBAC check on the parent employee
    await EmployeesService.getById(file.EmployeesId, requestingUser);

    // Remove from DB
    await prisma.employeeFiles.delete({ where: { Id: fileId } });

    // Remove from file system
    try {
      const fullPath = this.getPhysicalPath(file.FilePath);
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error("[EmployeeFilesService] Failed to delete physical file:", err.message);
    }

    const empLastName = file.Employee?.LastName || "";
    const empName = file.Employee?.Name || "";
    const empFullName = `${empLastName} ${empName}`.trim();
    const username = requestingUser.userName || requestingUser.fullName;

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف وثيقة موظف",
      description: `تم حذف وثيقة للموظف '${empFullName}' بواسطة '${username}'.`,
      usersId: requestingUser.id,
      employeesId: file.EmployeesId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return { message: "File deleted successfully" };
  }

  /**
   * Bulk delete multiple files by their IDs.
   * Removes physical files from disk and DB records.
   */
  static async bulkDeleteFiles(employeeId, documentIds, requestingUser) {
    if (!documentIds || documentIds.length === 0) {
      throw ApiError.badRequest("No document IDs provided.");
    }

    // RBAC check on the parent employee
    const employee = await EmployeesService.getById(employeeId, requestingUser);

    // Fetch all documents to get file paths before deletion
    const documents = await prisma.employeeFiles.findMany({
      where: {
        Id: { in: documentIds.map(Number) },
        EmployeesId: employeeId,
      },
    });

    if (documents.length === 0) {
      throw ApiError.notFound("No matching documents found.");
    }

    // Delete physical files from disk
    for (const doc of documents) {
      try {
        const fullPath = this.getPhysicalPath(doc.FilePath);
        if (fullPath && fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        console.error(`[EmployeeFilesService] Failed to delete physical file for doc ${doc.Id}:`, err.message);
      }
    }

    // Delete DB records
    await prisma.employeeFiles.deleteMany({
      where: {
        Id: { in: documents.map(d => d.Id) },
        EmployeesId: employeeId,
      },
    });

    // Audit log
    const empLastName = employee.LastName || "";
    const empName = employee.Name || "";
    const empFullName = `${empLastName} ${empName}`.trim();
    const username = requestingUser.userName || requestingUser.fullName;

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف وثيقة موظف",
      description: `تم حذف ${documents.length} وثيقة للموظف '${empFullName}' بواسطة '${username}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return { message: `${documents.length} file(s) deleted successfully.`, count: documents.length };
  }

  /**
   * Update file metadata and optionally replace the file
   */
  static async updateFile(fileId, data, file, requestingUser, expectedEmployeeId = null) {
    const existingFile = await prisma.employeeFiles.findUnique({
      where: { Id: fileId },
      include: { Employee: { select: { Id: true, Name: true, LastName: true, Province: true } } }
    });

    if (!existingFile) {
      this.cleanupUploadedFiles(file ? [file] : []);
      throw ApiError.notFound("File not found.");
    }
    if (expectedEmployeeId && existingFile.EmployeesId !== Number(expectedEmployeeId)) {
      this.cleanupUploadedFiles(file ? [file] : []);
      throw ApiError.forbidden("الوثيقة لا تنتمي لهذا الموظف.");
    }

    // RBAC check
    try {
      await EmployeesService.getById(existingFile.EmployeesId, requestingUser);
    } catch (err) {
      this.cleanupUploadedFiles(file ? [file] : []);
      throw err;
    }

    // Safely destructure data (which is req.body) to prevent crashes if it is undefined or null
    const { DocumentName, Category, DocumentDate } = data || {};

    const updateData = {
      DocumentName: DocumentName || existingFile.DocumentName,
      Category: Category || existingFile.Category,
      DocumentDate: parseValidDate(DocumentDate, existingFile.DocumentDate)
    };

    if (file) {
      const decodedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      updateData.FileName = decodedOriginalName;
      updateData.FilePath = `/uploads/employee_documents/${existingFile.EmployeesId}/${file.filename}`;
      
      // Delete old file from disk if possible
      try {
        const oldFullPath = this.getPhysicalPath(existingFile.FilePath);
        if (oldFullPath && fs.existsSync(oldFullPath)) {
          fs.unlinkSync(oldFullPath);
        }
      } catch (err) {
        console.error("[EmployeeFilesService] Failed to delete old physical file:", err.message);
      }
    }

    const updatedFile = await prisma.employeeFiles.update({
      where: { Id: fileId },
      data: updateData
    });

    const empLastName = existingFile.Employee?.LastName || "";
    const empName = existingFile.Employee?.Name || "";
    const empFullName = `${empLastName} ${empName}`.trim();
    const username = requestingUser.userName || requestingUser.fullName;

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل وثيقة موظف",
      description: `تم تعديل وثيقة '${updatedFile.DocumentName}' للموظف '${empFullName}' بواسطة '${username}'.`,
      usersId: requestingUser.id,
      employeesId: existingFile.EmployeesId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return updatedFile;
  }
}

module.exports = EmployeeFilesService;
