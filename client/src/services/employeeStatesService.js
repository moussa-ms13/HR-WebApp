import apiClient from './apiClient';

class EmployeeStatesService {
  /**
   * Fetch paginated employee states.
   */
  static async getAll(page = 1, limit = 25, category = '', search = '', directorate = '', province = '', sortBy = '', sortOrder = '') {
    const response = await apiClient.get('/employee-states', {
      params: { page, limit, category, search, directorate, province, sortBy, sortOrder }
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

  static async resume(id, data) {
    const response = await apiClient.put(`/employee-states/${id}/resume`, data);
    return response.data;
  }
}

export default EmployeeStatesService;
