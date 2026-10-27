import { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  api,
  setToken,
  onUnauthorized,
  getPortalToken,
  getPortalUser,
  setPortalAuth,
  clearPortalAuth,
  resolveActivePortal
} from '../api/client';

const Context = createContext(null);

export function AuthProvider({ children }) {
  const [portals, setPortals] = useState({
    student: { user: getPortalUser('student'), initializing: true },
    teacher: { user: getPortalUser('teacher'), initializing: true },
    admin: { user: getPortalUser('admin'), initializing: true }
  });

  useEffect(() => {
    onUnauthorized((error, unauthorizedPortal) => {
      if (unauthorizedPortal && portals[unauthorizedPortal]) {
        clearPortalAuth(unauthorizedPortal);
        setPortals(prev => ({
          ...prev,
          [unauthorizedPortal]: { user: null, initializing: false }
        }));
      } else {
        clearPortalAuth();
        setPortals({
          student: { user: null, initializing: false },
          teacher: { user: null, initializing: false },
          admin: { user: null, initializing: false }
        });
      }
    });

    // Validate active tokens with /auth/me for each portal
    ['student', 'teacher', 'admin'].forEach(p => {
      const token = getPortalToken(p);
      if (token) {
        api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => {
            if (res.data.role === p) {
              setPortalAuth(p, token, res.data);
              setPortals(prev => ({
                ...prev,
                [p]: { user: res.data, initializing: false }
              }));
            } else {
              clearPortalAuth(p);
              setPortals(prev => ({
                ...prev,
                [p]: { user: null, initializing: false }
              }));
            }
          })
          .catch(() => {
            clearPortalAuth(p);
            setPortals(prev => ({
              ...prev,
              [p]: { user: null, initializing: false }
            }));
          });
      } else {
        setPortals(prev => ({
          ...prev,
          [p]: { user: null, initializing: false }
        }));
      }
    });
  }, []);

  async function login(arg1, arg2, arg3) {
    let portal = null;
    let email = '';
    let password = '';
    if (typeof arg1 === 'string' && ['student', 'teacher', 'admin'].includes(arg1)) {
      portal = arg1;
      email = arg2;
      password = arg3;
    } else {
      email = arg1;
      password = arg2;
      portal = arg3 || resolveActivePortal();
    }

    const payload = { email, password };
    if (portal) payload.portal = portal;

    const { data } = await api.post('/auth/login', payload);
    const assignedRole = data.user?.role;

    if (portal && assignedRole !== portal) {
      throw new Error(`This account is not authorized for the ${portal} portal.`);
    }

    const activeP = assignedRole || portal;
    if (activeP) {
      setPortalAuth(activeP, data.access_token, data.user);
      setPortals(prev => ({
        ...prev,
        [activeP]: { user: data.user, initializing: false }
      }));
    }
    setToken(data.access_token);
    return data;
  }

  function logout(targetPortal = null) {
    const p = targetPortal || resolveActivePortal();
    if (p && portals[p]) {
      clearPortalAuth(p);
      setPortals(prev => ({
        ...prev,
        [p]: { user: null, initializing: false }
      }));
    } else {
      clearPortalAuth();
      setPortals({
        student: { user: null, initializing: false },
        teacher: { user: null, initializing: false },
        admin: { user: null, initializing: false }
      });
    }
  }

  return (
    <Context.Provider value={{ portals, login, logout }}>
      {children}
    </Context.Provider>
  );
}

export function useAuth(explicitPortal) {
  const context = useContext(Context);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');

  let portal = explicitPortal;
  try {
    const location = useLocation();
    if (!portal && location?.pathname) {
      portal = resolveActivePortal(location.pathname);
    }
  } catch (_) {}

  const current = portal ? context.portals[portal] : null;

  // Fallback for non-portal components: pick the first logged in user
  const fallbackUser = context.portals.student.user || context.portals.teacher.user || context.portals.admin.user;

  return {
    portal,
    user: current ? current.user : fallbackUser,
    initializing: current ? current.initializing : false,
    portals: context.portals,
    login: (p, email, password) => context.login(p, email, password),
    logout: (p) => context.logout(p || portal)
  };
}

export function PortalGuard({ portal, children }) {
  const { portals } = useContext(Context);
  const current = portals[portal];

  if (!current || current.initializing) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500 text-sm">
        Verifying {portal} portal session…
      </div>
    );
  }

  if (!current.user || current.user.role !== portal) {
    return <Navigate to={`/${portal}/login`} replace />;
  }

  return children;
}

export function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
