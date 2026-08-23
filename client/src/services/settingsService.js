import apiClient from './apiClient';

class SettingsService {
  /**
   * Fetch all settings from the backend.
   */
  static async getAllSettings() {
    const response = await apiClient.get('/settings');
    return response.data; // { success: true, data: { ... } }
  }

  /**
   * Update settings in the backend (Admin only).
   */
  static async updateSettings(newSettings) {
    const response = await apiClient.put('/settings', newSettings);
    return response.data;
  }
}

export default SettingsService;
