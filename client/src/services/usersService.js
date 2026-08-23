import apiClient from './apiClient';

class UsersService {
  /**
   * Fetch all users
   */
  static async getAll() {
    const response = await apiClient.get('/users');
    return response.data;
  }

  /**
   * Get user by ID
   */
  static async getById(id) {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    const response = await apiClient.post('/users', userData);
    return response.data;
  }

  /**
   * Update an existing user
   */
  static async update(id, userData) {
    const response = await apiClient.put(`/users/${id}`, userData);
    return response.data;
  }

  /**
   * Delete a user
   */
  static async delete(id) {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  }
}

export default UsersService;
