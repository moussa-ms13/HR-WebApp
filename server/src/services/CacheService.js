const NodeCache = require("node-cache");

/**
 * Centralized in-memory cache service wrapping node-cache.
 * Bounded to maxKeys: 1000 to guarantee predictable PM2 memory usage.
 * Standard TTL: 3600 seconds (1 hour), eviction checks every 120 seconds.
 */
class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 120,
      useClones: false,
      maxKeys: 1000,
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, val, ttl) {
    try {
      if (ttl !== undefined) {
        return this.cache.set(key, val, ttl);
      }
      return this.cache.set(key, val);
    } catch (err) {
      // Graceful eviction if maxKeys is reached so API requests never fail with ECACHEFULL
      if (err && err.errorcode === "ECACHEFULL") {
        const keys = this.cache.keys();
        if (keys.length > 0) {
          this.cache.del(keys.slice(0, Math.max(50, Math.floor(keys.length * 0.25))));
        }
        try {
          return ttl !== undefined ? this.cache.set(key, val, ttl) : this.cache.set(key, val);
        } catch (_) {
          return false;
        }
      }
      return false;
    }
  }

  del(key) {
    return this.cache.del(key);
  }

  delByPrefix(prefix) {
    const keys = this.cache.keys();
    const matches = keys.filter((k) => k.startsWith(prefix));
    if (matches.length > 0) {
      this.cache.del(matches);
    }
  }

  flush() {
    this.cache.flushAll();
  }

  /**
   * Unified Cache & State Invalidation Manager (DRY):
   * Clears employee counts, state counts, distinct years, job titles, export lookups/previews,
   * and scoped dashboard analytics caches whenever data is mutated.
   */
  invalidateEmployeeEcosystem() {
    this.delByPrefix("emp_count_");
    this.delByPrefix("state_count_");
    this.delByPrefix("distinct_years_");
    this.delByPrefix("job_titles_");
    this.del("all_job_titles_map");
    this.del("RAW_FILTER_OPTIONS");
    this.delByPrefix("export_");
    this.delByPrefix("dashboard_stats_");
    this.delByPrefix("dashboard_by_province_");
    this.delByPrefix("dashboard_resuming_soon_");
    this.delByPrefix("dashboard_overdue_resumes_");
    this.delByPrefix("dashboard_user_kpis_");

    try {
      const dashboardCtrl = require("../controllers/dashboard.controller");
      if (typeof dashboardCtrl.clearDashboardCache === "function") {
        dashboardCtrl.clearDashboardCache();
      }
    } catch (_) {}
  }
}

module.exports = new CacheService();
