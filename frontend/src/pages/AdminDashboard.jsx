import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../components/Auth';
import {
  Heading,
  ErrorBox,
  useTask,
  StatCard,
  Badge,
  SkeletonLoader,
} from '../components/UI';

export default function AdminDashboard() {
  const { user } = useAuth('admin');
  const task = useTask();

  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [enrolments, setEnrolments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [livenessStatus, setLivenessStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    await task.run(async () => {
      const [u, c, s, e, st, reqs, live] = await Promise.all([
        api.get('/users'),
        api.get('/courses'),
        api.get('/sections'),
        api.get('/enrolments'),
        api.get('/settings'),
        api.get('/registration-requests?status=pending').catch(() => ({ data: [] })),
        api.get('/liveness/status').catch(() => ({ data: null })),
      ]);
      setUsers(u.data || []);
      setCourses(c.data || []);
      setSections(s.data || []);
      setEnrolments(e.data || []);
      setSettings(st.data || null);
      setPendingRequests(reqs.data || []);
      setLivenessStatus(live.data || null);
    });
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const admins = users.filter(u => u.role === 'admin');

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <Heading
        title={`Welcome, ${user?.name || 'Administrator'}`}
        date={todayFormatted}
        detail="Institutional Governance · Academic Rosters, Identity Verification & Thresholds"
      >
        <Link
          to="/admin/users"
          className="btn shadow-sm text-sm py-2 px-4 font-bold flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Manage Users
        </Link>
      </Heading>

      <ErrorBox error={task.error} retry={loadData} />

      {/* 2. Pending Registrations Alert Banner */}
      {!loading && pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-amber-950 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-200 text-amber-900 shrink-0 mt-0.5">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-amber-950">
                {pendingRequests.length} Registration Application{pendingRequests.length > 1 ? 's' : ''} Awaiting Roster Verification
              </p>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                Self-entered applicant credentials require physical or registrar verification before granting student or faculty portal access.
              </p>
            </div>
          </div>
          <Link
            to="/admin/requests"
            className="btn text-xs py-2 px-4 bg-amber-700 hover:bg-amber-800 text-white font-bold shrink-0 shadow-sm"
          >
            Review Applications ({pendingRequests.length}) →
          </Link>
        </div>
      )}

      {/* 3. Summary Metric Cards */}
      {loading ? (
        <SkeletonLoader count={1} className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Pending Requests"
            value={pendingRequests.length}
            detail={
              pendingRequests.length > 0
                ? 'Applications requiring verification'
                : 'All applications reviewed'
            }
            highlight={pendingRequests.length > 0}
            badge={
              pendingRequests.length > 0 ? (
                <Badge variant="review">ACTION</Badge>
              ) : (
                <Badge variant="neutral">CLEARED</Badge>
              )
            }
            icon={
              <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />

          <StatCard
            title="Faculty Teachers"
            value={teachers.length}
            detail="Instructor accounts"
            badge={<Badge variant="info">FACULTY</Badge>}
            icon={
              <svg className="h-5 w-5 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />

          <StatCard
            title="Enrolled Students"
            value={students.length}
            detail="Active student roster"
            badge={<Badge variant="info">STUDENTS</Badge>}
            icon={
              <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />

          <StatCard
            title="Courses & Sections"
            value={`${courses.length} / ${sections.length}`}
            detail="Academic course structure"
            badge={<Badge variant="neutral">ACADEMICS</Badge>}
            icon={
              <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            }
          />

          <StatCard
            title="Active Enrolments"
            value={enrolments.length}
            detail="Student-section assignments"
            badge={<Badge variant="live">ENROLLED</Badge>}
            icon={
              <svg className="h-5 w-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />
        </div>
      )}

      {/* 4. Quick Action Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          to="/admin/requests"
          className={`card card-hover flex flex-col justify-between group ${
            pendingRequests.length > 0 ? 'border-amber-300 bg-amber-50/20' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-amber-100 text-amber-900 border border-amber-300">
                Approvals
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Registration Requests</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Verify student IDs and faculty credentials against authorized university records.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-amber-900">
            {pendingRequests.length} pending verification
          </div>
        </Link>

        <Link
          to="/admin/users"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-purple-100 text-purple-900 border border-purple-300">
                Accounts
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">User Management</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Create, edit, suspend, or remove teachers, students, and administrator accounts.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
            {users.length} total accounts
          </div>
        </Link>

        <Link
          to="/admin/courses"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-blue-100 text-blue-900 border border-blue-300">
                Academics
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Courses & Sections</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Configure course catalog codes, course titles, and semester section offerings.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
            {courses.length} courses / {sections.length} sections
          </div>
        </Link>

        <Link
          to="/admin/enrolments"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-emerald-100 text-emerald-900 border border-emerald-300">
                Rosters
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Student Enrolments</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Manage section rosters and assign authorized faculty instructors to lecture sections.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
            {enrolments.length} enrolled students
          </div>
        </Link>

        <Link
          to="/admin/settings"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-teal-100 text-teal-900 border border-teal-300">
                Policies
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Recognition Thresholds</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Calibrate cosine matching tolerances and institutional attendance percentage limits.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
            Attendance limit: {settings?.attendance_limit ?? 75}%
          </div>
        </Link>
      </div>

      {/* 5. System Policies & Engine Readiness Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Recognition Policies (2 cols) */}
        {settings && (
          <section className="card space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-pine">
                  Active Recognition & Attendance Policies
                </h3>
                <p className="text-xs text-slate-500">
                  Mathematical thresholds enforced during live classroom capture and review.
                </p>
              </div>
              <Link to="/admin/settings" className="btn secondary text-xs py-1.5 px-3">
                Edit Policies →
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-500 block">
                  Verification Threshold
                </span>
                <span className="text-2xl font-extrabold text-pine mt-1 block">
                  {settings.verification_threshold ?? '—'}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1 leading-snug">
                  Minimum cosine similarity score (0.00–1.00) required to auto-confirm attendance.
                </span>
              </div>

              <div className="rounded-xl bg-amber-50/60 p-4 border border-amber-200/80">
                <span className="text-xs font-semibold text-amber-900 block">
                  Review Threshold
                </span>
                <span className="text-2xl font-extrabold text-amber-800 mt-1 block">
                  {settings.review_threshold ?? '—'}
                </span>
                <span className="text-[11px] text-amber-900/80 block mt-1 leading-snug">
                  Faces between review and verification score are routed to the teacher review queue.
                </span>
              </div>

              <div className="rounded-xl bg-emerald-50/60 p-4 border border-emerald-200/80">
                <span className="text-xs font-semibold text-emerald-950 block">
                  Attendance Limit
                </span>
                <span className="text-2xl font-extrabold text-emerald-800 mt-1 block">
                  {settings.attendance_limit != null ? `${settings.attendance_limit}%` : '—'}
                </span>
                <span className="text-[11px] text-emerald-900/80 block mt-1 leading-snug">
                  University compliance threshold below which students are flagged at-risk.
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              * Similarity scores indicate geometric cosine alignment between 512D facial vectors. They are distinct from statistical accuracy percentages.
            </p>
          </section>
        )}

        {/* Liveness Engine Status Card (1 col) */}
        <section className="card space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-pine">Liveness & Security Engine</h3>
            <p className="text-xs text-slate-500">Active server-side anti-spoofing backend</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <span className="font-semibold text-slate-600">Active Backend</span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                {livenessStatus?.active_backend?.toUpperCase() || 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <span className="font-semibold text-slate-600">Review Mode</span>
              <span className="font-semibold text-slate-700">
                {livenessStatus?.baseline_auto ? 'Automated' : 'Teacher Guided'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
              <p className="font-bold text-emerald-950">Security Invariant:</p>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Admins cannot bypass face validation or arbitrarily elevate student attendance without teacher audit logging.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
