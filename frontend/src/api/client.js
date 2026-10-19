import axios from 'axios';
let accessToken = null;
let unauthorizedHandler = null;

export function setToken(value) { accessToken = value; }
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 300000 });

api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

export function errorText(error) {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map(item => `${item.loc.join('.')}: ${item.msg}`).join('; ');
  return typeof detail === 'string' ? detail : error.message || 'Operation failed';
}

export async function download(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(data);
  const link = document.createElement('a'); link.href = href; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

