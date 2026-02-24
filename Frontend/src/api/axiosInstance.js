import axios from 'axios';

const BASE_URL = 'http://192.168.1.12:5000/api';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;

