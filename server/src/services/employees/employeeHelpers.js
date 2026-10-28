// ============================================================
// employeeHelpers.js — Projections, Data Normalization & Validation (DRY)
// ============================================================
const ApiError = require("../../utils/ApiError");
const {
  transliterateLastName,
  transliterateFirstName,
} = require("../../utils/algerianTransliterator");

/**
 * Minimal ultra-fast select projection for paginated list view
 * Strictly avoids joining heavy history tables or documents
 */
const EMPLOYEE_LIST_SELECT = Object.freeze({
  Id: true,
  Name: true,
  LastName: true,
  LastNameFr: true,
  NameFr: true,
  Gender: true,
  Province: true,
  Directorate: true,
  EmployeeStatus: true,
  AssignedPosition: true,
  IsProfileComplete: true,
  ProfileImagePath: true,
  JobTitleId: true,
});

/**
 * Autocomplete search lookup projection (take 15 max)
 */
const EMPLOYEE_SEARCH_SELECT = Object.freeze({
  Id: true,
  Name: true,
  LastName: true,
  LastNameFr: true,
  NameFr: true,
  Gender: true,
  Province: true,
  Directorate: true,
  EmployeeStatus: true,
});

/**
 * Detailed profile projection for getById
 */
const EMPLOYEE_DETAIL_SELECT = Object.freeze({
  Id: true,
  Name: true,
  LastName: true,
  LastNameFr: true,
  NameFr: true,
  DateOfBirth: true,
  PlaceOfBirth: true,
  Gender: true,
  MaritalStatus: true,
  ProfileImagePath: true,
  Province: true,
  Directorate: true,
  NIN: true,
  SIS: true,
  AssignedPosition: true,
  ConfirmationDate: true,
  Degree: true,
  EmployeeStatus: true,
  InstallationDate: true,
  LastDegreeDate: true,
  JobTitleId: true,
  PositionDate: true,
  StatusDate: true,
  Address: true,
  Email: true,
  NumberOfChildren: true,
  PhoneNumber: true,
  IsProfileComplete: true,
  JobTitle: { select: { Id: true, RankName: true, EmploymentCategory: true } },
  RankHistories: {
    take: 1,
    orderBy: { InstallDate: "desc" },
    select: { Id: true, RankName: true, InstallDate: true },
  },
  PositionHistories: {
    where: { EndDate: null },
    take: 1,
    orderBy: { InstallDate: "desc" },
    select: { Id: true, PositionName: true, InstallDate: true },
  },
  SpecialCases: {
    where: { IsActive: true },
    take: 1,
    orderBy: { Id: "desc" },
    select: {
      Id: true,
      CaseType: true,
      StartDate: true,
      EndDate: true,
      Destination: true,
      ReferenceDoc: true,
      IsActive: true,
    },
  },
});

/**
 * Header summary projection for getSummary
 */
const EMPLOYEE_SUMMARY_SELECT = Object.freeze({
  Id: true,
  Name: true,
  LastName: true,
  LastNameFr: true,
  NameFr: true,
  DateOfBirth: true,
  PlaceOfBirth: true,
  Gender: true,
  MaritalStatus: true,
  ProfileImagePath: true,
  Province: true,
  Directorate: true,
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
  JobTitleId: true,
  LastDegreeDate: true,
  JobTitle: { select: { Id: true, RankName: true, EmploymentCategory: true } },
  RankHistories: {
    take: 1,
    orderBy: { InstallDate: "desc" },
    select: { Id: true, RankName: true, InstallDate: true },
  },
  PositionHistories: {
    where: { EndDate: null },
    take: 1,
    orderBy: { InstallDate: "desc" },
    select: { Id: true, PositionName: true, InstallDate: true },
  },
  SpecialCases: {
    where: { IsActive: true },
    take: 1,
    orderBy: { Id: "desc" },
    select: {
      Id: true,
      CaseType: true,
      StartDate: true,
      EndDate: true,
      Destination: true,
      ReferenceDoc: true,
      IsActive: true,
    },
  },
});

/**
 * Valid sort field mapping to prevent SQL injection or Prisma validation crashes
 */
const SORT_MAPPING = Object.freeze({
  id: "Id",
  Id: "Id",
  jobNumber: "Id",
  JobNumber: "Id",
  name: "Name",
  Name: "Name",
  lastName: "LastName",
  LastName: "LastName",
  nameFr: "NameFr",
  NameFr: "NameFr",
  lastNameFr: "LastNameFr",
  LastNameFr: "LastNameFr",
  province: "Province",
  Province: "Province",
  directorate: "Directorate",
  Directorate: "Directorate",
  status: "EmployeeStatus",
  Status: "EmployeeStatus",
  employeeStatus: "EmployeeStatus",
  EmployeeStatus: "EmployeeStatus",
  isProfileComplete: "IsProfileComplete",
  IsProfileComplete: "IsProfileComplete",
  installationDate: "InstallationDate",
  InstallationDate: "InstallationDate",
  degree: "Degree",
  Degree: "Degree",
  nin: "NIN",
  NIN: "NIN",
});

/**
 * Normalizes French names and performs Algerian transliteration when needed
 * @param {object} data
 * @param {object} [existing]
 * @returns {{ finalLastNameFr: string|null, finalNameFr: string|null }}
 */
function normalizeFrenchNames(data, existing = null) {
  let finalLastNameFr = null;
  if (data.LastNameFr !== undefined) {
    const raw = String(data.LastNameFr || "").trim();
    finalLastNameFr = raw ? raw.toUpperCase() : null;
  } else if (existing?.LastNameFr) {
    finalLastNameFr = existing.LastNameFr;
  } else if (data.LastName && String(data.LastName).trim()) {
    // Auto-transliterate if no French last name was provided
    finalLastNameFr = transliterateLastName(String(data.LastName).trim());
  }

  let finalNameFr = null;
  if (data.NameFr !== undefined) {
    const raw = String(data.NameFr || "").trim();
    finalNameFr = raw ? raw : null;
  } else if (existing?.NameFr) {
    finalNameFr = existing.NameFr;
  } else if (data.Name && String(data.Name).trim()) {
    // Auto-transliterate if no French first name was provided
    finalNameFr = transliterateFirstName(String(data.Name).trim());
  }

  return { finalLastNameFr, finalNameFr };
}

/**
 * Calculates profile completeness based on official civil service completeness standards
 * @param {object} data
 * @param {object} [existing]
 * @returns {boolean}
 */
function computeProfileCompleteness(data, existing = null) {
  // If explicitly provided by UI modal toggle, respect the explicit choice
  if (data.IsProfileComplete !== undefined) {
    return Boolean(data.IsProfileComplete);
  }
  if (data.isProfileComplete !== undefined) {
    return Boolean(data.isProfileComplete);
  }

  const merged = { ...(existing || {}), ...data };
  const hasName = Boolean(merged.Name && String(merged.Name).trim());
  const hasLastName = Boolean(merged.LastName && String(merged.LastName).trim());
  const hasProvince = Boolean(merged.Province && String(merged.Province).trim());
  const hasDirectorate = Boolean(merged.Directorate && String(merged.Directorate).trim());
  const hasJobTitle = Number(merged.JobTitleId) > 0;
  const hasNIN = Boolean(merged.NIN && String(merged.NIN).trim().length >= 10);
  const hasBirth = merged.DateOfBirth && new Date(merged.DateOfBirth).getFullYear() > 1900;
  const hasInstallation = merged.InstallationDate && new Date(merged.InstallationDate).getFullYear() > 1900;

  return Boolean(
    hasName &&
    hasLastName &&
    hasProvince &&
    hasDirectorate &&
    hasJobTitle &&
    hasNIN &&
    hasBirth &&
    hasInstallation
  );
}

/**
 * Validates mandatory employee creation input
 * @param {object} data
 */
function validateEmployeeCreation(data) {
  if (!data.Name || !String(data.Name).trim()) {
    throw ApiError.badRequest("الاسم مطلوب.");
  }
  if (!data.LastName || !String(data.LastName).trim()) {
    throw ApiError.badRequest("اللقب مطلوب.");
  }
  if (!data.Province || !String(data.Province).trim()) {
    throw ApiError.badRequest("الولاية مطلوبة.");
  }
}

/**
 * Enforces statutory status rules:
 * - 'متعاقدون بدوام كلي' & 'متعاقدون بدوام جزئي' -> strictly 'متعاقد'
 * - 'اسلاك مشتركة' & 'أسلاك تقنية (خاصة)' -> strictly 'مرسم' or 'متربص' (defaults to 'مرسم' if 'متعاقد')
 * @param {string} employmentCategory
 * @param {string} [requestedStatus]
 * @returns {string}
 */
function resolveStatutoryStatus(employmentCategory, requestedStatus = "مرسم") {
  const cat = (employmentCategory || "").trim();
  const isContractual =
    cat.includes("متعاقد") ||
    ["متعاقدون بدوام كلي", "متعاقدون بدوام جزئي", "متعاقدين بدوام كلي", "متعاقدين بدوام جزئي"].includes(cat);

  if (isContractual) {
    return "متعاقد";
  }

  // Regular corps
  const status = (requestedStatus || "").trim();
  if (status === "متربص") return "متربص";
  return "مرسم";
}

module.exports = {
  EMPLOYEE_LIST_SELECT,
  EMPLOYEE_SEARCH_SELECT,
  EMPLOYEE_DETAIL_SELECT,
  EMPLOYEE_SUMMARY_SELECT,
  SORT_MAPPING,
  normalizeFrenchNames,
  computeProfileCompleteness,
  validateEmployeeCreation,
  resolveStatutoryStatus,
};
