import { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, setToken } from '../api/client';
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('attendeye_user');
      const token = sessionStorage.getItem('attendeye_token');
      if (saved && token) {
        setToken(token);
        return JSON.parse(saved);
      }
    } catch (_) {}
    return null;
  });

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.access_token);
    setUser(data.user);
    try {
      sessionStorage.setItem('attendeye_token', data.access_token);
      sessionStorage.setItem('attendeye_user', JSON.stringify(data.user));
    } catch (_) {}
  }

  function logout() {
    setToken(null);
    setUser(null);
    try {
      sessionStorage.removeItem('attendeye_token');
      sessionStorage.removeItem('attendeye_user');
    } catch (_) {}
  }

  return <Context.Provider value={{ user, login, logout }}>{children}</Context.Provider>;
}
export function useAuth() { return useContext(Context); }
export function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
