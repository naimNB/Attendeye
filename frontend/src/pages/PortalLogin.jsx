import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../components/Auth';
import { useTask, ErrorBox, Field } from '../components/UI';

const PORTAL_META = {
  student: {
    name: 'Student Portal',
    tag: 'PUB / STUDENT ACCESS',
    heading: 'Your Attendance.\nYour Academic Record.',
    description: 'Check in with live QR and liveness verification, track course percentage compliance, and manage reference face biometrics.',
    bannerBg: 'bg-slate-900',
    tagColor: 'text-teal-400',
    btnLabel: 'Sign in to Student Portal',
    otherPortals: [
      { label: 'Teacher Portal', path: '/teacher/login' },
      { label: 'Admin Portal', path: '/admin/login' },
    ],
  },
  teacher: {
    name: 'Teacher Portal',
    tag: 'PUB / FACULTY ACCESS',
    heading: 'Classroom Attendance.\nReal-Time Accuracy.',
    description: 'Open class sessions, project rotating QR codes, perform live camera challenges, review candidate matches, and export compliance reports.',
    bannerBg: 'bg-slate-900',
    tagColor: 'text-teal-400',
    btnLabel: 'Sign in to Teacher Portal',
    otherPortals: [
      { label: 'Student Portal', path: '/student/login' },
      { label: 'Admin Portal', path: '/admin/login' },
    ],
  },
  admin: {
    name: 'Admin Portal',
    tag: 'PUB / SYSTEM ADMINISTRATION',
    heading: 'Institutional Governance\n& Audit Control.',
    description: 'Approve new user registrations, manage course and section rosters, configure recognition thresholds, and inspect security telemetry.',
    bannerBg: 'bg-slate-900',
    tagColor: 'text-teal-400',
    btnLabel: 'Sign in to Admin Portal',
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
  const [showPassword, setShowPassword] = useState(false);

  const meta = PORTAL_META[portal] || PORTAL_META.student;
  const currentAuth = portals[portal];

  if (currentAuth?.user && currentAuth.user.role === portal) {
    return <Navigate to={`/${portal}/dashboard`} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm grid md:grid-cols-2">
        {/* Dark Navy Brand / Portal Identity Column */}
        <div className={`${meta.bannerBg} p-8 sm:p-10 text-white flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800`}>
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 font-bold text-white text-xs">
                PUB
              </span>
              <span className="font-bold text-sm tracking-tight text-white">
                PUB AttendEye
              </span>
            </div>

            <div className={`text-xs font-bold tracking-widest uppercase mb-4 ${meta.tagColor}`}>
              {meta.tag}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold whitespace-pre-line leading-tight text-white">
              {meta.heading}
            </h1>
            <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {meta.description}
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Server-enforced role boundary: credentials submitted here are validated strictly against the <strong>{meta.name}</strong> role roster.
            </p>
          </div>
        </div>

        {/* Focused Login Form Column */}
        <div className="p-8 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="mb-6">
              <div className="inline-block rounded-md bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-800 mb-2">
                {meta.name}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your institutional account credentials to access this portal.
              </p>
            </div>

            <ErrorBox error={task.error} />

            <form
              className="mt-5 space-y-4"
              onSubmit={e => {
                e.preventDefault();
                task.run(async () => {
                  await login(portal, email.trim(), password);
                });
              }}
            >
              <Field title="Email Address" required>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                />
              </Field>

              <Field title="Password" required>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              <button
                type="submit"
                disabled={task.busy}
                className="btn w-full py-2.5 text-sm font-semibold mt-2"
              >
                {task.busy ? 'Authenticating…' : meta.btnLabel}
              </button>
            </form>
          </div>

          {/* Portal Switcher & Registration Links */}
          <div className="mt-8 pt-5 border-t border-slate-100 text-xs space-y-2">
            {portal === 'student' && (
              <p className="text-slate-600">
                Need a student account?{' '}
                <Link to="/student/signup" className="font-semibold text-teal-800 hover:text-teal-950 underline">
                  Register application here
                </Link>
              </p>
            )}
            {portal === 'teacher' && (
              <p className="text-slate-600">
                Faculty member without an account?{' '}
                <Link to="/teacher/signup" className="font-semibold text-teal-800 hover:text-teal-950 underline">
                  Register application here
                </Link>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-500">
              <span>Switch portal:</span>
              {meta.otherPortals.map((op, idx) => (
                <span key={op.path} className="inline-flex items-center gap-2">
                  <Link to={op.path} className="font-semibold text-teal-800 hover:underline">
                    {op.label}
                  </Link>
                  {idx < meta.otherPortals.length - 1 && <span>·</span>}
                </span>
              ))}
              <span>·</span>
              <Link to="/" className="text-slate-500 hover:text-slate-800 hover:underline">
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
