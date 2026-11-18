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

const KNOWN_PROVINCES = ["الشلف", "تيارت", "تيسمسيلت", "عين الدفلى", "غليزان", "قصر الشلالة"];

/**
 * Normalizes a workplace/directorate string on input/save.
 * - Rejects bare category headers ("مفتشيات أملاك الدولة", "المحافظات العقارية")
 * - Normalizes legacy variations ("المديرية الجهوية للاملاك الوطنية", "مديرية مسح الأراضي")
 * - Ensures provincial headquarters include ` (${province})` when `province` is provided,
 *   while leaving municipality inspectorates, land registries, and the regional directorate untouched.
 * @param {string} rawDirectorate
 * @param {string} [province]
 * @returns {string}
 */
function normalizeWorkplaceValue(rawDirectorate, province = "") {
  const dir = String(rawDirectorate || "").trim();
  if (!dir) return "";

  const prov = String(province || "").trim();

  if (dir === "مفتشيات أملاك الدولة") {
    return prov ? `مديرية أملاك الدولة (${prov})` : "مديرية أملاك الدولة";
  }
  if (dir === "المحافظات العقارية") {
    return prov
      ? `مديرية مسح الأراضي والحفظ العقاري (${prov})`
      : "مديرية مسح الأراضي والحفظ العقاري";
  }
  if (dir === "المديرية الجهوية للاملاك الوطنية") {
    return "المديرية الجهوية للأملاك الوطنية";
  }

  // Canonicalize "مديرية أملاك الدولة" or "مديرية أملاك الدولة (...)"
  if (
    dir === "مديرية أملاك الدولة" ||
    /^مديرية\s+أملاك\s+الدولة\s*(?:\([^)]*\))?$/.test(dir)
  ) {
    return prov ? `مديرية أملاك الدولة (${prov})` : dir;
  }

  // Canonicalize short "مديرية مسح الأراضي" or "مديرية مسح الأراضي (...)"
  const shortMashMatch = dir.match(/^مديرية\s+مسح\s+الأراضي\s*\(([^)]+)\)$/);
  if (dir === "مديرية مسح الأراضي" || shortMashMatch) {
    const effectiveProv = prov || (shortMashMatch ? shortMashMatch[1].trim() : "");
    return effectiveProv
      ? `مديرية مسح الأراضي والحفظ العقاري (${effectiveProv})`
      : "مديرية مسح الأراضي والحفظ العقاري";
  }

  // Canonicalize "مديرية مسح الأراضي والحفظ العقاري" or "مديرية مسح الأراضي والحفظ العقاري (...)"
  if (/^مديرية\s+مسح\s+الأراضي\s+والحفظ\s+العقاري\s*(?:\([^)]*\))?$/.test(dir)) {
    return prov ? `مديرية مسح الأراضي والحفظ العقاري (${prov})` : dir;
  }

  return dir;
}

/**
 * Builds a Prisma field-level filter condition for Directorate that matches
 * bare canonical names, legacy aliases, AND `(Province)` suffixed variants.
 * @param {string} requestedDirectorate
 * @returns {object|string|undefined}
 */
function buildDirectorateFilter(requestedDirectorate) {
  const dir = String(requestedDirectorate || "").trim();
  if (!dir) return undefined;

  const amlakMatch = dir.match(/^مديرية\s+أملاك\s+الدولة(?:\s*\(([^)]+)\))?$/);
  if (amlakMatch) {
    const prov = amlakMatch[1]?.trim();
    if (prov) {
      return {
        in: [
          `مديرية أملاك الدولة (${prov})`,
          "مديرية أملاك الدولة",
        ],
      };
    }
    return {
      in: [
        "مديرية أملاك الدولة",
        ...KNOWN_PROVINCES.map((p) => `مديرية أملاك الدولة (${p})`),
      ],
    };
  }

  const mashMatch = dir.match(/^مديرية\s+مسح\s+الأراضي(?:\s+والحفظ\s+العقاري)?(?:\s*\(([^)]+)\))?$/);
  if (mashMatch) {
    const prov = mashMatch[1]?.trim();
    if (prov) {
      return {
        in: [
          `مديرية مسح الأراضي والحفظ العقاري (${prov})`,
          `مديرية مسح الأراضي (${prov})`,
          "مديرية مسح الأراضي والحفظ العقاري",
          "مديرية مسح الأراضي",
        ],
      };
    }
    return {
      in: [
        "مديرية مسح الأراضي والحفظ العقاري",
        "مديرية مسح الأراضي",
        ...KNOWN_PROVINCES.map((p) => `مديرية مسح الأراضي والحفظ العقاري (${p})`),
        ...KNOWN_PROVINCES.map((p) => `مديرية مسح الأراضي (${p})`),
      ],
    };
  }

  if (
    dir === "المديرية الجهوية للأملاك الوطنية" ||
    dir === "المديرية الجهوية للاملاك الوطنية"
  ) {
    return { in: ["المديرية الجهوية للأملاك الوطنية", "المديرية الجهوية للاملاك الوطنية"] };
  }

  if (dir === "المحافظة العقارية الرحوية" || dir === "المحافظة العقارية رحوية") {
    return { in: ["المحافظة العقارية الرحوية", "المحافظة العقارية رحوية"] };
  }

  if (dir === "مفتشية أملاك الدولة الرحوية" || dir === "مفتشية أملاك الدولة رحوية") {
    return { in: ["مفتشية أملاك الدولة الرحوية", "مفتشية أملاك الدولة رحوية"] };
  }

  return dir;
}

/**
 * Builds an Employee-level Prisma WHERE condition for Directorate.
 * Matches BOTH bare canonical names AND any `Directorate (Province)` variant via OR + startsWith.
 * @param {string} requestedDirectorate
 * @returns {object|undefined}
 */
function buildDirectorateCondition(requestedDirectorate) {
  const dir = String(requestedDirectorate || "").trim();
  if (!dir) return undefined;

  const amlakMatch = dir.match(/^مديرية\s+أملاك\s+الدولة(?:\s*\(([^)]+)\))?$/);
  if (amlakMatch) {
    const prov = amlakMatch[1]?.trim();
    if (prov) {
      return {
        OR: [
          { Directorate: `مديرية أملاك الدولة (${prov})` },
          { AND: [{ Directorate: "مديرية أملاك الدولة" }, { Province: prov }] },
          { Directorate: "مديرية أملاك الدولة" },
        ],
      };
    }
    return {
      OR: [
        { Directorate: "مديرية أملاك الدولة" },
        { Directorate: { startsWith: "مديرية أملاك الدولة (" } },
      ],
    };
  }

  const mashMatch = dir.match(/^مديرية\s+مسح\s+الأراضي(?:\s+والحفظ\s+العقاري)?(?:\s*\(([^)]+)\))?$/);
  if (mashMatch) {
    const prov = mashMatch[1]?.trim();
    if (prov) {
      return {
        OR: [
          { Directorate: `مديرية مسح الأراضي والحفظ العقاري (${prov})` },
          { Directorate: `مديرية مسح الأراضي (${prov})` },
          { AND: [{ Directorate: { in: ["مديرية مسح الأراضي والحفظ العقاري", "مديرية مسح الأراضي"] } }, { Province: prov }] },
          { Directorate: "مديرية مسح الأراضي والحفظ العقاري" },
          { Directorate: "مديرية مسح الأراضي" },
        ],
      };
    }
    return {
      OR: [
        { Directorate: "مديرية مسح الأراضي والحفظ العقاري" },
        { Directorate: "مديرية مسح الأراضي" },
        { Directorate: { startsWith: "مديرية مسح الأراضي والحفظ العقاري (" } },
        { Directorate: { startsWith: "مديرية مسح الأراضي (" } },
      ],
    };
  }

  if (
    dir === "المديرية الجهوية للأملاك الوطنية" ||
    dir === "المديرية الجهوية للاملاك الوطنية"
  ) {
    return {
      Directorate: {
        in: ["المديرية الجهوية للأملاك الوطنية", "المديرية الجهوية للاملاك الوطنية"],
      },
    };
  }

  if (dir === "المحافظة العقارية الرحوية" || dir === "المحافظة العقارية رحوية") {
    return {
      Directorate: {
        in: ["المحافظة العقارية الرحوية", "المحافظة العقارية رحوية"],
      },
    };
  }

  if (dir === "مفتشية أملاك الدولة الرحوية" || dir === "مفتشية أملاك الدولة رحوية") {
    return {
      Directorate: {
        in: ["مفتشية أملاك الدولة الرحوية", "مفتشية أملاك الدولة رحوية"],
      },
    };
  }

  return { Directorate: dir };
}

module.exports = {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
  buildGeographicWhere,
  resolveEmployeeWorkplace,
  normalizeWorkplaceValue,
  buildDirectorateFilter,
  buildDirectorateCondition,
};
