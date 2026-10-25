const NodeCache = require("node-cache");

/**
 * Centralized in-memory cache service wrapping node-cache.
 * Standard TTL: 3600 seconds (1 hour), eviction checks every 120 seconds.
 */
class CacheService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 120, useClones: false });
  }

  /**
   * Get item from cache
   * @param {string} key
   * @returns {any | undefined}
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Store item in cache
   * @param {string} key
   * @param {any} val
   * @param {number} [ttl] Optional custom TTL in seconds
   * @returns {boolean}
   */
  set(key, val, ttl) {
    if (ttl !== undefined) {
      return this.cache.set(key, val, ttl);
    }
    return this.cache.set(key, val);
  }

  /**
   * Delete item by key
   * @param {string | string[]} key
   * @returns {number}
   */
  del(key) {
    return this.cache.del(key);
  }

  /**
   * Invalidate all keys starting with a given prefix
   * @param {string} prefix
   */
  delByPrefix(prefix) {
    const keys = this.cache.keys();
    const matches = keys.filter((k) => k.startsWith(prefix));
    if (matches.length > 0) {
      this.cache.del(matches);
    }
  }

  /**
   * Flush the entire cache
   */
  flush() {
    this.cache.flushAll();
  }

  /**
   * Unified Cache & State Invalidation Manager (DRY):
   * Clears employee counts, state counts, job titles, export lookups/previews,
   * and dashboard analytics caches whenever an employee, leave, special case, or job title is mutated.
   */
  invalidateEmployeeEcosystem() {
    this.delByPrefix("emp_count_");
    this.delByPrefix("state_count_");
    this.delByPrefix("job_titles_");
    this.del("all_job_titles_map");
    this.del("RAW_FILTER_OPTIONS");
    this.delByPrefix("export_");
    this.del("dashboard_stats");
    this.del("dashboard_by_province");
    this.del("dashboard_resuming_soon");
    this.del("dashboard_overdue_resumes");
    this.delByPrefix("dashboard_user_kpis_");

    // Safe backwards-compatible trigger to any registered controller handlers
    try {
      const dashboardCtrl = require("../controllers/dashboard.controller");
      if (typeof dashboardCtrl.clearDashboardCache === "function") {
        dashboardCtrl.clearDashboardCache();
      }
    } catch (_) {}
  }
}

module.exports = new CacheService();
