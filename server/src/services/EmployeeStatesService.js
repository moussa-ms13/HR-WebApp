// ============================================================
// EmployeeStatesService — CRUD with Geographic RBAC
// Handles leaves, special cases, and status tracking.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

const clearDashboardCacheSafe = () => {
  try {
    require("../controllers/dashboard.controller").clearDashboardCache?.();
  } catch (_) {
    // controller may not be loaded — ignore
  }
};

class EmployeeStatesService {
  /**
   * Fetch all employee states with pagination and geographic RBAC.
   */
  static async getAll(requestingUser, page = 1, limit = 25, category = "", employeeId = null, search = "", directorate = "", province = "") {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    // Build where clause with geographic filter via Employee relation
    let employeeFilter = employeeId ? { Id: Number(employeeId) } : {};
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (allowedProvinces.length === 0) {
        return { data: [], meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0 } };
      }
      employeeFilter.Province = { in: allowedProvinces };
    }

    // Explicit user-selected Province Filter
    if (province) {
      // Ensure they can only filter by a province they are allowed to see
      if (requestingUser.role === ROLES.ADMIN || employeeFilter.Province?.in?.includes(province)) {
        employeeFilter.Province = province;
      }
    }

    // Directorate Filter (الجهة)
    if (directorate) {
      employeeFilter.Directorate = directorate;
    }

    const whereClause = {
      Employee: employeeFilter,
      ...(category ? { RecordCategory: category } : {}),
    };

    // Search: trim & split to handle full-name queries and trailing spaces
    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
      const searchTerms = trimmedSearch.split(/\s+/);

      if (searchTerms.length >= 2) {
        // Multi-word: try first+last name cross-match, OR full string in related fields
        whereClause.OR = [
          {
            Employee: {
              ...employeeFilter,
              AND: [
                { Name: { contains: searchTerms[0] } },
                { LastName: { contains: searchTerms.slice(1).join(" ") } },
              ],
            },
          },
          {
            Employee: {
              ...employeeFilter,
              AND: [
                { Name: { contains: searchTerms.slice(0, -1).join(" ") } },
                { LastName: { contains: searchTerms[searchTerms.length - 1] } },
              ],
            },
          },
          { StateTypeOrReason: { contains: trimmedSearch } },
          {
            Employee: {
              ...employeeFilter,
              JobTitle: { RankName: { contains: trimmedSearch } },
            },
          },
        ];
        // When using OR with Employee filters, remove the top-level Employee
        delete whereClause.Employee;
      } else {
        // Single word: search Name, LastName, StateTypeOrReason, or JobTitle.RankName
        whereClause.OR = [
          { Employee: { ...employeeFilter, Name: { contains: trimmedSearch } } },
          { Employee: { ...employeeFilter, LastName: { contains: trimmedSearch } } },
          { StateTypeOrReason: { contains: trimmedSearch } },
          {
            Employee: {
              ...employeeFilter,
              JobTitle: { RankName: { contains: trimmedSearch } },
            },
          },
        ];
        delete whereClause.Employee;
      }
    }

    const [total, states] = await Promise.all([
      prisma.employeeStates.count({ where: whereClause }),
      prisma.employeeStates.findMany({
        where: whereClause,
        select: {
          Id: true,
          EmployeesId: true,
          RecordCategory: true,
          CurrentJobTitle: true,
          StateTypeOrReason: true,
          DaysCount: true,
          StartDate: true,
          EndDate: true,
          AddedDate: true,
          IsResumed: true,
          ActualReturnDate: true,
          Employee: {
            select: { Name: true, LastName: true, Province: true }
          }
        },
        skip,
        take: safeLimit,
        orderBy: { Id: "desc" },
      }),
    ]);

    return {
      data: states,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get a single state by ID with RBAC check.
   */
  static async getById(id, requestingUser) {
    const state = await prisma.employeeStates.findUnique({
      where: { Id: id },
      include: { Employee: true },
    });

    if (!state) throw ApiError.notFound(`EmployeeState ${id} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(state.Employee.Province)) {
        throw ApiError.forbidden("Geographic access denied for this state record.");
      }
    }

    return state;
  }

  /**
   * Create a new employee state (leave or special case).
   */
  static async create(data, requestingUser) {
    // Verify the employee exists and user has geographic access
    const employee = await prisma.employees.findUnique({
      where: { Id: data.EmployeesId },
      include: { JobTitle: true },
    });
    if (!employee) throw ApiError.notFound(`Employee ${data.EmployeesId} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(employee.Province)) {
        throw ApiError.forbidden(`Geographic access denied for province: ${employee.Province}`);
      }
    }

    const state = await prisma.employeeStates.create({
      data: {
        EmployeesId: data.EmployeesId,
        RecordCategory: data.RecordCategory,
        CurrentJobTitle: data.CurrentJobTitle || employee.JobTitle?.RankName || "",
        StateTypeOrReason: data.StateTypeOrReason,
        DaysCount: data.DaysCount || 0,
        StartDate: new Date(data.StartDate),
        EndDate: new Date(data.EndDate),
        AddedDate: new Date(),
        UsersId: requestingUser.userName,
        IsResumed: data.IsResumed || false,
        ActualReturnDate: data.ActualReturnDate ? new Date(data.ActualReturnDate) : null,
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Add Employee State",
      description: `${data.RecordCategory}: '${data.StateTypeOrReason}' for '${employee.Name} ${employee.LastName}' by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: data.EmployeesId,
    });

    clearDashboardCacheSafe();

    return state;
  }

  /**
   * Update an existing employee state.
   */
  static async update(id, data, requestingUser) {
    const existing = await this.getById(id, requestingUser); // RBAC checked inside

    const state = await prisma.employeeStates.update({
      where: { Id: id },
      data: {
        RecordCategory: data.RecordCategory ?? existing.RecordCategory,
        CurrentJobTitle: data.CurrentJobTitle ?? existing.CurrentJobTitle,
        StateTypeOrReason: data.StateTypeOrReason ?? existing.StateTypeOrReason,
        DaysCount: data.DaysCount ?? existing.DaysCount,
        StartDate: data.StartDate ? new Date(data.StartDate) : existing.StartDate,
        EndDate: data.EndDate ? new Date(data.EndDate) : existing.EndDate,
        IsResumed: data.IsResumed !== undefined ? data.IsResumed : existing.IsResumed,
        ActualReturnDate: data.ActualReturnDate ? new Date(data.ActualReturnDate) : existing.ActualReturnDate,
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Edit Employee State",
      description: `State '${state.StateTypeOrReason}' updated for employee ID ${state.EmployeesId} by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: state.EmployeesId,
    });

    clearDashboardCacheSafe();

    return state;
  }

  /**
   * Delete an employee state.
   */
  static async delete(id, requestingUser) {
    const existing = await this.getById(id, requestingUser); // RBAC checked inside

    await prisma.employeeStates.delete({ where: { Id: id } });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Delete Employee State",
      description: `State '${existing.StateTypeOrReason}' deleted for employee '${existing.Employee.Name} ${existing.Employee.LastName}' by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
    });

    clearDashboardCacheSafe();

    return { message: "State deleted successfully." };
  }
}

module.exports = EmployeeStatesService;
