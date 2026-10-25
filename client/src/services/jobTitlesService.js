import apiClient from './apiClient';

const API_URL = '/job-titles';

let cachedJobTitles = null;

class JobTitlesService {
  /**
   * Clear in-memory client cache
   */
  static clearCache() {
    cachedJobTitles = null;
  }

  /**
   * Fetch paginated job titles with in-memory caching for default queries.
   */
  static async getAll(page = 1, limit = 100, search = '', options = {}) {
    const isDefault = Number(page) === 1 && Number(limit) === 100 && !search;
    if (isDefault && cachedJobTitles && !options?.forceRefresh) {
      return cachedJobTitles;
    }

    const response = await apiClient.get(API_URL, {
      params: { page, limit, search },
      signal: options?.signal,
    });

    if (isDefault) {
      cachedJobTitles = response.data;
    }

    return response.data;
  }

  static async getById(id) {
    const response = await apiClient.get(`${API_URL}/${id}`);
    return response.data;
  }

  static async create(data) {
    const response = await apiClient.post(API_URL, data);
    this.clearCache();
    return response.data;
  }

  static async update(id, data) {
    const response = await apiClient.put(`${API_URL}/${id}`, data);
    this.clearCache();
    return response.data;
  }

  static async delete(id) {
    const response = await apiClient.delete(`${API_URL}/${id}`);
    this.clearCache();
    return response.data;
  }
}

export default JobTitlesService;
