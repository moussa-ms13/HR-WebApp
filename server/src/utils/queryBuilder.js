// ============================================================
// queryBuilder.js — Centralized Prisma Query Utilities (DRY)
// Shared pagination, tokenized search, geographic RBAC, and workplace helpers
// ============================================================
const { ROLES, getAllowedProvinces } = require("../config/constants");

/**
 * Sanitizes page and limit numbers and calculates skip offset.
 * @param {number|string} page 
 * @param {number|string} limit 
 * @param {number} maxLimit 
 * @returns {{ safePage: number, safeLimit: number, skip: number }}
 */
function sanitizePagination(page = 1, limit = 25, maxLimit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), maxLimit);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;
  return { safePage, safeLimit, skip };
}

/**
 * Builds a Prisma multi-word tokenized search condition.
 * Every word in the query must match at least one of the conditions provided by buildTokenOrConditions.
 * @param {string} searchQuery
 * @param {function(string): Array<object>} buildTokenOrConditions
 * @returns {object|null}
 */
function buildTokenizedSearch(searchQuery, buildTokenOrConditions) {
  const trimmed = (searchQuery || "").trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  return {
    AND: tokens.map((token) => ({
      OR: buildTokenOrConditions(token),
    })),
  };
}

/**
 * Centralizes geographic RBAC filtering for Prisma where clauses.
 * @param {object} requestingUser
 * @param {string} [requestedProvince]
 * @returns {{ provinceFilter: object|string|null, isForbidden: boolean, allowedProvinces: string[] }}
 */
function resolveGeographicFilter(requestingUser, requestedProvince = "") {
  const isAdmin = requestingUser?.role === ROLES.ADMIN;
  const allowedProvinces = isAdmin
    ? ["الشلف", "تيارت", "تيسمسيلت", "عين الدفلى", "غليزان", "قصر الشلالة"]
    : getAllowedProvinces(requestingUser?.permissions || {});

  const trimmedReq = (requestedProvince || "").trim();

  if (!isAdmin && allowedProvinces.length === 0) {
    return { provinceFilter: { in: [] }, isForbidden: true, allowedProvinces: [] };
  }

  if (trimmedReq) {
    if (isAdmin || allowedProvinces.includes(trimmedReq)) {
      return { provinceFilter: trimmedReq, isForbidden: false, allowedProvinces };
    }
    // User requested a province they do not have permission for
    return { provinceFilter: { in: [] }, isForbidden: true, allowedProvinces };
  }

  // No specific province requested: return all allowed provinces
  return { provinceFilter: { in: allowedProvinces }, isForbidden: false, allowedProvinces };
}

/**
 * Builds a Prisma WHERE object for geographic filtering.
 * @param {object} requestingUser
 * @param {string} [requestedProvince]
 * @param {string} [provinceFieldPath]
 * @returns {object}
 */
function buildGeographicWhere(requestingUser, requestedProvince = "", provinceFieldPath = "Province") {
  const { provinceFilter } = resolveGeographicFilter(requestingUser, requestedProvince);
  return { [provinceFieldPath]: provinceFilter };
}

/**
 * Standard workplace fallback resolution for administrative nominal lists and exports.
 * @param {object} emp
 * @returns {{ resolvedDirectorate: string, workplace: string }}
 */
function resolveEmployeeWorkplace(emp) {
  if (!emp) return { resolvedDirectorate: "—", workplace: "—" };

  const prov = (emp.Province || "").trim();
  const dir = (emp.Directorate || "").trim();
  const pos = (emp.AssignedPosition || "").trim();

  const resolvedDirectorate = dir || pos || prov || "—";

  return { resolvedDirectorate, workplace: resolvedDirectorate };
}

/**
 * Normalizes a workplace/directorate string on input/save.
 * Rejects bare category headers ("مفتشيات أملاك الدولة", "المحافظات العقارية")
 * or normalizes legacy variations ("المديرية الجهوية للاملاك الوطنية", "مديرية مسح الأراضي").
 * @param {string} rawDirectorate
 * @returns {string}
 */
function normalizeWorkplaceValue(rawDirectorate) {
  const dir = String(rawDirectorate || "").trim();
  if (!dir) return "";

  if (dir === "مفتشيات أملاك الدولة") {
    return "مديرية أملاك الدولة";
  }
  if (dir === "المحافظات العقارية") {
    return "مديرية مسح الأراضي والحفظ العقاري";
  }
  if (dir === "المديرية الجهوية للاملاك الوطنية") {
    return "المديرية الجهوية للأملاك الوطنية";
  }
  if (dir === "مديرية مسح الأراضي") {
    return "مديرية مسح الأراضي والحفظ العقاري";
  }
  return dir;
}

/**
 * Builds a Prisma filter condition for Directorate that matches canonical and legacy aliases.
 * @param {string} requestedDirectorate
 * @returns {object|string|undefined}
 */
function buildDirectorateFilter(requestedDirectorate) {
  const dir = String(requestedDirectorate || "").trim();
  if (!dir) return undefined;

  if (
    dir === "مديرية مسح الأراضي والحفظ العقاري" ||
    dir === "مديرية مسح الأراضي"
  ) {
    return { in: ["مديرية مسح الأراضي والحفظ العقاري", "مديرية مسح الأراضي"] };
  }
  if (
    dir === "المديرية الجهوية للأملاك الوطنية" ||
    dir === "المديرية الجهوية للاملاك الوطنية"
  ) {
    return { in: ["المديرية الجهوية للأملاك الوطنية", "المديرية الجهوية للاملاك الوطنية"] };
  }
  return dir;
}

module.exports = {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
  buildGeographicWhere,
  resolveEmployeeWorkplace,
  normalizeWorkplaceValue,
  buildDirectorateFilter,
};
