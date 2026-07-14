import axios from 'axios';

const BASE_URL = 'https://settlement-appp.onrender.com/api';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15s timeout — prevents infinite hang on Render cold-start
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — consistent error logging
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.log('API Timeout: Request took too long');
    } else if (!error.response) {
      console.log('API Network Error: No response from server');
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

