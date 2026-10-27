import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 md:p-12">
      <div className="mx-auto max-w-5xl w-full">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pine font-bold text-mint shadow-sm text-lg">
              AE
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                PUB AttendEye
              </h1>
              <p className="text-xs text-slate-500">
                Smart Attendance Verification · Track B4 University Hackathon
              </p>
            </div>
          </div>
          <div className="text-xs font-medium px-3 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800">
            Three Dedicated Role Portals
          </div>
        </header>

        {/* Hero */}
        <div className="my-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Select Your Role Portal
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            AttendEye isolates Student, Teacher, and Administrator operations with separate,
            role-validated portals. Choose your assigned portal below to sign in.
          </p>
        </div>

        {/* Portals Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3 mt-6">
          {/* Student Portal Card */}
          <div className="card flex flex-col justify-between border-2 border-slate-200 hover:border-emerald-500 transition shadow-sm hover:shadow-md bg-white">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs">
                  Student
                </span>
                <span className="text-xs font-mono text-slate-400">/student</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Student Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                For enrolled students. View course attendance percentages, alerts, complete live QR
                check-ins with liveness challenges, and manage face biometric consent.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/student"
                className="btn w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs py-2.5 text-center block"
              >
                Enter Student Portal →
              </Link>
              <Link
                to="/student/signup"
                className="text-xs text-center font-medium text-emerald-800 hover:text-emerald-950 underline"
              >
                New Student? Register here
              </Link>
            </div>
          </div>

          {/* Teacher Portal Card */}
          <div className="card flex flex-col justify-between border-2 border-slate-200 hover:border-blue-500 transition shadow-sm hover:shadow-md bg-white">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="badge bg-blue-100 text-blue-800 border border-blue-200 text-xs">
                  Faculty
                </span>
                <span className="text-xs font-mono text-slate-400">/teacher</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Teacher Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                For course instructors. Open class sessions, broadcast rotating QR codes, conduct
                live camera multi-frame challenges, resolve review candidates, and export reports.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/teacher"
                className="btn w-full bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs py-2.5 text-center block"
              >
                Enter Teacher Portal →
              </Link>
              <Link
                to="/teacher/signup"
                className="text-xs text-center font-medium text-blue-800 hover:text-blue-950 underline"
              >
                Faculty Member? Register here
              </Link>
            </div>
          </div>

          {/* Admin Portal Card */}
          <div className="card flex flex-col justify-between border-2 border-slate-200 hover:border-purple-500 transition shadow-sm hover:shadow-md bg-white">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="badge bg-purple-100 text-purple-800 border border-purple-200 text-xs">
                  Administration
                </span>
                <span className="text-xs font-mono text-slate-400">/admin</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Admin Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                For institutional administrators. Add and manage student and faculty accounts,
                configure courses and sections, assign rosters, and configure recognition thresholds.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/admin"
                className="btn w-full bg-purple-700 hover:bg-purple-800 text-white font-medium text-xs py-2.5 text-center block"
              >
                Enter Admin Portal →
              </Link>
              <span className="text-xs text-center text-slate-400">
                Accounts provisioned internally
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
        <p className="font-semibold text-slate-700">Privacy & Security Notice</p>
        <p className="mt-1">
          Role-isolated sessions prevent cross-role data leaks. Authentication is validated
          server-side against the database. No biometric templates or images are stored in browser storage.
        </p>
      </footer>
    </div>
  );
}
