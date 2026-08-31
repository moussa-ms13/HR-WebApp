import apiClient from './apiClient';

class EmployeeService {
  /**
   * Fetch paginated employees with optional search.
   * @param {number} page 
   * @param {number} limit 
   * @param {string} search 
   * @param {string} province 
   */
  static async getAll(page = 1, limit = 20, search = '', province = '', directorate = '', fileStatus = '') {
    const response = await apiClient.get('/employees', {
      params: { page, limit, search, province, directorate, fileStatus }
    });
    return response.data; // Expected: { success, data: [], meta: { total, page, limit, totalPages, totalCompletedFiles } }
  }

  static async getById(id) {
    const response = await apiClient.get(`/employees/${id}`);
    return response.data;
  }

  /**
   * Fetch lightweight profile summary (Profile DTO).
   * Returns core fields + JobTitle only. No arrays.
   */
  static async getSummary(id) {
    const response = await apiClient.get(`/employees/${id}/summary`);
    return response.data;
  }

  static async create(data) {
    const response = await apiClient.post('/employees', data);
    return response.data;
  }

  static async update(id, data) {
    const response = await apiClient.put(`/employees/${id}`, data);
    return response.data;
  }

  static async delete(id) {
    const response = await apiClient.delete(`/employees/${id}`);
    return response.data;
  }

  /**
   * Triggers the download of the Excel export for employees.
   */
  static async exportToExcel() {
    const response = await apiClient.get('/employees/export', {
      responseType: 'blob', // Important for file downloads
    });
    return response;
  }

  // --- Employee Files ---
  
  static async getFiles(employeeId) {
    const response = await apiClient.get(`/employees/${employeeId}/files`);
    return response.data;
  }

  /**
   * Upload file(s) for an employee (Single or Batch).
   * IMPORTANT: Do NOT set Content-Type manually — let the browser 
   * auto-generate the multipart boundary.
   */
  static async uploadFile(employeeId, formData) {
    const response = await apiClient.post(`/employees/${employeeId}/files`, formData);
    return response.data;
  }

  static async uploadFiles(employeeId, formData) {
    const response = await apiClient.post(`/employees/${employeeId}/files`, formData);
    return response.data;
  }

  static async updateFile(employeeId, fileId, data) {
    const response = await apiClient.put(`/employees/${employeeId}/files/${fileId}`, data);
    return response.data;
  }

  static async deleteFile(employeeId, fileId) {
    const response = await apiClient.delete(`/employees/${employeeId}/files/${fileId}`);
    return response.data;
  }

  /**
   * Bulk delete multiple documents for an employee.
   * @param {number} employeeId
   * @param {number[]} documentIds - Array of document IDs to delete
   */
  static async bulkDeleteFiles(employeeId, documentIds) {
    const response = await apiClient.post(`/employees/${employeeId}/files/bulk-delete`, { documentIds });
    return response.data;
  }

  /**
   * Upload a profile image.
   * IMPORTANT: Do NOT set Content-Type manually.
   */
  static async uploadProfileImage(employeeId, formData) {
    const response = await apiClient.post(`/employees/${employeeId}/image`, formData);
    return response.data;
  }

  /**
   * Download a file via the secure download endpoint.
   * Returns an axios response with blob data.
   */
  static async downloadFile(docId) {
    const response = await apiClient.get(`/employee-files/${docId}/download`, {
      responseType: 'blob',
    });
    return response;
  }
}

export default EmployeeService;
