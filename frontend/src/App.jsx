import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, PortalGuard, useAuth } from './components/Auth';
import PortalLayout from './components/PortalLayout';
import PortalLogin from './pages/PortalLogin';
import Landing from './pages/Landing';

// Student pages
import StudentDashboard from './pages/StudentDashboard';
import Student from './pages/Student';
import Enrol from './pages/Enrol';
import Checkin from './pages/Checkin';
import StudentSignup from './pages/StudentSignup';

// Teacher pages
import TeacherDashboard from './pages/TeacherDashboard';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Analytics from './pages/Analytics';
import TeacherSignup from './pages/TeacherSignup';

// Admin pages
import AdminDashboard from './pages/AdminDashboard';
import Admin from './pages/Admin';

function PortalIndexRedirect({ portal }) {
  const { portals } = useAuth(portal);
  const auth = portals[portal];
  if (auth?.initializing) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500 text-sm">
        Verifying {portal} portal session…
      </div>
    );
  }
  if (auth?.user && auth.user.role === portal) {
    return <Navigate to={`/${portal}/dashboard`} replace />;
  }
  return <Navigate to={`/${portal}/login`} replace />;
}

function LegacySessionRedirect() {
  const { id } = useParams();
  return <Navigate to={`/teacher/sessions/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Root Portal Chooser */}
          <Route path="/" element={<Landing />} />

          {/* Student Portal Routes */}
          <Route path="/student" element={<PortalIndexRedirect portal="student" />} />
          <Route path="/student/login" element={<PortalLogin portal="student" />} />
          <Route path="/student/signup" element={<StudentSignup />} />
          <Route
            path="/student"
            element={
              <PortalGuard portal="student">
                <PortalLayout portal="student" />
              </PortalGuard>
            }
          >
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="attendance" element={<Student />} />
            <Route path="enrol" element={<Enrol />} />
            <Route path="checkin" element={<Checkin />} />
          </Route>

          {/* Teacher Portal Routes */}
          <Route path="/teacher" element={<PortalIndexRedirect portal="teacher" />} />
          <Route path="/teacher/login" element={<PortalLogin portal="teacher" />} />
          <Route path="/teacher/signup" element={<TeacherSignup />} />
          <Route
            path="/teacher"
            element={
              <PortalGuard portal="teacher">
                <PortalLayout portal="teacher" />
              </PortalGuard>
            }
          >
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>

          {/* Admin Portal Routes */}
          <Route path="/admin" element={<PortalIndexRedirect portal="admin" />} />
          <Route path="/admin/login" element={<PortalLogin portal="admin" />} />
          <Route
            path="/admin"
            element={
              <PortalGuard portal="admin">
                <PortalLayout portal="admin" />
              </PortalGuard>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="requests" element={<Admin initialTab="requests" />} />
            <Route path="users" element={<Admin initialTab="teachers" />} />
            <Route path="courses" element={<Admin initialTab="academics" />} />
            <Route path="enrolments" element={<Admin initialTab="academics" />} />
            <Route path="settings" element={<Admin initialTab="settings" />} />
          </Route>

          {/* Legacy route redirects */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/enrol" element={<Navigate to="/student/enrol" replace />} />
          <Route path="/checkin" element={<Navigate to="/student/checkin" replace />} />
          <Route path="/sessions" element={<Navigate to="/teacher/sessions" replace />} />
          <Route path="/sessions/:id" element={<LegacySessionRedirect />} />
          <Route path="/analytics" element={<Navigate to="/teacher/analytics" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
