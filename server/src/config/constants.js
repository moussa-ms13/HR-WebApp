// ============================================================
// Application-wide Constants
// Derived from the existing RafatDB production data
// ============================================================
const ROLES = Object.freeze({
  ADMIN: "Admin",
  USER: "User",
  READ: "Read",
});

const ACTIONS = Object.freeze({
  ADD: "Add",
  EDIT: "Edit",
  DELETE: "Delete",
  LOGIN: "Login",
  LOGOUT: "Logout",
});

const ENTITIES = Object.freeze({
  USERS: "Users",
  ROLES: "Roles",
  EMPLOYEES: "Employees",
  EMPLOYEE_FILES: "EmployeeFiles",
  EMPLOYEES_RECORDS: "EmployeesRecords",
  EMPLOYEE_STATES: "EmployeeStates",
  JOB_TITLES: "JobTitles",
  SYSTEM: "System",
});

// Permission keys exactly as stored in the Roles table
const PERMISSIONS = Object.freeze({
  // CRUD operations
  ADD: "checkBoxAdd",
  DELETE: "checkBoxDelete",
  EDIT: "checkBoxEdit",
  EXPORT: "checkBoxExport",
  PRINT: "checkBoxPrint",
  SEARCH: "checkBoxSearch",
  HOME_SEARCH: "checkBoxHomeSearch",

  // Module access
  HOME: "checkBoxHome",
  JOBS: "checkBoxJobs",
  EMPLOYEES: "checkBoxEmployees",
  USERS: "checkBoxUsers",
  REPORT: "checkBoxReport",
  SETTINGS: "checkBoxSettings",
  LEAVES: "checkBoxLeaves",
  SYSTEM_RECORDS: "checkBoxSystemRecords",

  // Province access
  PROVINCE_CHLEF: "checkBoxProvinceChlef",
  PROVINCE_TIARET: "checkBoxProvinceTiaret",
  PROVINCE_TISSEMSILT: "checkBoxProvinceTissemsilt",
  PROVINCE_AIN_DEFLA: "checkBoxProvinceAinDefla",
  PROVINCE_RELIZANE: "checkBoxProvinceRelizane",
  PROVINCE_KSAR_CHELLALA: "checkBoxProvinceKsarChellala",
});

// Maps permission keys -> Province values stored in the Employees.Province column
// These are the exact province strings used in the legacy WinForms app
const PROVINCE_MAP = Object.freeze({
  [PERMISSIONS.PROVINCE_CHLEF]: "الشلف",
  [PERMISSIONS.PROVINCE_TIARET]: "تيارت",
  [PERMISSIONS.PROVINCE_TISSEMSILT]: "تيسمسيلت",
  [PERMISSIONS.PROVINCE_AIN_DEFLA]: "عين الدفلى",
  [PERMISSIONS.PROVINCE_RELIZANE]: "غليزان",
  [PERMISSIONS.PROVINCE_KSAR_CHELLALA]: "قصر الشلالة",
});

/**
 * Given a user's permissions object, returns an array of province
 * strings the user is allowed to access.
 * Admin users bypass this — callers should check role first.
 */
function getAllowedProvinces(permissions) {
  const allowed = [];
  for (const [permKey, provinceName] of Object.entries(PROVINCE_MAP)) {
    if (permissions[permKey] === true) {
      allowed.push(provinceName);
    }
  }
  return allowed;
}

module.exports = { ROLES, ACTIONS, ENTITIES, PERMISSIONS, PROVINCE_MAP, getAllowedProvinces };
