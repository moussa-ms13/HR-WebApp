/**
 * Central Employee Utilities
 * Standardizes display formatting of employee names and initials across the application.
 */

/**
 * Strictly formats an employee's display name as "LastName FirstName" (اللقب ثم الاسم)
 * @param {Object} emp - Employee object or employee relation
 * @param {string} [fallback="—"] - Fallback string if no name is available
 * @returns {string} Formatted name e.g. "بوجلة عبد الله"
 */
export function formatEmployeeName(emp, fallback = "—") {
  if (!emp) return fallback;
  const lastName = (emp.LastName || emp.lastName || "").trim();
  const firstName = (emp.Name || emp.firstName || "").trim();
  const combined = [lastName, firstName].filter(Boolean).join(" ").trim();
  return combined || emp.fullName || emp.name || fallback;
}

/**
 * Returns employee initials (First letter of LastName followed by first letter of FirstName)
 * @param {Object} emp - Employee object
 * @param {string} [fallback="م"] - Fallback initial
 * @returns {string} Initials string
 */
export function getEmployeeInitials(emp, fallback = "م") {
  if (!emp) return fallback;
  const lastName = (emp.LastName || emp.lastName || "").trim();
  const firstName = (emp.Name || emp.firstName || "").trim();
  const lastInitial = lastName ? lastName.charAt(0) : "";
  const firstInitial = firstName ? firstName.charAt(0) : "";
  const initials = `${lastInitial}${firstInitial}`.trim();
  if (initials) return initials;
  const full = (emp.fullName || emp.name || "").trim();
  return full ? full.charAt(0) : fallback;
}

/**
 * Resolves static asset and upload URLs seamlessly across environments.
 * @param {string} path - Relative asset path (e.g. /uploads/profiles/xyz.jpg)
 * @returns {string} Full resolved URL
 */
export function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const baseUrl = import.meta.env.VITE_SERVER_URL !== undefined
    ? import.meta.env.VITE_SERVER_URL
    : (import.meta.env.PROD ? '' : 'http://localhost:5000');
  return `${baseUrl}${path}`;
}

export default formatEmployeeName;

