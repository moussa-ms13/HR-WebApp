import apiClient from './apiClient';

class SpecialCasesService {
  static async getAll(page = 1, limit = 25, search = '', province = '', directorate = '') {
    const response = await apiClient.get('/special-cases', {
      params: { page, limit, search, province, directorate }
    });
    return response.data;
  }

  static async getByEmployee(employeeId) {
    const response = await apiClient.get(`/employees/${employeeId}/special-cases`);
    return response.data;
  }

  static async create(employeeId, data) {
    const response = await apiClient.post(`/employees/${employeeId}/special-cases`, data);
    return response.data;
  }

  static async update(employeeId, caseId, data) {
    const response = await apiClient.put(`/employees/${employeeId}/special-cases/${caseId}`, data);
    return response.data;
  }

  static async delete(employeeId, caseId) {
    const response = await apiClient.delete(`/employees/${employeeId}/special-cases/${caseId}`);
    return response.data;
  }
}

export default SpecialCasesService;
