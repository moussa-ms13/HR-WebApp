// ============================================================
// Special Cases Helpers — Lifecycle, Archival, Restoration & RBAC
// ============================================================
const prisma = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const CacheService = require("../CacheService");
const { ROLES, getAllowedProvinces } = require("../../config/constants");
const { normalizeWorkplaceValue } = require("../../utils/queryBuilder");
const { PERMANENT_EXIT_TYPES } = require("../../utils/specialCasesConstants");

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
      return { OR: [tempActiveCondition, permExitCondition] };
    default:
      return tempActiveCondition;
  }
}

function getYearCondition(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return null;
  const startOfYear = new Date(y, 0, 1);
  const endOfYear = new Date(y + 1, 0, 1);
  return {
    OR: [
      { StartDate: { gte: startOfYear, lt: endOfYear } },
      { EndDate: { gte: startOfYear, lt: endOfYear } },
    ],
  };
}

async function getDistinctYears() {
  const cacheKey = "distinct_years_special_cases";
  const cached = CacheService.get(cacheKey);
  if (cached) return cached;

  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT YEAR(StartDate) AS y
      FROM SpecialCases
      WHERE StartDate IS NOT NULL
      UNION
      SELECT DISTINCT YEAR(EndDate) AS y
      FROM SpecialCases
      WHERE EndDate IS NOT NULL
      ORDER BY y DESC`;
    const years = rows.map((r) => Number(r.y)).filter((y) => Number.isInteger(y) && y > 0);
    CacheService.set(cacheKey, years, 600);
    return years;
  } catch (_) {
    return [];
  }
}

function assertProvinceAccess(province, requestingUser) {
  if (!province || requestingUser.role === ROLES.ADMIN) return;
  const allowed = getAllowedProvinces(requestingUser);
  if (!allowed.includes(String(province).trim())) {
    throw ApiError.forbidden(`Geographic access denied for province: ${province}`);
  }
}

async function archiveOriginatingPost(tx, employeesId, data, preloadedEmployee = null) {
  const employee =
    preloadedEmployee ||
    (await tx.employees.findUnique({
      where: { Id: employeesId },
      select: { Province: true, Directorate: true },
    }));
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

async function restoreOriginatingPost(tx, employeesId) {
  let archivedRecord = await tx.positionHistory.findFirst({
    where: { EmployeesId: employeesId, Reference: { contains: "انتداب إلى" } },
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
      } catch (_) {}
    }
  }

  const restoreData = { StatusDate: new Date(), UpdateDate: new Date() };

  if (origin) {
    if (origin.Province) restoreData.Province = origin.Province;
    if (origin.Directorate !== undefined) {
      restoreData.Directorate = normalizeWorkplaceValue(
        origin.Directorate || "",
        restoreData.Province || origin.Province || ""
      );
    }
  } else if (archivedRecord) {
    const posName =
      archivedRecord.PositionName && archivedRecord.PositionName !== "المقر الأصلي"
        ? archivedRecord.PositionName
        : "";
    if (posName) restoreData.Directorate = posName;
  }

  await tx.employees.update({ where: { Id: employeesId }, data: restoreData });

  if (archivedRecord && !archivedRecord.EndDate) {
    await tx.positionHistory.update({
      where: { Id: archivedRecord.Id },
      data: { EndDate: new Date() },
    });
  }
}

async function syncEmployeeStatus(
  tx,
  employeesId,
  caseType,
  { destination = null, startDate = null, province = null, directorate = null } = {}
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

  await tx.employees.update({ where: { Id: employeesId }, data: empUpdateData });
}

async function reinstateEmployeeStatus(tx, employeesId, previousCase = null) {
  if (previousCase?.CaseType === "انتداب") {
    await restoreOriginatingPost(tx, employeesId);
  }

  const remainingCase = await tx.specialCases.findFirst({
    where: { EmployeesId: employeesId, IsActive: true },
    orderBy: { Id: "desc" },
  });

  if (remainingCase) {
    await syncEmployeeStatus(tx, employeesId, remainingCase.CaseType, {
      destination: remainingCase.Destination,
      startDate: remainingCase.StartDate,
    });
  }
}

module.exports = {
  getLifecycleCondition,
  getYearCondition,
  getDistinctYears,
  assertProvinceAccess,
  archiveOriginatingPost,
  restoreOriginatingPost,
  syncEmployeeStatus,
  reinstateEmployeeStatus,
};
