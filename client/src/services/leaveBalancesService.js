import apiClient from './apiClient';

/**
 * Leave Balances Service
 * Handles API calls for managing employee annual leave balances and leave debt records.
 */
class LeaveBalancesService {
  /**
   * Fetch all leave balances for a specific employee.
   * @param {number|string} employeeId
   * @returns {Promise<{ success: boolean, data: Array }>}
   */
  static async getEmployeeBalances(employeeId) {
    const response = await apiClient.get(`/leave-balances/employee/${employeeId}/leave-balances`);
    return response.data;
  }

  /**
   * Create or update a leave balance record for a specific employee and year.
   * @param {number|string} employeeId
   * @param {{ year: number, totalDays: number, remainingDays: number, notes?: string }} data
   * @returns {Promise<{ success: boolean, data: Object, message: string }>}
   */
  static async upsertBalance(employeeId, data) {
    const response = await apiClient.post(`/leave-balances/employee/${employeeId}`, data);
    return response.data;
  }

  /**
   * Delete a leave balance record for a specific employee and year.
   * @param {number|string} employeeId
   * @param {number|string} year
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  static async deleteBalance(employeeId, year) {
    const response = await apiClient.delete(`/leave-balances/employee/${employeeId}/${year}`);
    return response.data;
  }
}

export const getEmployeeBalances = LeaveBalancesService.getEmployeeBalances;
export const upsertBalance = LeaveBalancesService.upsertBalance;
export const deleteBalance = LeaveBalancesService.deleteBalance;

export default LeaveBalancesService;
