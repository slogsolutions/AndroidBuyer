import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BASE_URL}/api`,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // ensure headers object exists
  if (!config.headers) config.headers = {};
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, clear token and navigate to login (only in browser)
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('token');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } catch (e) {
        // ignore any errors manipulating localStorage/window
        // and continue to reject the original error
      }
    }
    return Promise.reject(error);
  }
);

export default api;
