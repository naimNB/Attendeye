import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './Auth';
import ApplicationStatus from './ApplicationStatus';

const PORTAL_CONFIG = {
  student: {
    title: 'Student Portal',
    subtitle: 'Attendance & Face Check-in',
    badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    links: [
      ['/student/dashboard', 'Dashboard'],
      ['/student/attendance', 'My Attendance'],
      ['/student/enrol', 'Face Enrolment'],
      ['/student/checkin', 'QR Check-in'],
    ],
    footerNote: 'Consent first. Biometrics held in memory only during verification.',
  },
  teacher: {
    title: 'Teacher Portal',
    subtitle: 'Classroom Sessions & Review',
    badgeClass: 'bg-blue-100 text-blue-800 border border-blue-300',
    links: [
      ['/teacher/dashboard', 'Dashboard'],
      ['/teacher/sessions', 'Class Sessions'],
      ['/teacher/analytics', 'Attendance Analytics'],
    ],
    footerNote: 'Human review always available. Never rely on unverified matching.',
  },
  admin: {
    title: 'Admin Portal',
    subtitle: 'System & User Management',
    badgeClass: 'bg-purple-100 text-purple-800 border border-purple-300',
    links: [
      ['/admin/dashboard', 'Dashboard'],
      ['/admin/requests', 'Registration Requests'],
      ['/admin/users', 'User Management'],
      ['/admin/courses', 'Courses & Sections'],
      ['/admin/enrolments', 'Student Enrolments'],
      ['/admin/settings', 'Recognition Settings'],
    ],
    footerNote: 'Audit-logged administrative access and threshold management.',
  },
};

export default function PortalLayout({ portal }) {
  const { user, logout } = useAuth(portal);
  const navigate = useNavigate();
  const config = PORTAL_CONFIG[portal] || PORTAL_CONFIG.student;
  const isApproved = !user?.status || user.status === 'approved';
  const effectiveLinks = isApproved
    ? config.links
    : [[`/${portal}/dashboard`, 'Application Status']];

  function handleSignOut() {
    logout(portal);
    navigate(`/${portal}/login`, { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3.5">
          <Link to={`/${portal}/dashboard`} className="mr-auto flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-pine font-bold text-mint shadow-sm">
              AE
            </span>
            <div>
              <span className="font-bold tracking-tight text-slate-900 block leading-tight">
                PUB AttendEye
              </span>
              <span className="text-xs font-normal text-slate-500">
                {config.subtitle}
              </span>
            </div>
          </Link>

          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${isApproved ? config.badgeClass : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
            {isApproved ? config.title : `${config.title} · ${user?.status?.toUpperCase() || 'PENDING'}`}
          </span>

          {user && (
            <div className="text-right">
              <span className="text-sm font-medium text-slate-800 block leading-tight">
                {user.name}
              </span>
              {(user.student_code || user.staff_id) && (
                <span className="text-xs font-mono text-slate-500">
                  {user.student_code || user.staff_id}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn secondary text-xs py-1.5 px-3"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 md:grid-cols-[210px_1fr]">
        <aside>
          <nav className="flex flex-wrap gap-1.5 md:flex-col">
            {effectiveLinks.map(([path, name]) => (
              <NavLink
                key={path}
                to={path}
                end={path.endsWith('/dashboard')}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-pine text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`
                }
              >
                {name}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 hidden rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-500 md:block">
            <p className="font-semibold text-slate-700 mb-1">Privacy Guarantee</p>
            <p className="leading-relaxed">{config.footerNote}</p>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {isApproved ? <Outlet /> : <ApplicationStatus portal={portal} />}
        </main>
      </div>
    </div>
  );
}
