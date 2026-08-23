import apiClient from './apiClient';

class SystemRecordsService {
  /**
   * Fetch paginated system records.
   */
  static async getAll(page = 1, limit = 50, search = '') {
    const response = await apiClient.get('/system-records', {
      params: { page, limit, search }
    });
    return response.data;
  }
}

export default SystemRecordsService;
