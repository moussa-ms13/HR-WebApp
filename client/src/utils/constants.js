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
