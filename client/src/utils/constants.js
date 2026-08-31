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

export const getMofatishiyat = (province) => {
  if (province === "الشلف") return ["مفتشية أملاك الدولة الشلف", "مفتشية أملاك الدولة بوقادير", "مفتشية أملاك الدولة أولاد فارس", "مفتشية أملاك الدولة تنس"];
  if (province === "عين الدفلى") return ["مفتشية أملاك الدولة عين الدفلى", "مفتشية أملاك الدولة العطاف", "مفتشية أملاك الدولة جليدة", "مفتشية أملاك الدولة خميس مليانة", "مفتشية أملاك الدولة جندل", "مفتشية أملاك الدولة الروينة", "مفتشية أملاك الدولة مليانة"];
  if (province === "غليزان" || province === "غيليزان") return ["مفتشية أملاك الدولة غليزان", "مفتشية أملاك الدولة وادي ارهيو", "مفتشية أملاك الدولة زمورة", "مفتشية أملاك الدولة مازونة", "مفتشية أملاك الدولة عمي موسى"];
  if (province === "تيسمسيلت") return ["مفتشية أملاك الدولة تيسمسيلت", "مفتشية أملاك الدولة ثنية الحد", "مفتشية أملاك الدولة برج بونعامة"];
  if (province === "تيارت") return ["مفتشية أملاك الدولة تيارت", "مفتشية أملاك الدولة رحوية", "مفتشية أملاك الدولة مهدية", "مفتشية أملاك الدولة السوقر", "مفتشية أملاك الدولة فرندة"];
  if (province === "قصر الشلالة") return ["مفتشية أملاك الدولة قصر الشلالة"];
  return [];
};

export const getMohafathat = (province) => {
  if (province === "الشلف") return ["المحافظة العقارية الشلف", "المحافظة العقارية بوقادير", "المحافظة العقارية أولاد فارس", "المحافظة العقارية وادي الفضة", "المحافظة العقارية تنس"];
  if (province === "عين الدفلى") return ["المحافظة العقارية عين الدفلى", "المحافظة العقارية العطاف", "المحافظة العقارية جليدة", "المحافظة العقارية خميس مليانة", "المحافظة العقارية جندل"];
  if (province === "غليزان" || province === "غيليزان") return ["المحافظة العقارية غليزان", "المحافظة العقارية وادي ارهيو", "المحافظة العقارية زمورة", "المحافظة العقارية مازونة", "المحافظة العقارية عمي موسى"];
  if (province === "تيسمسيلت") return ["المحافظة العقارية تيسمسيلت", "المحافظة العقارية ثنية الحد", "المحافظة العقارية برج بونعامة"];
  if (province === "تيارت") return ["المحافظة العقارية تيارت", "المحافظة العقارية رحوية", "المحافظة العقارية مهدية", "المحافظة العقارية السوقر", "المحافظة العقارية مدروسة"];
  if (province === "قصر الشلالة") return ["المحافظة العقارية قصر الشلالة"];
  return [];
};
