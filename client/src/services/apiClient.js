import axios from 'axios';

// Create Axios instance with base URL
const apiClient = axios.create({
  baseURL: '/api', // Pointing to the Node.js backend via IIS reverse proxy
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
