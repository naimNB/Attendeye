import { useAuth } from './Auth';

export default function ApplicationStatus({ portal }) {
  const { user, logout } = useAuth(portal);

  if (!user) return null;

  const status = user.status || 'pending';

  return (
    <div className="max-w-2xl mx-auto my-8 space-y-6">
      {status === 'pending' && (
        <div className="card border-2 border-amber-300 bg-amber-50/50 p-6 md:p-8 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <span className="badge badge-expired font-bold text-xs">
              Registration Status: Pending Administrator Verification
            </span>
            <span className="text-xs font-mono text-slate-500">Account #{user.id}</span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              Application Under Institutional Review
            </h2>
            <p className="mt-2 text-xs text-amber-950 leading-relaxed">
              Your registration application has been submitted to the academic administration.
              Protected features (course attendance records, biometric verification, and classroom sessions)
              are reserved for accounts verified against institutional rosters.
            </p>
          </div>

          {/* Submitted details summary */}
          <div className="rounded-xl border border-amber-200 bg-white p-4 text-xs space-y-2">
            <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
              Submitted Application Profile
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <span className="text-slate-500 block">Full Name:</span>
                <span className="font-semibold text-slate-800">{user.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Email Address:</span>
                <span className="font-medium text-slate-800">{user.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Institutional ID:</span>
                <span className="font-mono font-medium text-slate-800">
                  {user.student_code || user.staff_id || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Department:</span>
                <span className="font-medium text-slate-800">{user.department || 'Not specified'}</span>
              </div>
              {user.batch && (
                <div>
                  <span className="text-slate-500 block">Batch / Semester:</span>
                  <span className="font-medium text-slate-800">{user.batch}</span>
                </div>
              )}
              {user.created_at && (
                <div>
                  <span className="text-slate-500 block">Submission Date:</span>
                  <span className="font-medium text-slate-800">{new Date(user.created_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Verification Protocol Notice */}
          <div className="rounded-xl bg-amber-100/70 p-4 text-xs text-amber-950 space-y-1 border border-amber-200">
            <p className="font-semibold text-amber-950">Verification Protocol</p>
            <p className="leading-relaxed">
              Submitted student and staff identifiers are verified against institutional records before access is granted.
              Once your department administrator reviews and approves your application, your portal access will activate automatically.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              className="btn secondary btn-sm text-xs"
              onClick={() => logout(portal)}
            >
              Sign out
            </button>
            <span className="text-xs text-slate-500">
              Please check back after administrative processing.
            </span>
          </div>
        </div>
      )}

      {status === 'rejected' && (
        <div className="card border-2 border-rose-300 bg-rose-50/50 p-6 md:p-8 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <span className="badge badge-danger font-bold text-xs">
              Application Status: Not Approved
            </span>
            <span className="text-xs font-mono text-slate-500">Account #{user.id}</span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              Registration Application Rejected
            </h2>
            <p className="mt-2 text-xs text-rose-950 leading-relaxed">
              Your registration application was reviewed by the administration and could not be approved.
            </p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-white p-4 text-xs space-y-1.5">
            <p className="font-semibold text-rose-900 uppercase tracking-wider text-[11px]">
              Reason Provided
            </p>
            <p className="text-slate-800 font-medium leading-relaxed">
              {user.rejection_reason || 'Identifier or credentials could not be matched against current institutional rosters.'}
            </p>
          </div>

          <div className="rounded-xl bg-rose-100/60 p-4 text-xs text-rose-950 border border-rose-200">
            <p className="font-semibold">Next Steps</p>
            <p className="mt-0.5 leading-relaxed">
              If this decision was made in error, please contact your department office or system administrator with official identification documents.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="btn secondary btn-sm text-xs"
              onClick={() => logout(portal)}
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {status === 'suspended' && (
        <div className="card border-2 border-rose-400 bg-rose-50/60 p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-bold text-rose-950">Account Suspended</h2>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">
            This account has been administratively suspended. Attendance, check-in, and session access are blocked.
            Reason: {user.rejection_reason || 'Administrative policy enforcement.'}
          </p>
          <button
            type="button"
            className="btn secondary btn-sm text-xs"
            onClick={() => logout(portal)}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
