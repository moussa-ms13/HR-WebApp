import axios from 'axios';

// Create Axios instance with environment-aware base URL
// - Development: VITE_API_URL = http://localhost:5000/api  (direct to Express)
// - Production:  VITE_API_URL = /api                       (IIS reverse proxy)
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  maxContentLength: 25 * 1024 * 1024, // 25MB
  maxBodyLength: 25 * 1024 * 1024,    // 25MB
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Unauthorized globally
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
