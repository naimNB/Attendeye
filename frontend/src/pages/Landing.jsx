import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top University Brand Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-700 font-bold text-white shadow-sm text-sm">
              PUB
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                PUB AttendEye
              </h1>
              <p className="text-xs text-slate-500">
                Academic Attendance & Biometric Verification System
              </p>
            </div>
          </div>
          <span className="badge badge-open text-xs">
            Role-Based Portal Access
          </span>
        </div>
      </header>

      {/* Main Role Selection Canvas */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700 mb-2">
            Institutional Sign-in
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Select Your Role Portal
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            PUB AttendEye maintains strict separation of student, faculty, and administrative duties.
            Please select your authorized portal to sign in or register.
          </p>
        </div>

        {/* 3 Portal Selection Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Student Portal Card */}
          <div className="card flex flex-col justify-between border-slate-200 hover:border-teal-600 hover:shadow-md transition-all bg-white">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="badge badge-open text-xs">
                  Student Access
                </span>
                <span className="text-xs font-mono text-slate-400">/student</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Student Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                View course attendance records, check threshold compliance, perform live QR and liveness check-ins, and manage biometric face enrolment.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
              <Link
                to="/student"
                className="btn w-full text-xs py-2.5 text-center block"
              >
                Access Student Portal →
              </Link>
              <Link
                to="/student/signup"
                className="text-xs text-center font-medium text-teal-800 hover:text-teal-950 block py-1"
              >
                New Student? Register Application
              </Link>
            </div>
          </div>

          {/* Teacher Portal Card */}
          <div className="card flex flex-col justify-between border-slate-200 hover:border-teal-600 hover:shadow-md transition-all bg-white">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="badge badge-open text-xs">
                  Faculty Access
                </span>
                <span className="text-xs font-mono text-slate-400">/teacher</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Teacher Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Launch attendance sessions, broadcast synchronized classroom QR codes, capture group photos, review ambiguous matches, and export attendance records.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
              <Link
                to="/teacher"
                className="btn w-full text-xs py-2.5 text-center block"
              >
                Access Teacher Portal →
              </Link>
              <Link
                to="/teacher/signup"
                className="text-xs text-center font-medium text-teal-800 hover:text-teal-950 block py-1"
              >
                Faculty Member? Register Application
              </Link>
            </div>
          </div>

          {/* Admin Portal Card */}
          <div className="card flex flex-col justify-between border-slate-200 hover:border-teal-600 hover:shadow-md transition-all bg-white">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="badge badge-neutral text-xs">
                  System Admin
                </span>
                <span className="text-xs font-mono text-slate-400">/admin</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Admin Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Verify registration requests, manage courses and section rosters, audit user accounts, and configure recognition threshold parameters.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
              <Link
                to="/admin"
                className="btn secondary w-full text-xs py-2.5 text-center block"
              >
                Access Admin Portal →
              </Link>
              <p className="text-[11px] text-center text-slate-400 py-1">
                Admin registration restricted to IT staff
              </p>
            </div>
          </div>
        </div>

        {/* Security & Privacy Banner */}
        <div className="mt-12 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-teal-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>
              <strong>Biometric Privacy Guarantee:</strong> Face vectors are encrypted with Fernet and strictly matched against active class rosters with explicit consent.
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">PUB Security Standard</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        PUB AttendEye · Academic Attendance Verification System · All rights reserved.
      </footer>
    </div>
  );
}
