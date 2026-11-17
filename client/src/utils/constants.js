// Maps permission keys -> Province values stored in the Employees.Province column
export const PROVINCE_MAP = {
  checkBoxProvinceChlef: "الشلف",
  checkBoxProvinceTiaret: "تيارت",
  checkBoxProvinceTissemsilt: "تيسمسيلت",
  checkBoxProvinceAinDefla: "عين الدفلى",
  checkBoxProvinceRelizane: "غليزان",
  checkBoxProvinceKsarChellala: "قصر الشلالة",
};

/**
 * Given a user object (which includes role and permissions), returns an array of province
 * strings the user is allowed to access.
 */
export function getAllowedProvinces(user) {
  if (!user) return [];
  
  // Admins have access to all provinces
  if (user.role === 'Admin') {
    return Object.values(PROVINCE_MAP);
  }

  // Otherwise, filter based on permissions
  const allowed = [];
  for (const [permKey, provinceName] of Object.entries(PROVINCE_MAP)) {
    if (user.permissions?.[permKey] === true) {
      allowed.push(provinceName);
    }
  }
  return allowed;
}

export const PROVINCIAL_AMLAK_BASE = "مديرية أملاك الدولة";
export const PROVINCIAL_MASH_BASE = "مديرية مسح الأراضي والحفظ العقاري";
export const REGIONAL_DIRECTORATE = "المديرية الجهوية للأملاك الوطنية";

/**
 * If `directorate` refers to one of the two provincial headquarters directorates
 * (either bare or with a `(Province)` suffix, or legacy short name), returns its canonical base name;
 * otherwise returns null.
 */
export function getProvincialDirectorateBase(directorate) {
  const dir = String(directorate || "").trim();
  if (!dir) return null;

  if (
    dir === PROVINCIAL_AMLAK_BASE ||
    /^مديرية\s+أملاك\s+الدولة\s*(?:\([^)]*\))?$/.test(dir)
  ) {
    return PROVINCIAL_AMLAK_BASE;
  }

  if (
    dir === PROVINCIAL_MASH_BASE ||
    dir === "مديرية مسح الأراضي" ||
    /^مديرية\s+مسح\s+الأراضي(?:\s+والحفظ\s+العقاري)?\s*(?:\([^)]*\))?$/.test(dir)
  ) {
    return PROVINCIAL_MASH_BASE;
  }

  return null;
}

/**
 * Formats a provincial headquarters directorate to always display ` (${province})`
 * while keeping municipality inspectorates, land registries, and regional directorate unchanged.
 */
export function formatProvincialDirectorate(directorate, province) {
  const dir = String(directorate || "").trim();
  if (!dir) return "";
  if (dir === "المديرية الجهوية للاملاك الوطنية") return REGIONAL_DIRECTORATE;

  const prov = String(province || "").trim();
  const base = getProvincialDirectorateBase(dir);
  if (base) {
    return prov ? `${base} (${prov})` : base;
  }
  return dir;
}

/**
 * Computes the updated Directorate value when the user changes Province in the form:
 * updates the `(Province)` suffix for provincial HQ choices, keeps Regional Directorate if switching to Chlef,
 * and clears province-specific inspectorates/conservations.
 */
export function resolveDirectorateOnProvinceChange(currentDirectorate, newProvince) {
  const dir = String(currentDirectorate || "").trim();
  const nextProv = String(newProvince || "").trim();
  if (!dir) return "";

  const base = getProvincialDirectorateBase(dir);
  if (base) {
    return nextProv ? `${base} (${nextProv})` : base;
  }

  if (dir === REGIONAL_DIRECTORATE || dir === "المديرية الجهوية للاملاك الوطنية") {
    return nextProv === "الشلف" ? REGIONAL_DIRECTORATE : "";
  }

  return "";
}

export const getMofatishiyat = (province) => {
  if (province === "الشلف") return ["مفتشية أملاك الدولة الشلف", "مفتشية أملاك الدولة بوقادير", "مفتشية أملاك الدولة أولاد فارس", "مفتشية أملاك الدولة تنس"];
  if (province === "عين الدفلى") return ["مفتشية أملاك الدولة عين الدفلى", "مفتشية أملاك الدولة العطاف", "مفتشية أملاك الدولة جليدة", "مفتشية أملاك الدولة خميس مليانة", "مفتشية أملاك الدولة جندل", "مفتشية أملاك الدولة الروينة", "مفتشية أملاك الدولة مليانة"];
  if (province === "غليزان" || province === "غيليزان") return ["مفتشية أملاك الدولة غليزان", "مفتشية أملاك الدولة وادي ارهيو", "مفتشية أملاك الدولة زمورة", "مفتشية أملاك الدولة مازونة", "مفتشية أملاك الدولة عمي موسى"];
  if (province === "تيسمسيلت") return ["مفتشية أملاك الدولة تيسمسيلت", "مفتشية أملاك الدولة ثنية الحد", "مفتشية أملاك الدولة برج بونعامة"];
  if (province === "تيارت") return ["مفتشية أملاك الدولة تيارت", "مفتشية أملاك الدولة رحوية", "مفتشية أملاك الدولة مهدية", "مفتشية أملاك الدولة السوقر", "مفتشية أملاك الدولة فرندة", "مفتشية أملاك الدولة قصر الشلالة"];
  if (province === "قصر الشلالة") return ["مفتشية أملاك الدولة قصر الشلالة"];
  return [];
};

export const getMohafathat = (province) => {
  if (province === "الشلف") return ["المحافظة العقارية الشلف", "المحافظة العقارية بوقادير", "المحافظة العقارية أولاد فارس", "المحافظة العقارية وادي الفضة", "المحافظة العقارية تنس"];
  if (province === "عين الدفلى") return ["المحافظة العقارية عين الدفلى", "المحافظة العقارية مليانة", "المحافظة العقارية جليدة", "المحافظة العقارية جندل", "المحافظة العقارية العطاف", "المحافظة العقارية خميس مليانة"];
  if (province === "غليزان" || province === "غيليزان") return ["المحافظة العقارية غليزان", "المحافظة العقارية وادي ارهيو", "المحافظة العقارية زمورة", "المحافظة العقارية مازونة", "المحافظة العقارية عمي موسى"];
  if (province === "تيسمسيلت") return ["المحافظة العقارية تيسمسيلت", "المحافظة العقارية ثنية الحد", "المحافظة العقارية برج بونعامة"];
  if (province === "تيارت") return ["المحافظة العقارية تيارت", "المحافظة العقارية رحوية", "المحافظة العقارية مهدية", "المحافظة العقارية السوقر", "المحافظة العقارية مدروسة", "المحافظة العقارية قصر الشلالة", "المحافظة العقارية فرندة"];
  if (province === "قصر الشلالة") return ["المحافظة العقارية قصر الشلالة"];
  return [];
};
