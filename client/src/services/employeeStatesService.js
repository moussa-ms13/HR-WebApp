import apiClient from './apiClient';

class EmployeeStatesService {
  /**
   * Fetch paginated employee states.
   * @param {number} page 
   * @param {number} limit 
   * @param {string} category 
   */
  static async getAll(page = 1, limit = 20, category = '', search = '', directorate = '', province = '') {
    const response = await apiClient.get('/employee-states', {
      params: { page, limit, category, search, directorate, province }
    });
    return response.data;
  }

  static async getById(id) {
    const response = await apiClient.get(`/employee-states/${id}`);
    return response.data;
  }

  static async create(data) {
    const response = await apiClient.post('/employee-states', data);
    return response.data;
  }

  static async update(id, data) {
    const response = await apiClient.put(`/employee-states/${id}`, data);
    return response.data;
  }

  static async delete(id) {
    const response = await apiClient.delete(`/employee-states/${id}`);
    return response.data;
  }
}

export default EmployeeStatesService;
