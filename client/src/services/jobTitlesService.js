import apiClient from './apiClient';

const API_URL = '/job-titles';

class JobTitlesService {
  /**
   * Fetch paginated job titles.
   */
  static async getAll(page = 1, limit = 100, search = '') {
    const response = await apiClient.get(API_URL, {
      params: { page, limit, search }
    });
    return response.data;
  }

  static async getById(id) {
    const response = await apiClient.get(`${API_URL}/${id}`);
    return response.data;
  }

  static async create(data) {
    const response = await apiClient.post(API_URL, data);
    return response.data;
  }

  static async update(id, data) {
    const response = await apiClient.put(`${API_URL}/${id}`, data);
    return response.data;
  }

  static async delete(id) {
    const response = await apiClient.delete(`${API_URL}/${id}`);
    return response.data;
  }
}

export default JobTitlesService;
