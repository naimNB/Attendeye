import axios from 'axios';
let accessToken = null;
let unauthorizedHandler = null;

export function setToken(value) { accessToken = value; }
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

export const AUTH_FAILURE_CODES = new Set([
  'AUTH_REQUIRED',
  'LOGIN_REQUIRED',
  'INVALID_ACCESS_TOKEN',
  'ACCESS_TOKEN_EXPIRED',
  'ACCOUNT_UNAVAILABLE',
]);

export function getErrorCode(error) {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === 'object' && detail.code) {
    return detail.code;
  }
  if (error?.response?.data?.code) {
    return error.response.data.code;
  }
  const headerCode = error?.response?.headers?.['x-error-code'];
  if (headerCode) {
    return headerCode;
  }
  return null;
}

export function isAuthFailure(error) {
  if (error?.response?.status !== 401) return false;
  // If the request was the login attempt itself, incorrect credentials must not trigger logout handler
  if (error.config?.url?.includes('/auth/login')) return false;
  const code = getErrorCode(error);
  if (code) {
    return AUTH_FAILURE_CODES.has(code);
  }
  // Fallback: If status is 401 and not an ephemeral check-in/liveness token route,
  // treat as an authentication failure.
  const url = error.config?.url || '';
  const isCheckinRoute = url.includes('/checkin') || url.includes('/liveness');
  return !isCheckinRoute;
}

export function resolveActivePortal(pathname) {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (path.startsWith('/student')) return 'student';
  if (path.startsWith('/teacher')) return 'teacher';
  if (path.startsWith('/admin')) return 'admin';
  return null;
}

export function getPortalToken(portal) {
  try {
    return sessionStorage.getItem(`attendeye_token_${portal}`);
  } catch (_) {
    return null;
  }
}

export function getPortalUser(portal) {
  try {
    const raw = sessionStorage.getItem(`attendeye_user_${portal}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function setPortalAuth(portal, token, user) {
  try {
    sessionStorage.setItem(`attendeye_token_${portal}`, token);
    sessionStorage.setItem(`attendeye_user_${portal}`, JSON.stringify(user));
  } catch (_) {}
  setToken(token);
}

export function clearPortalAuth(portal) {
  try {
    if (portal) {
      sessionStorage.removeItem(`attendeye_token_${portal}`);
      sessionStorage.removeItem(`attendeye_user_${portal}`);
    } else {
      ['student', 'teacher', 'admin'].forEach(p => {
        sessionStorage.removeItem(`attendeye_token_${p}`);
        sessionStorage.removeItem(`attendeye_user_${p}`);
      });
      sessionStorage.removeItem('attendeye_token');
      sessionStorage.removeItem('attendeye_user');
    }
  } catch (_) {}
}

const baseURL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '/api';
export const api = axios.create({ baseURL, timeout: 300000 });

api.interceptors.request.use(config => {
  if (!config.headers.Authorization) {
    const portal = config.portal || resolveActivePortal();
    let token = portal ? getPortalToken(portal) : null;
    if (!token && accessToken) {
      token = accessToken;
    }
    if (!token) {
      try {
        token = sessionStorage.getItem('attendeye_token');
      } catch (_) {}
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (isAuthFailure(error)) {
      const portal = error.config?.portal || resolveActivePortal();
      clearPortalAuth(portal);
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler(error, portal);
      }
    }
    return Promise.reject(error);
  }
);

export function errorText(error) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map(item => `${item.loc?.join('.') || 'error'}: ${item.msg}`).join('; ');
  if (detail && typeof detail === 'object') return detail.message || detail.code || error?.message || 'Operation failed';
  return typeof detail === 'string' ? detail : error?.message || 'Operation failed';
}

export async function download(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(data);
  const link = document.createElement('a'); link.href = href; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

