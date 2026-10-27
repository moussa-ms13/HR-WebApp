import apiClient from './apiClient';

class SystemRecordsService {
  /**
   * Fetch paginated system records.
   */
  static async getAll(page = 1, limit = 25, search = '', action = '', sortBy = 'CreatedDate', sortOrder = 'desc') {
    const response = await apiClient.get('/system-records', {
      params: { page, limit, search, action, sortBy, sortOrder }
    });
    return response.data;
  }
}

export default SystemRecordsService;
