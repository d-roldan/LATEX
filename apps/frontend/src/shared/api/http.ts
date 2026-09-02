import axios from 'axios';
import { clearSessionAndRedirect, getAccessToken } from '../../features/auth/session';
import { repairTextDeep } from '../utils/textEncoding';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    // Los adjuntos se solicitan como Blob. Intentar reparar texto sobre una
    // respuesta binaria la convertía en un objeto vacío y rompía la vista previa.
    if (response.config.responseType !== 'blob' && response.config.responseType !== 'arraybuffer') {
      response.data = repairTextDeep(response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearSessionAndRedirect();
    }

    return Promise.reject(error);
  }
);
