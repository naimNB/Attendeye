import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../components/Auth';
import { useTask, ErrorBox, Field } from '../components/UI';

const PORTAL_META = {
  student: {
    name: 'Student Portal',
    tag: 'PUB / STUDENT ACCESS',
    heading: 'Your attendance.\nYour record.',
    description: 'Check in with live QR + face matching, view course attendance rates, and manage facial enrolment.',
    bannerBg: 'bg-emerald-950',
    tagColor: 'text-emerald-300',
    btnLabel: 'Sign in to Student Portal',
    demos: [
      { label: 'Student 1', email: 'student1@demo.invalid' },
      { label: 'Student 2', email: 'student2@demo.invalid' },
    ],
    otherPortals: [
      { label: 'Teacher Portal', path: '/teacher/login' },
      { label: 'Admin Portal', path: '/admin/login' },
    ],
  },
  teacher: {
    name: 'Teacher Portal',
    tag: 'PUB / FACULTY ACCESS',
    heading: 'Classroom attendance.\nSimplified.',
    description: 'Launch smart attendance sessions, monitor live video challenges, review flagged faces, and inspect class analytics.',
    bannerBg: 'bg-slate-900',
    tagColor: 'text-blue-300',
    btnLabel: 'Sign in to Teacher Portal',
    demos: [
      { label: 'Teacher 1', email: 'teacher1@demo.invalid' },
    ],
    otherPortals: [
      { label: 'Student Portal', path: '/student/login' },
      { label: 'Admin Portal', path: '/admin/login' },
    ],
  },
  admin: {
    name: 'Admin Portal',
    tag: 'PUB / SYSTEM ADMINISTRATION',
    heading: 'Institution-wide\nGovernance.',
    description: 'Manage student and faculty accounts, configure courses and sections, and tune biometric similarity thresholds.',
    bannerBg: 'bg-indigo-950',
    tagColor: 'text-purple-300',
    btnLabel: 'Sign in to Admin Portal',
    demos: [
      { label: 'Administrator', email: 'admin@demo.invalid' },
    ],
    otherPortals: [
      { label: 'Student Portal', path: '/student/login' },
      { label: 'Teacher Portal', path: '/teacher/login' },
    ],
  },
};

export default function PortalLogin({ portal = 'student' }) {
  const { portals, login } = useAuth(portal);
  const task = useTask();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const meta = PORTAL_META[portal] || PORTAL_META.student;
  const currentAuth = portals[portal];

  if (currentAuth?.user && currentAuth.user.role === portal) {
    return <Navigate to={`/${portal}/dashboard`} replace />;
  }

  function fill(demoEmail) {
    setEmail(demoEmail);
    setPassword('password123');
  }

  return (
    <div className="grid min-h-screen place-items-center p-6 bg-slate-100">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        {/* Portal-specific Hero Banner */}
        <div className={`${meta.bannerBg} p-10 text-white flex flex-col justify-between`}>
          <div>
            <div className={`text-xs font-bold tracking-widest uppercase mb-12 ${meta.tagColor}`}>
              {meta.tag}
            </div>
            <h1 className="text-3xl font-bold whitespace-pre-line leading-tight text-white">
              {meta.heading}
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              {meta.description}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-white/10 p-4 border border-white/10 backdrop-blur-sm">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Demo Account Password
              </p>
              <code className="text-sm font-mono text-emerald-300 bg-black/40 px-2.5 py-1 rounded">
                password123
              </code>
            </div>
            <p className="text-xs text-slate-400">
              Role isolation active: credentials verified server-side against database roles.
            </p>
          </div>
        </div>

        {/* Portal Login Form */}
        <div className="p-8 md:p-10 flex flex-col justify-between">
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              task.run(async () => {
                await login(portal, email.trim(), password);
              });
            }}
          >
            <div>
              <div className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 mb-2">
                {meta.name}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your authorized credentials for this portal.
              </p>
            </div>

            {meta.demos?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">Quick-fill demo account:</p>
                <div className="flex flex-wrap gap-2">
                  {meta.demos.map(d => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => fill(d.email)}
                      className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ErrorBox error={task.error} />

            <Field title="Email Address">
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@demo.invalid"
              />
            </Field>

            <Field title="Password">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <button disabled={task.busy} className="btn w-full py-2.5 font-medium">
              {task.busy ? 'Authenticating…' : meta.btnLabel}
            </button>

            {portal === 'student' && (
              <div className="pt-2 text-center text-xs text-slate-600">
                Don't have a student account?{' '}
                <Link to="/student/signup" className="font-semibold text-emerald-800 underline">
                  Register here
                </Link>
              </div>
            )}
            {portal === 'teacher' && (
              <div className="pt-2 text-center text-xs text-slate-600">
                Don't have a faculty account?{' '}
                <Link to="/teacher/signup" className="font-semibold text-blue-800 underline">
                  Register here
                </Link>
              </div>
            )}
            {portal === 'admin' && (
              <div className="pt-2 text-center text-xs text-slate-400">
                Admin accounts are provisioned internally by administrators.
              </div>
            )}
          </form>

          {/* Cross-portal Navigation Links */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500 mb-2">Switch portal:</p>
            <div className="flex flex-wrap gap-2">
              {meta.otherPortals.map(op => (
                <Link
                  key={op.path}
                  to={op.path}
                  className="text-xs font-medium text-emerald-800 hover:text-emerald-950 underline"
                >
                  {op.label} →
                </Link>
              ))}
              <Link
                to="/"
                className="text-xs font-medium text-slate-500 hover:text-slate-800 ml-auto"
              >
                All Portals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
