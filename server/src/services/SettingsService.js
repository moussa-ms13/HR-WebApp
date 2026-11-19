const prisma = require("../config/database");
const fs = require("fs");
const path = require("path");
const cacheService = require("./CacheService");

const SETTINGS_FILE = path.join(__dirname, "../../settings.json");
const CACHE_KEY = "system_settings_all";

class SettingsService {
  /**
   * Fetch all settings as a key-value map.
   */
  static async getAllSettings() {
    const cached = cacheService.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    try {
      const records = await prisma.systemSettings.findMany();
      const settingsMap = {};
      records.forEach((row) => {
        settingsMap[row.Key] = row.Value;
      });
      cacheService.set(CACHE_KEY, settingsMap);
      return settingsMap;
    } catch (e) {
      // Fallback if table doesn't exist (due to DB permissions)
      console.warn("SystemSettings table not accessible, using fallback settings.json");
      if (fs.existsSync(SETTINGS_FILE)) {
        const fileSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
        cacheService.set(CACHE_KEY, fileSettings);
        return fileSettings;
      }
      return {};
    }
  }

  /**
   * Batch update settings.
   */
  static async updateSettings(newSettings) {
    if (!newSettings || typeof newSettings !== "object" || Array.isArray(newSettings)) return {};

    const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
    const entries = Object.entries(newSettings)
      .filter(([key]) => typeof key === "string" && !FORBIDDEN_KEYS.has(key) && /^[a-zA-Z0-9_.-]{1,100}$/.test(key))
      .slice(0, 50)
      .map(([key, value]) => [key, String(value ?? "").slice(0, 2000)]);

    if (entries.length === 0) {
      return await this.getAllSettings();
    }

    const sanitizedMap = Object.fromEntries(entries);

    try {
      await prisma.$transaction(async (tx) => {
        for (const [key, value] of entries) {
          await tx.systemSettings.upsert({
            where: { Key: key },
            update: { Value: value, UpdatedAt: new Date() },
            create: { Key: key, Value: value },
          });
        }
      });
      cacheService.del(CACHE_KEY);
      return await this.getAllSettings();
    } catch (e) {
      console.warn("SystemSettings table not accessible, writing to fallback settings.json");
      const current = fs.existsSync(SETTINGS_FILE) ? JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) : {};
      const updated = { ...current, ...sanitizedMap };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
      cacheService.del(CACHE_KEY);
      return updated;
    }
  }
}

module.exports = SettingsService;
