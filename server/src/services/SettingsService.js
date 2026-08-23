const prisma = require("../config/database");
const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "../../settings.json");

class SettingsService {
  /**
   * Fetch all settings as a key-value map.
   */
  static async getAllSettings() {
    try {
      const records = await prisma.systemSettings.findMany();
      const settingsMap = {};
      records.forEach((row) => {
        settingsMap[row.Key] = row.Value;
      });
      return settingsMap;
    } catch (e) {
      // Fallback if table doesn't exist (due to DB permissions)
      console.warn("SystemSettings table not accessible, using fallback settings.json");
      if (fs.existsSync(SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      }
      return {};
    }
  }

  /**
   * Batch update settings.
   */
  static async updateSettings(newSettings) {
    if (!newSettings || typeof newSettings !== 'object') return;

    try {
      await prisma.$transaction(async (tx) => {
        for (const [key, value] of Object.entries(newSettings)) {
          await tx.systemSettings.upsert({
            where: { Key: key },
            update: { Value: String(value), UpdatedAt: new Date() },
            create: { Key: key, Value: String(value) },
          });
        }
      });
      return await this.getAllSettings();
    } catch (e) {
      console.warn("SystemSettings table not accessible, writing to fallback settings.json");
      const current = fs.existsSync(SETTINGS_FILE) ? JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) : {};
      const updated = { ...current, ...newSettings };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
      return updated;
    }
  }
}

module.exports = SettingsService;
