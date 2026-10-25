// ============================================================
// SpecialCasesService — CRUD with Geographic RBAC
// Handles structural cases: انتداب, تحويل, استيداع, استقالة
// Auto-syncs Employee.EmployeeStatus on create/update.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");
const {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
} = require("../utils/queryBuilder");
const CacheService = require("./CacheService");
const { PERMANENT_EXIT_TYPES } = require("../utils/specialCasesConstants");

// Maps case_type -> employee status value
const CASE_TYPE_STATUS_MAP = Object.freeze({
  "نقل": "منقول",
  "انتداب": "منتدب",
  "تحويل": "محوّل",
  "استيداع": "مستودع",
  "في استيداع": "مستودع",
  "استقالة": "مستقيل",
  "تقاعد": "متقاعد",
});

/**
 * Builds Prisma where condition for lifecycle filtering.
 */
function getLifecycleCondition(statusFilter) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tempActiveCondition = {
    CaseType: { notIn: [...PERMANENT_EXIT_TYPES] },
    IsActive: true,
    OR: [{ EndDate: null }, { EndDate: { gte: today } }],
  };

  const permExitCondition = {
    CaseType: { in: [...PERMANENT_EXIT_TYPES] },
    IsActive: true,
  };

  const archivedCondition = {
    OR: [
      { IsActive: false },
      {
        CaseType: { notIn: [...PERMANENT_EXIT_TYPES] },
        EndDate: { not: null, lt: today },
      },
    ],
  };

  switch (statusFilter) {
    case "temporary_active":
      return tempActiveCondition;
    case "permanent_exit":
      return permExitCondition;
    case "archived":
      return archivedCondition;
    case "all":
      return null;
    case "active":
    default:
      return {
        OR: [tempActiveCondition, permExitCondition],
      };
  }
}

class SpecialCasesService {
  /**
   * GET /api/special-cases — global paginated list with RBAC + search + lifecycle + caseType.
   */
  static async getAll(
    requestingUser,
    page = 1,
    limit = 25,
    search = "",
    province = "",
    directorate = "",
    statusFilter = "active",
    caseType = ""
  ) {
    const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

    const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
    if (isForbidden) {
      return {
        data: [],
        meta: {
          total: 0,
          page: safePage,
          limit: safeLimit,
          totalPages: 0,
          counts: { active: 0, temporary_active: 0, permanent_exit: 0, archived: 0, all: 0 },
        },
      };
    }

    const employeeFilter = {
      Province: provinceFilter,
      ...(directorate ? { Directorate: directorate } : {}),
    };

    const baseWhere = {
      Employee: employeeFilter,
      ...(caseType && String(caseType).trim() ? { CaseType: String(caseType).trim() } : {}),
    };

    const tokenSearch = buildTokenizedSearch(search, (token) => [
      { Employee: { LastName: { contains: token } } },
      { Employee: { Name: { contains: token } } },
      { Employee: { NIN: { contains: token } } },
      { CaseType: { contains: token } },
      { Destination: { contains: token } },
      { ReferenceDoc: { contains: token } },
      { Employee: { JobTitle: { RankName: { contains: token } } } },
    ]);
    if (tokenSearch) {
      baseWhere.AND = [...(baseWhere.AND || []), ...tokenSearch.AND];
    }

    const buildWhereForStatus = (status) => {
      const cond = getLifecycleCondition(status);
      if (!cond) return baseWhere;
      return {
        ...baseWhere,
        AND: [...(baseWhere.AND || []), cond],
      };
    };

    const whereClause = buildWhereForStatus(statusFilter);

    const [total, cases, activeCount, tempActiveCount, permExitCount, archivedCount, allCount] =
      await Promise.all([
        prisma.specialCases.count({ where: whereClause }),
        prisma.specialCases.findMany({
          where: whereClause,
          select: {
            Id: true,
            EmployeesId: true,
            CaseType: true,
            StartDate: true,
            EndDate: true,
            Destination: true,
            ReferenceDoc: true,
            IsActive: true,
            CreatedAt: true,
            Employee: { select: { Name: true, LastName: true, Province: true } },
          },
          skip,
          take: safeLimit,
          orderBy: { Id: "desc" },
        }),
        prisma.specialCases.count({ where: buildWhereForStatus("active") }),
        prisma.specialCases.count({ where: buildWhereForStatus("temporary_active") }),
        prisma.specialCases.count({ where: buildWhereForStatus("permanent_exit") }),
        prisma.specialCases.count({ where: buildWhereForStatus("archived") }),
        prisma.specialCases.count({ where: buildWhereForStatus("all") }),
      ]);

    return {
      data: cases,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        counts: {
          active: activeCount,
          temporary_active: tempActiveCount,
          permanent_exit: permExitCount,
          archived: archivedCount,
          all: allCount,
        },
      },
    };
  }

  /**
   * Archive employee's current originating post into PositionHistory before secondment.
   * Runs within an existing transaction context `tx`.
   */
  static async _archiveOriginatingPost(tx, employeesId, data) {
    const employee = await tx.employees.findUnique({
      where: { Id: employeesId },
      select: { Province: true, Directorate: true },
    });
    if (!employee) return;

    const originMeta = JSON.stringify({
      Province: employee.Province,
      Directorate: employee.Directorate,
    });

    const userRef = `انتداب إلى ${data.Destination || ""} بموجب ${data.ReferenceDoc || ""}`.trim();
    const reference = `${userRef} <!-- ORIGIN:${originMeta} -->`;

    await tx.positionHistory.create({
      data: {
        EmployeesId: employeesId,
        PositionName: employee.Directorate || "المقر الأصلي",
        InstallDate: new Date(),
        Reference: reference,
      },
    });
  }

  /**
   * Retrieve the latest archived original post from PositionHistory and restore
   * the employee's original Directorate (and Province).
   * Never touches AssignedPosition (المنصب العالي).
   * Runs within an existing transaction context `tx`.
   */
  static async _restoreOriginatingPost(tx, employeesId) {
    let archivedRecord = await tx.positionHistory.findFirst({
      where: {
        EmployeesId: employeesId,
        Reference: { contains: "انتداب إلى" },
      },
      orderBy: { Id: "desc" },
    });

    if (!archivedRecord) {
      archivedRecord = await tx.positionHistory.findFirst({
        where: { EmployeesId: employeesId },
        orderBy: { Id: "desc" },
      });
    }

    let origin = null;
    if (archivedRecord?.Reference) {
      const match = archivedRecord.Reference.match(/<!--\s*ORIGIN:([\s\S]*?)-->/);
      if (match) {
        try {
          origin = JSON.parse(match[1]);
        } catch (_) { }
      }
    }

    const restoreData = {
      StatusDate: new Date(),
      UpdateDate: new Date(),
    };

    if (origin) {
      if (origin.Province) restoreData.Province = origin.Province;
      if (origin.Directorate !== undefined) restoreData.Directorate = origin.Directorate || "";
    } else if (archivedRecord) {
      const posName =
        archivedRecord.PositionName && archivedRecord.PositionName !== "المقر الأصلي"
          ? archivedRecord.PositionName
          : "";
      if (posName) {
        restoreData.Directorate = posName;
      }
    }

    await tx.employees.update({
      where: { Id: employeesId },
      data: restoreData,
    });

    if (archivedRecord && !archivedRecord.EndDate) {
      await tx.positionHistory.update({
        where: { Id: archivedRecord.Id },
        data: { EndDate: new Date() },
      });
    }
  }


  static async _syncEmployeeStatus(
    tx,
    employeesId,
    caseType,
    {
      destination = null,
      previousCaseType = null,
      startDate = null,
      province = null,
      directorate = null,
    } = {}
  ) {
    const empUpdateData = {
      StatusDate: startDate ? new Date(startDate) : new Date(),
      UpdateDate: new Date(),
    };

    if (caseType === "انتداب") {
      if (province && String(province).trim()) {
        empUpdateData.Province = String(province).trim();
      }
      if (directorate && String(directorate).trim()) {
        empUpdateData.Directorate = String(directorate).trim();
      } else if (destination && String(destination).trim()) {
        empUpdateData.Directorate = String(destination).trim();
      }
    }

    await tx.employees.update({
      where: { Id: employeesId },
      data: empUpdateData,
    });
  }

  /**
   * Re-evaluate employee assignments based on remaining active cases.
   * Runs within an existing transaction context `tx`.
   */
  static async _reinstateEmployeeStatus(tx, employeesId, previousCase = null) {
    // If terminating/deactivating or deleting a Secondment, restore original post from PositionHistory
    if (previousCase?.CaseType === "انتداب") {
      await this._restoreOriginatingPost(tx, employeesId);
    }

    const remainingCase = await tx.specialCases.findFirst({
      where: {
        EmployeesId: employeesId,
        IsActive: true,
      },
      orderBy: { Id: "desc" },
    });

    if (remainingCase) {
      await this._syncEmployeeStatus(tx, employeesId, remainingCase.CaseType, {
        destination: remainingCase.Destination,
        previousCaseType: previousCase?.CaseType,
        startDate: remainingCase.StartDate,
      });
    }
  }

  /**
   * RBAC helper: verify the requesting user can access a given employee.
   */
  static async _verifyAccess(employee, requestingUser) {
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(employee.Province)) {
        throw ApiError.forbidden(`Geographic access denied for province: ${employee.Province}`);
      }
    }
  }

  /**
   * GET /api/employees/:id/special-cases
   * List all special cases for a given employee.
   */
  static async getByEmployee(employeeId, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: { Id: true, Province: true }
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const cases = await prisma.specialCases.findMany({
      where: { EmployeesId: employeeId },
      select: {
        Id: true,
        EmployeesId: true,
        CaseType: true,
        StartDate: true,
        EndDate: true,
        Destination: true,
        ReferenceDoc: true,
        IsActive: true,
        CreatedAt: true,
      },
      orderBy: { Id: "desc" },
    });

    return cases;
  }

  /**
   * POST /api/employees/:id/special-cases
   * Create + auto-sync employee status atomically.
   */
  static async create(employeeId, data, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const isActive = data.IsActive !== undefined ? Boolean(data.IsActive) : true;
    const startDate = data.StartDate ? new Date(data.StartDate) : new Date();
    const endDate = data.EndDate ? new Date(data.EndDate) : null;
    const destination = data.Destination || null;
    const referenceDoc = data.ReferenceDoc || "";

    const record = await prisma.$transaction(
      async (tx) => {
        // When creating an active Secondment ("انتداب"), archive originating post before updating
        if (data.CaseType === "انتداب" && isActive) {
          await this._archiveOriginatingPost(tx, employeeId, {
            Destination: destination,
            ReferenceDoc: referenceDoc,
          });
        }

        const createdCase = await tx.specialCases.create({
          data: {
            EmployeesId: employeeId,
            CaseType: data.CaseType,
            StartDate: startDate,
            EndDate: endDate,
            Destination: destination,
            ReferenceDoc: referenceDoc,
            IsActive: isActive,
          },
        });

        // Auto-sync employee status if case is active
        if (isActive) {
          await this._syncEmployeeStatus(tx, employeeId, data.CaseType, {
            destination,
            startDate,
            province: data.Province,
            directorate: data.Directorate,
          });
        }

        return createdCase;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة حالة خاصة",
      description: `تمت إضافة حالة '${record.CaseType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return record;
  }

  /**
   * PUT /api/employees/:id/special-cases/:caseId
   * Update + re-sync / reinstate employee status atomically.
   */
  static async update(employeeId, caseId, data, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    const newCaseType = data.CaseType ?? existing.CaseType;
    const newStartDate = data.StartDate ? new Date(data.StartDate) : existing.StartDate;
    const newEndDate = data.EndDate !== undefined ? (data.EndDate ? new Date(data.EndDate) : null) : existing.EndDate;
    const newDestination = data.Destination !== undefined ? data.Destination : existing.Destination;
    const newReferenceDoc = data.ReferenceDoc ?? existing.ReferenceDoc;
    const newIsActive = data.IsActive !== undefined ? Boolean(data.IsActive) : existing.IsActive;

    const record = await prisma.$transaction(
      async (tx) => {
        const isTransitioningToSecondment =
          newIsActive &&
          newCaseType === "انتداب" &&
          (!existing.IsActive || existing.CaseType !== "انتداب");

        if (isTransitioningToSecondment) {
          await this._archiveOriginatingPost(tx, employeeId, {
            Destination: newDestination,
            ReferenceDoc: newReferenceDoc,
          });
        }

        const updatedCase = await tx.specialCases.update({
          where: { Id: caseId },
          data: {
            CaseType: newCaseType,
            StartDate: newStartDate,
            EndDate: newEndDate,
            Destination: newDestination,
            ReferenceDoc: newReferenceDoc,
            IsActive: newIsActive,
          },
        });

        if (newIsActive) {
          await this._syncEmployeeStatus(tx, employeeId, newCaseType, {
            destination: newDestination,
            previousCaseType: existing.CaseType,
            startDate: newStartDate,
            province: data.Province,
            directorate: data.Directorate,
          });
        } else {
          // Case was toggled/updated to inactive: reinstate employee status based on remaining active cases (or "نشط")
          await this._reinstateEmployeeStatus(tx, employeeId, existing);
        }

        return updatedCase;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل حالة خاصة",
      description: `تم تعديل حالة '${record.CaseType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return record;
  }

  /**
   * DELETE /api/employees/:id/special-cases/:caseId
   * Delete case and atomically reinstate employee status if active.
   */
  static async delete(employeeId, caseId, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.specialCases.delete({ where: { Id: caseId } });

        if (existing.IsActive) {
          await this._reinstateEmployeeStatus(tx, employeeId, existing);
        }
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف حالة خاصة",
      description: `تم حذف حالة '${existing.CaseType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return { message: "Special case deleted successfully." };
  }

  /**
   * End / Reintegrate a temporary special case (e.g. انتداب, استيداع).
   * Sets IsActive: false, EndDate: data.endDate || new Date(),
   * optionally appends reinstatement reference to ReferenceDoc,
   * restores originating post (if انتداب), and logs SystemRecord.
   */
  static async endCase(employeeId, caseId, data = {}, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    const endDate = data.endDate ? new Date(data.endDate) : new Date();
    let updatedReferenceDoc = existing.ReferenceDoc || "";
    if (data.reinstatementDoc && String(data.reinstatementDoc).trim()) {
      const docNote = `قرار إعادة إدماج: ${String(data.reinstatementDoc).trim()}`;
      updatedReferenceDoc = updatedReferenceDoc ? `${updatedReferenceDoc} | ${docNote}` : docNote;
    }

    const record = await prisma.$transaction(
      async (tx) => {
        const updatedCase = await tx.specialCases.update({
          where: { Id: caseId },
          data: {
            IsActive: false,
            EndDate: endDate,
            ReferenceDoc: updatedReferenceDoc,
          },
        });

        await this._reinstateEmployeeStatus(tx, employeeId, existing);

        return updatedCase;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إنهاء حالة خاصة / إعادة إدماج",
      description: `تم إنهاء حالة '${record.CaseType}' وإعادة إدماج الموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();

    return record;
  }
}

module.exports = SpecialCasesService;
