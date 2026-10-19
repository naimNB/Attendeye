import { createContext, useContext, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api, setToken, onUnauthorized } from '../api/client';

const Context = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  function clearAuth() {
    setToken(null);
    setUser(null);
    try {
      sessionStorage.removeItem('attendeye_token');
      sessionStorage.removeItem('attendeye_user');
    } catch (_) {}
  }

  useEffect(() => {
    onUnauthorized(() => {
      clearAuth();
    });

    const token = sessionStorage.getItem('attendeye_token');
    if (token) {
      setToken(token);
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          sessionStorage.setItem('attendeye_user', JSON.stringify(res.data));
        })
        .catch(() => {
          clearAuth();
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, []);

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
    clearAuth();
  }

  if (initializing) {
    return <div className="grid min-h-screen place-items-center text-slate-500 text-sm">Verifying session…</div>;
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
