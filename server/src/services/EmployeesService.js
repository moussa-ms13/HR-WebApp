// ============================================================
// EmployeesService — Centralized Data Access for Employees
// Handles pagination, search, and Geographic RBAC filtering.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

class EmployeesService {
  /**
   * Fetch paginated and filtered employees based on geographic RBAC.
   */
  static async getAll(requestingUser, page = 1, limit = 25, search = "", province = "", directorate = "", fileStatus = "") {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;
    
    // Base Geographic Filter
    let whereClause = {};
    const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
    
    if (requestingUser.role !== ROLES.ADMIN) {
      if (allowedProvinces.length === 0) {
        // If they are not Admin and have NO provinces checked, they shouldn't see anyone.
        return {
          data: [],
          meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0 }
        };
      }
      whereClause.Province = { in: allowedProvinces };
    }

    // Additional User-Selected Province Filter
    if (province) {
      // Validate that the requested province is within their allowed provinces (unless admin)
      if (requestingUser.role === ROLES.ADMIN || allowedProvinces.includes(province)) {
        whereClause.Province = province;
      }
    }

    // Directorate Filter (الجهة)
    if (directorate) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { Directorate: directorate },
            { Department: directorate }
          ]
        }
      ];
    }

    // File Status Filter (اكتمال الملف)
    if (fileStatus === 'complete') {
      whereClause.IsProfileComplete = true;
    } else if (fileStatus === 'incomplete') {
      whereClause.IsProfileComplete = false;
    }

    // Search Filter: trim & split to handle full-name queries and trailing spaces
    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
      const searchTerms = trimmedSearch.split(/\s+/);
      let searchOrConditions = [];

      if (searchTerms.length >= 2) {
        // Multi-word: cross-match first+last name in both normal and reversed orders
        searchOrConditions.push({
          AND: [
            { Name: { contains: searchTerms[0] } },
            { LastName: { contains: searchTerms.slice(1).join(" ") } },
          ],
        });
        searchOrConditions.push({
          AND: [
            { Name: { contains: searchTerms.slice(0, -1).join(" ") } },
            { LastName: { contains: searchTerms[searchTerms.length - 1] } },
          ],
        });
        // Reversed combinations
        searchOrConditions.push({
          AND: [
            { Name: { contains: searchTerms.slice(1).join(" ") } },
            { LastName: { contains: searchTerms[0] } },
          ],
        });
        searchOrConditions.push({
          AND: [
            { Name: { contains: searchTerms[searchTerms.length - 1] } },
            { LastName: { contains: searchTerms.slice(0, -1).join(" ") } },
          ],
        });
      } 
      
      // Single word or fallback match
      searchOrConditions.push({ Name: { contains: trimmedSearch } });
      searchOrConditions.push({ LastName: { contains: trimmedSearch } });
      searchOrConditions.push({ NIN: { contains: trimmedSearch } });
      searchOrConditions.push({ JobTitle: { RankName: { contains: trimmedSearch } } });

      whereClause.AND = [
        ...(whereClause.AND || []),
        { OR: searchOrConditions }
      ];
    }

    // Execute queries concurrently for performance
    const [total, employees, totalCompletedFiles] = await Promise.all([
      prisma.employees.count({ where: whereClause }),
      prisma.employees.findMany({
        where: whereClause,
        select: {
          Id: true,
          Name: true,
          LastName: true,
          Province: true,
          EmployeeStatus: true,
          IsProfileComplete: true,
        },
        skip,
        take: safeLimit,
        orderBy: { Id: "desc" },
      }),
      prisma.employees.count({ where: { ...whereClause, IsProfileComplete: true } }),
    ]);

    return {
      data: employees,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        totalCompletedFiles,
      }
    };
  }

  static async getById(id, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: id },
      select: {
        Id: true,
        Name: true,
        LastName: true,
        DateOfBirth: true,
        PlaceOfBirth: true,
        Gender: true,
        MaritalStatus: true,
        ProfileImagePath: true,
        Province: true,
        Directorate: true,
        Department: true,
        NIN: true,
        SIS: true,
        AssignedPosition: true,
        ConfirmationDate: true,
        Degree: true,
        EmployeeStatus: true,
        InstallationDate: true,
        JobTitleId: true,
        PositionDate: true,
        StatusDate: true,
        Address: true,
        Email: true,
        NumberOfChildren: true,
        PhoneNumber: true,
        IsProfileComplete: true,
        JobTitle: { select: { Id: true, RankName: true } },
        RankHistories: { take: 1, orderBy: { InstallDate: "desc" }, select: { Id: true, RankName: true, InstallDate: true } },
        PositionHistories: { where: { EndDate: null }, take: 1, orderBy: { InstallDate: "desc" }, select: { Id: true, PositionName: true, InstallDate: true } },
        SpecialCases: { where: { IsActive: true }, take: 1, orderBy: { Id: "desc" }, select: { Id: true, CaseType: true, StartDate: true, EndDate: true, Destination: true, ReferenceDoc: true, IsActive: true } },
      }
    });

    if (!employee) {
      throw ApiError.notFound(`Employee with ID ${id} not found.`);
    }

    // RBAC Check
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(employee.Province)) {
        throw ApiError.forbidden("You do not have geographic access to this employee's province.");
      }
    }

    return employee;
  }

  /**
   * Fetch a lightweight profile summary for the employee header.
   * Restricts payload strictly to core info + current active rank, position, and case.
   */
  static async getSummary(id, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: id },
      select: {
        Id: true,
        Name: true,
        LastName: true,
        DateOfBirth: true,
        PlaceOfBirth: true,
        Gender: true,
        MaritalStatus: true,
        ProfileImagePath: true,
        Province: true,
        Directorate: true,
        Department: true,
        NIN: true,
        SIS: true,
        AssignedPosition: true,
        ConfirmationDate: true,
        Degree: true,
        EmployeeStatus: true,
        InstallationDate: true,
        PositionDate: true,
        Address: true,
        Email: true,
        NumberOfChildren: true,
        PhoneNumber: true,
        IsProfileComplete: true,
        JobTitle: { select: { RankName: true } },
        RankHistories: { take: 1, orderBy: { InstallDate: "desc" }, select: { Id: true, RankName: true, InstallDate: true } },
        PositionHistories: { where: { EndDate: null }, take: 1, orderBy: { InstallDate: "desc" }, select: { Id: true, PositionName: true, InstallDate: true } },
        SpecialCases: { where: { IsActive: true }, take: 1, orderBy: { Id: "desc" }, select: { Id: true, CaseType: true, StartDate: true, EndDate: true, Destination: true, ReferenceDoc: true, IsActive: true } },
      },
    });

    if (!employee) {
      throw ApiError.notFound(`Employee with ID ${id} not found.`);
    }

    // RBAC Check
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(employee.Province)) {
        throw ApiError.forbidden("You do not have geographic access to this employee's province.");
      }
    }

    return employee;
  }

  // ──────────────────────────────────────────────
  // CREATE — Add a new employee
  // ──────────────────────────────────────────────
  static async create(data, requestingUser) {
    // Geographic RBAC Check for Creation
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(data.Province)) {
        throw ApiError.forbidden(`You cannot create employees in the province: ${data.Province}`);
      }
    }

    const now = new Date();
    
    // Auto-generate some required default dates to match existing schema
    const defaultDate = new Date("1900-01-01T00:00:00.000Z");

    const employee = await prisma.employees.create({
      data: {
        Name: data.Name,
        LastName: data.LastName,
        DateOfBirth: data.DateOfBirth ? new Date(data.DateOfBirth) : defaultDate,
        PlaceOfBirth: data.PlaceOfBirth || "",
        Gender: data.Gender || "",
        MaritalStatus: data.MaritalStatus || "",
        ProfileImagePath: data.ProfileImagePath || "",
        Province: data.Province,
        Directorate: data.Directorate || "",
        Department: data.Department || "",
        AddedDate: now,
        UpdateDate: now,
        UsersId: requestingUser.userName,
        NIN: data.NIN || "",
        SIS: data.SIS || "",
        AssignedPosition: data.AssignedPosition || "",
        ConfirmationDate: data.ConfirmationDate ? new Date(data.ConfirmationDate) : null,
        Degree: data.Degree || 0,
        EmployeeStatus: data.EmployeeStatus || "",
        InstallationDate: data.InstallationDate ? new Date(data.InstallationDate) : defaultDate,
        JobTitleId: data.JobTitleId || 0,
        LastDegreeDate: defaultDate,
        PositionDate: data.PositionDate ? new Date(data.PositionDate) : null,
        StatusDate: defaultDate,
        Address: data.Address || "",
        Email: data.Email || "",
        NumberOfChildren: data.NumberOfChildren || 0,
        PhoneNumber: data.PhoneNumber || "",
        IsProfileComplete: data.IsProfileComplete || false,
      }
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Add Employee",
      description: `Employee '${employee.Name} ${employee.LastName}' created by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employee.Id
    });

    return employee;
  }

  // ──────────────────────────────────────────────
  // UPDATE — Edit existing employee
  // ──────────────────────────────────────────────
  static async update(id, data, requestingUser) {
    const existing = await prisma.employees.findUnique({ where: { Id: id } });
    if (!existing) throw ApiError.notFound(`Employee ${id} not found.`);

    // Geographic RBAC Check: Ensure user has access to current province AND new province
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(existing.Province)) {
        throw ApiError.forbidden("You do not have access to edit this employee.");
      }
      if (data.Province && !allowedProvinces.includes(data.Province)) {
        throw ApiError.forbidden(`You cannot move an employee to province: ${data.Province}`);
      }
    }

    const employee = await prisma.employees.update({
      where: { Id: id },
      data: {
        Name: data.Name ?? existing.Name,
        LastName: data.LastName ?? existing.LastName,
        DateOfBirth: data.DateOfBirth ? new Date(data.DateOfBirth) : existing.DateOfBirth,
        PlaceOfBirth: data.PlaceOfBirth ?? existing.PlaceOfBirth,
        Gender: data.Gender ?? existing.Gender,
        MaritalStatus: data.MaritalStatus ?? existing.MaritalStatus,
        Province: data.Province ?? existing.Province,
        Directorate: data.Directorate ?? existing.Directorate,
        Department: data.Department ?? existing.Department,
        UpdateDate: new Date(),
        UsersId: requestingUser.userName, // Log last updater
        NIN: data.NIN ?? existing.NIN,
        SIS: data.SIS ?? existing.SIS,
        AssignedPosition: data.AssignedPosition ?? existing.AssignedPosition,
        ConfirmationDate: data.ConfirmationDate ? new Date(data.ConfirmationDate) : existing.ConfirmationDate,
        Degree: data.Degree ?? existing.Degree,
        EmployeeStatus: data.EmployeeStatus ?? existing.EmployeeStatus,
        InstallationDate: data.InstallationDate ? new Date(data.InstallationDate) : existing.InstallationDate,
        JobTitleId: data.JobTitleId ?? existing.JobTitleId,
        PositionDate: data.PositionDate ? new Date(data.PositionDate) : existing.PositionDate,
        Address: data.Address ?? existing.Address,
        Email: data.Email ?? existing.Email,
        NumberOfChildren: data.NumberOfChildren ?? existing.NumberOfChildren,
        PhoneNumber: data.PhoneNumber ?? existing.PhoneNumber,
        IsProfileComplete: data.IsProfileComplete !== undefined ? data.IsProfileComplete : existing.IsProfileComplete,
      }
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Edit Employee",
      description: `Employee '${employee.Name} ${employee.LastName}' updated by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employee.Id
    });

    return employee;
  }

  // ──────────────────────────────────────────────
  // DELETE — Remove employee (with manual cascade)
  // ──────────────────────────────────────────────
  static async delete(id, requestingUser) {
    const existing = await prisma.employees.findUnique({ where: { Id: id } });
    if (!existing) throw ApiError.notFound(`Employee ${id} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(existing.Province)) {
        throw ApiError.forbidden("You do not have geographic access to delete this employee.");
      }
    }

    // Manual cascade: delete all child records in a single transaction
    // SystemRecords has onDelete: NoAction — must be cleaned up manually
    await prisma.$transaction([
      prisma.systemRecords.deleteMany({ where: { EmployeesId: id } }),
      prisma.employeeFiles.deleteMany({ where: { EmployeesId: id } }),
      prisma.employeesRecords.deleteMany({ where: { EmployeesId: id } }),
      prisma.employeeStates.deleteMany({ where: { EmployeesId: id } }),
      prisma.employees.delete({ where: { Id: id } }),
    ]);

    // Log after deletion (no EmployeesId since the employee is gone)
    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Delete Employee",
      description: `Employee '${existing.Name} ${existing.LastName}' (ID: ${id}) deleted by '${requestingUser.userName}'.`,
      usersId: requestingUser.id
    });

    return { message: "Employee deleted successfully." };
  }

  /**
   * Updates an employee's ProfileImagePath
   */
  static async uploadProfileImage(employeeId, file, requestingUser) {
    const employee = await this.getById(employeeId, requestingUser);

    if (!file) {
      throw ApiError.badRequest("No image provided.");
    }

    const relativePath = `/uploads/employee_images/${employeeId}/${file.filename}`;

    await prisma.employees.update({
      where: { Id: employeeId },
      data: { ProfileImagePath: relativePath }
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Update Profile Image",
      description: `Profile image updated for employee '${employee.Name} ${employee.LastName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId
    });

    return { ProfileImagePath: relativePath };
  }
}

module.exports = EmployeesService;
