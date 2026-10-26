import apiClient from './apiClient';

class SpecialCasesService {
  static async getAll(
    page = 1,
    limit = 25,
    search = '',
    province = '',
    directorate = '',
    statusFilter = 'temporary_active',
    caseType = '',
    year = ''
  ) {
    const response = await apiClient.get('/special-cases', {
      params: { page, limit, search, province, directorate, statusFilter, caseType, year }
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

  static async endCase(employeeId, caseId, data = {}) {
    const url = employeeId
      ? `/employees/${employeeId}/special-cases/${caseId}/end`
      : `/special-cases/${caseId}/end`;
    const response = await apiClient.put(url, data);
    return response.data;
  }

  static async delete(employeeId, caseId) {
    const response = await apiClient.delete(`/employees/${employeeId}/special-cases/${caseId}`);
    return response.data;
  }
}

export default SpecialCasesService;
