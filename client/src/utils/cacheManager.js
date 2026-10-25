import { mutate } from 'swr';

/**
 * Checks whether an SWR cache key (string, array, or object) matches a given pattern.
 * Supports string keys, array keys (e.g. ['/api/employees', page, limit, ...]),
 * regexes, and custom matcher functions.
 * 
 * @param {any} key - The SWR cache key being tested
 * @param {string | Function | RegExp} pattern - Pattern or predicate to test against
 * @returns {boolean}
 */
export const matchSWRKey = (key, pattern) => {
  if (!key) return false;

  if (typeof pattern === 'function') {
    try {
      return Boolean(pattern(key));
    } catch {
      return false;
    }
  }

  if (pattern instanceof RegExp) {
    if (typeof key === 'string') return pattern.test(key);
    if (Array.isArray(key)) {
      return key.some(k => typeof k === 'string' && pattern.test(k));
    }
    return false;
  }

  const strPattern = String(pattern);

  if (typeof key === 'string') {
    return key.includes(strPattern);
  }

  if (Array.isArray(key)) {
    return key.some(part => typeof part === 'string' && part.includes(strPattern));
  }

  if (typeof key === 'object') {
    try {
      return JSON.stringify(key).includes(strPattern);
    } catch {
      return false;
    }
  }

  return false;
};

/**
 * Invalidate SWR resources matching any of the specified patterns.
 * Automatically handles string keys, array keys with query/pagination params,
 * and custom patterns.
 * 
 * @param {string | string[] | Function | RegExp} resourcePatterns
 * @param {any} [data] - Optional new cache data (defaults to undefined to force refetch)
 * @param {object} [opts] - SWR mutate options (defaults to { revalidate: true })
 * @returns {Promise<any>}
 */
export const invalidateResources = (
  resourcePatterns,
  data = undefined,
  opts = { revalidate: true }
) => {
  const patterns = Array.isArray(resourcePatterns) ? resourcePatterns : [resourcePatterns];

  return mutate(
    (key) => patterns.some((pattern) => matchSWRKey(key, pattern)),
    data,
    opts
  );
};

/**
 * Refreshes all employee-related caches:
 * - DataGrid / Lists (with any pagination, search, or filter params)
 * - Dashboard stats & charts
 * - Specific employee summary & detail caches if employeeId is provided
 * 
 * @param {string|number} [employeeId]
 * @returns {Promise<any>}
 */
export const refreshEmployees = (employeeId = null) => {
  const patterns = [
    '/employees',
    '/api/employees',
    '/dashboard/stats',
    '/dashboard/employees-by-province',
    '/dashboard/user-kpis',
  ];

  if (employeeId) {
    patterns.push(
      `/employees/${employeeId}`,
      `/employee-careers/${employeeId}`,
      `/degrees/employee/${employeeId}`,
      `special-cases-${employeeId}`,
      `/employee-states/employee/${employeeId}`
    );
  }

  return invalidateResources(patterns);
};

/**
 * Refreshes all leave and employee-state caches:
 * - Leaves / Employee states lists (with any pagination or filters)
 * - Dashboard resumption alerts & stats
 * - Specific employee leave balances & summary if employeeId is provided
 * 
 * @param {string|number} [employeeId]
 * @returns {Promise<any>}
 */
export const refreshLeaves = (employeeId = null) => {
  const patterns = [
    '/employee-states',
    '/api/employee-states',
    '/leaves',
    '/api/leaves',
    '/leave-balances',
    '/api/leave-balances',
    '/dashboard/stats',
    '/dashboard/overdue-resumes',
    '/dashboard/resuming-soon',
    '/dashboard/user-kpis',
  ];

  if (employeeId) {
    patterns.push(
      `/employees/${employeeId}/summary`,
      `/employee-states/employee/${employeeId}`,
      `/leave-balances/employee/${employeeId}`
    );
  }

  return invalidateResources(patterns);
};

/**
 * Refreshes all special cases caches:
 * - Special cases list table
 * - Employee states table
 * - Dashboard overdue/resuming alerts & stats
 * - Specific employee special case history if employeeId is provided
 * 
 * @param {string|number} [employeeId]
 * @returns {Promise<any>}
 */
export const refreshSpecialCases = (employeeId = null) => {
  const patterns = [
    '/special-cases',
    '/api/special-cases',
    '/employee-states',
    '/api/employee-states',
    'special-cases',
    '/dashboard/stats',
    '/dashboard/overdue-resumes',
    '/dashboard/resuming-soon',
    '/dashboard/user-kpis',
  ];

  if (employeeId) {
    patterns.push(
      `special-cases-${employeeId}`,
      `/employees/${employeeId}/summary`
    );
  }

  return invalidateResources(patterns);
};

/**
 * Refreshes all Job Titles and Ranks caches.
 * @returns {Promise<any>}
 */
export const refreshJobTitles = () => {
  return invalidateResources(['/job-titles', '/api/job-titles', '/jobTitles']);
};

/**
 * Refreshes all Users and accounts caches.
 * @returns {Promise<any>}
 */
export const refreshUsers = () => {
  return invalidateResources(['/users', '/api/users']);
};

/**
 * Refreshes all Dashboard stats, charts, and metrics.
 * @returns {Promise<any>}
 */
export const refreshDashboard = () => {
  return invalidateResources(['/dashboard', '/api/dashboard']);
};

/**
 * Refreshes documents and files for a specific employee.
 * @param {string|number} employeeId
 * @returns {Promise<any>}
 */
export const refreshEmployeeFiles = (employeeId) => {
  if (!employeeId) return Promise.resolve();
  return invalidateResources([
    `/employees/${employeeId}/files`,
    `/employees/${employeeId}/summary`,
  ]);
};

/**
 * Refreshes career, ranks, and degree history for a specific employee.
 * @param {string|number} employeeId
 * @returns {Promise<any>}
 */
export const refreshEmployeeCareer = (employeeId) => {
  const patterns = ['/job-titles', '/api/job-titles'];
  if (employeeId) {
    patterns.push(
      `/employee-careers/${employeeId}`,
      `/degrees/employee/${employeeId}`,
      `/employees/${employeeId}/summary`
    );
  }
  return invalidateResources(patterns);
};

/**
 * Unconditional global invalidation across the entire application cache.
 * Forces every mounted SWR hook to revalidate against the server.
 * @returns {Promise<any>}
 */
export const refreshAll = () => {
  return mutate(() => true, undefined, { revalidate: true });
};
