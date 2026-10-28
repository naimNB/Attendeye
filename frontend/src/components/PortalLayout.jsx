import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './Auth';
import ApplicationStatus from './ApplicationStatus';
import { formatAccountName } from '../api/client';

const PORTAL_CONFIG = {
  student: {
    title: 'Student Portal',
    roleTag: 'Student Access',
    badgeClass: 'badge-open',
    navItems: [
      {
        path: '/student/dashboard',
        label: 'Dashboard',
        end: true,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        path: '/student/attendance',
        label: 'My Attendance',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        path: '/student/enrol',
        label: 'Face Enrolment',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        path: '/student/checkin',
        label: 'QR Check-in',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        ),
      },
    ],
    footerNote: 'Consent first: biometric vectors are held in volatile memory only during verification.',
  },
  teacher: {
    title: 'Teacher Portal',
    roleTag: 'Faculty Access',
    badgeClass: 'badge-open',
    navItems: [
      {
        path: '/teacher/dashboard',
        label: 'Dashboard',
        end: true,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        path: '/teacher/sessions',
        label: 'Class Sessions',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        path: '/teacher/analytics',
        label: 'Analytics & Reports',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
    footerNote: 'Human in the loop: manual resolution is always available for flagged candidates.',
  },
  admin: {
    title: 'Admin Portal',
    roleTag: 'System Administration',
    badgeClass: 'badge-open',
    navItems: [
      {
        path: '/admin/dashboard',
        label: 'Dashboard',
        end: true,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        path: '/admin/requests',
        label: 'Registration Requests',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ),
      },
      {
        path: '/admin/users',
        label: 'User Directory',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        path: '/admin/courses',
        label: 'Courses & Sections',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      },
      {
        path: '/admin/settings',
        label: 'Recognition Settings',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
    footerNote: 'Audit logging active: all threshold changes and roster actions are recorded.',
  },
};

export default function PortalLayout({ portal }) {
  const { user, logout } = useAuth(portal);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const config = PORTAL_CONFIG[portal] || PORTAL_CONFIG.student;
  const isApproved = !user?.status || user.status === 'approved';
  const displayName = formatAccountName(user?.name);

  const effectiveNavItems = isApproved
    ? config.navItems
    : [
        {
          path: `/${portal}/dashboard`,
          label: 'Application Status',
          end: true,
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ];

  function handleSignOut() {
    logout(portal);
    navigate(`/${portal}/login`, { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">
      {/* ── 1. Desktop Navy Sidebar (min-w-64) ── */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-slate-900 border-r border-slate-800 shrink-0 text-slate-300">
        <div>
          {/* Institution Crest & Branding */}
          <div className="p-5 border-b border-slate-800">
            <Link to={`/${portal}/dashboard`} className="flex items-center gap-3 group">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-700 text-white font-bold text-sm shadow-sm transition group-hover:bg-teal-600">
                PUB
              </div>
              <div>
                <span className="font-bold tracking-tight text-white block leading-tight text-sm">
                  PUB AttendEye
                </span>
                <span className="text-[11px] font-medium text-teal-400 block mt-0.5">
                  {config.title}
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1">
            <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Navigation
            </p>
            {effectiveNavItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-teal-700 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer with Active Account & Privacy Note */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="rounded-xl bg-slate-800/60 p-3 text-[11px] text-slate-400 leading-relaxed border border-slate-750">
            <p className="font-semibold text-slate-300 mb-0.5">Privacy Notice</p>
            <p>{config.footerNote}</p>
          </div>

          {user && (
            <div className="flex items-center justify-between pt-1">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  {user.student_code || user.staff_id || user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
                title="Sign out"
                aria-label="Sign out"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── 2. Mobile / Tablet Top Bar ── */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={`/${portal}/dashboard`} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white font-bold text-xs">
              PUB
            </span>
            <div>
              <span className="font-bold text-sm block leading-tight">PUB AttendEye</span>
              <span className="text-[10px] text-teal-400 font-medium">{config.title}</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="p-3 bg-slate-850 border-t border-slate-800 space-y-1">
            {effectiveNavItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-teal-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between px-2">
              <span className="text-xs text-slate-400 truncate">{displayName}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs font-semibold text-rose-400 hover:underline py-1"
              >
                Sign out
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* ── 3. Main Content Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Breadcrumb & User Bar (Desktop) */}
        <div className="hidden md:flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3.5 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              PUB Academic System
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-teal-800">
              {config.title}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                isApproved
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {isApproved ? 'VERIFIED' : (user?.status?.toUpperCase() || 'PENDING')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="text-right">
                <span className="text-xs font-bold text-slate-800 block leading-tight">
                  {displayName}
                </span>
                {(user.student_code || user.staff_id) && (
                  <span className="text-[11px] font-mono text-slate-500">
                    ID #{user.student_code || user.staff_id}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              className="btn secondary btn-sm text-xs"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Page Content Surfaces */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <div className="max-w-7xl mx-auto space-y-6">
            {isApproved ? <Outlet /> : <ApplicationStatus portal={portal} />}
          </div>
        </main>
      </div>
    </div>
  );
}
