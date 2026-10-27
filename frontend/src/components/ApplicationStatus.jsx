import { useAuth } from './Auth';

export default function ApplicationStatus({ portal }) {
  const { user, logout } = useAuth(portal);

  if (!user) return null;

  const status = user.status || 'pending';

  return (
    <div className="max-w-2xl mx-auto my-6 space-y-6">
      {status === 'pending' && (
        <div className="card border-2 border-amber-300 bg-amber-50/60 p-6 md:p-8 space-y-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="badge bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
              Application Status: Pending Review
            </span>
            <span className="text-xs font-mono text-slate-500">ID #{user.id}</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              Registration Pending Administrator Approval
            </h2>
            <p className="mt-2 text-xs text-amber-950 leading-relaxed">
              Your registration application has been received and is waiting for administrator verification.
              Protected features (attendance records, live QR check-in, biometric enrolment, and classroom tools)
              are locked until your university records are verified.
            </p>
          </div>

          {/* Submitted details summary */}
          <div className="rounded-xl border border-amber-200 bg-white/90 p-4 text-xs space-y-2">
            <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Submitted Application Details
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-slate-500 block">Full Name:</span>
                <span className="font-medium text-slate-800">{user.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Email Address:</span>
                <span className="font-medium text-slate-800">{user.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">University Identifier:</span>
                <span className="font-mono font-medium text-slate-800">
                  {user.student_code || user.staff_id || 'None'}
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
                  <span className="text-slate-500 block">Date Submitted:</span>
                  <span className="font-medium text-slate-800">{new Date(user.created_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Verification Protocol Notice */}
          <div className="rounded-xl bg-amber-100/70 p-3.5 text-xs text-amber-900 space-y-1">
            <p className="font-semibold text-amber-950">Administrative Verification Process</p>
            <p className="leading-relaxed">
              University student/staff IDs are identifiers, not self-executing proof.
              An administrator must verify your identity against an authorised institutional roster or an in-person ID check before approval.
            </p>
            <p className="text-[11px] text-amber-800/80 pt-1">
              Note: Email ownership verification will be added in the next phase.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              className="btn secondary text-xs py-1.5 px-3"
              onClick={() => logout(portal)}
            >
              Sign out
            </button>
            <span className="text-xs text-slate-500">
              Check back once your department administrator verifies your application.
            </span>
          </div>
        </div>
      )}

      {status === 'rejected' && (
        <div className="card border-2 border-rose-300 bg-rose-50/60 p-6 md:p-8 space-y-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="badge bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs">
              Application Status: Not Approved
            </span>
            <span className="text-xs font-mono text-slate-500">ID #{user.id}</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              Registration Not Approved
            </h2>
            <p className="mt-2 text-xs text-rose-950 leading-relaxed">
              Your registration application was reviewed and could not be approved by the administrator.
            </p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-white p-4 text-xs space-y-1.5">
            <p className="font-semibold text-rose-900 uppercase tracking-wider text-[11px]">
              Reason for Decision
            </p>
            <p className="text-slate-800 font-medium leading-relaxed">
              {user.rejection_reason || 'Identifier or credentials could not be verified against the official university roster.'}
            </p>
          </div>

          <div className="rounded-xl bg-rose-100/60 p-3.5 text-xs text-rose-900">
            <p className="font-semibold">Next Steps</p>
            <p className="mt-0.5 leading-relaxed">
              If you believe this decision is in error, please contact your academic department administration
              or registrar office with your official student/staff credentials.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="btn secondary text-xs py-1.5 px-3"
              onClick={() => logout(portal)}
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {status === 'suspended' && (
        <div className="card border-2 border-red-400 bg-red-50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛑</span>
            <h2 className="text-lg font-bold text-red-950">Account Suspended</h2>
          </div>
          <p className="text-xs text-red-900 leading-relaxed">
            This account has been suspended by an administrator. All attendance, session, and biometric access
            is blocked. Reason: {user.rejection_reason || 'Administrative policy enforcement.'}
          </p>
          <button
            type="button"
            className="btn secondary text-xs py-1.5 px-3"
            onClick={() => logout(portal)}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
