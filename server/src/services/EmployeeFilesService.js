const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const EmployeesService = require("./EmployeesService"); // To verify access
const fs = require("fs");
const path = require("path");

class EmployeeFilesService {
  /**
   * Helper: Resolve physical file path safely inside uploads folder
   */
  static getPhysicalPath(filePath) {
    if (!filePath) return null;
    const uploadsRoot = path.resolve(__dirname, "../../../uploads");
    const cleanRelative = String(filePath).replace(/^[/\\]+/, "").replace(/^uploads[/\\]+/i, "");
    const fullPath = path.resolve(uploadsRoot, cleanRelative);

    if (!fullPath.toLowerCase().startsWith(uploadsRoot.toLowerCase())) {
      throw ApiError.forbidden("Invalid file path.");
    }
    return fullPath;
  }

  /**
   * Upload and save multiple file records for an employee (Batch Upload)
   */
  static async uploadMultipleFiles(employeeId, files = [], data = {}, requestingUser) {
    // 1. Verify employee access via Geographic RBAC
    const employee = await EmployeesService.getById(employeeId, requestingUser);

    if (!files || files.length === 0) {
      throw ApiError.badRequest("No files provided.");
    }

    const { DocumentName, Category, DocumentDate } = data || {};
    const docDate = DocumentDate ? new Date(DocumentDate) : new Date();
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
    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Upload Documents",
      description: `Uploaded ${createdRecords.length} document(s) for employee '${employee.Name} ${employee.LastName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId
    });

    return createdRecords;
  }

  /**
   * Upload and save a single file record for an employee
   */
  static async uploadFile(employeeId, file, data, requestingUser) {
    const results = await this.uploadMultipleFiles(employeeId, file ? [file] : [], data, requestingUser);
    return results[0];
  }

  /**
   * Get all files for a specific employee — metadata only, no file bytes or paths.
   */
  static async getFilesByEmployee(employeeId, requestingUser) {
    // RBAC check
    await EmployeesService.getById(employeeId, requestingUser);

    const records = await prisma.employeeFiles.findMany({
      where: { EmployeesId: employeeId },
      select: {
        Id: true,
        DocumentName: true,
        FileName: true,
        FilePath: true,
        Category: true,
        UploadDate: true,
      },
      orderBy: { UploadDate: 'desc' }
    });

    return records.map(file => {
      let isMissing = false;
      try {
        if (file.FilePath) {
          const fullPath = this.getPhysicalPath(file.FilePath);
          if (!fs.existsSync(fullPath)) {
            isMissing = true;
          }
        }
      } catch (err) {
        isMissing = true; // Flag as missing if path resolution or fs fails
      }
      return { ...file, isMissing };
    });
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
  static async deleteFile(fileId, requestingUser) {
    const file = await prisma.employeeFiles.findUnique({
      where: { Id: fileId },
      include: { Employee: true }
    });

    if (!file) throw ApiError.notFound("File not found.");

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

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Delete Document",
      description: `Document '${file.DocumentName}' deleted for employee '${file.Employee.Name}'.`,
      usersId: requestingUser.id,
      employeesId: file.EmployeesId
    });

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
    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Delete Document",
      description: `Bulk deleted ${documents.length} document(s) for employee '${employee.Name} ${employee.LastName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return { message: `${documents.length} file(s) deleted successfully.`, count: documents.length };
  }

  /**
   * Update file metadata and optionally replace the file
   */
  static async updateFile(fileId, data, file, requestingUser) {
    const existingFile = await prisma.employeeFiles.findUnique({
      where: { Id: fileId },
      include: { Employee: true }
    });

    if (!existingFile) throw ApiError.notFound("File not found.");

    // RBAC check
    await EmployeesService.getById(existingFile.EmployeesId, requestingUser);

    // Safely destructure data (which is req.body) to prevent crashes if it is undefined or null
    const { DocumentName, Category, DocumentDate } = data || {};

    const updateData = {
      DocumentName: DocumentName || existingFile.DocumentName,
      Category: Category || existingFile.Category,
      DocumentDate: DocumentDate ? new Date(DocumentDate) : existingFile.DocumentDate
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

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Update Document",
      description: `Document '${updatedFile.DocumentName}' updated for Employee: ${existingFile.Employee.Name}.`,
      usersId: requestingUser.id,
      employeesId: existingFile.EmployeesId
    });

    return updatedFile;
  }
}

module.exports = EmployeeFilesService;
