import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../components/Auth';
import {
  Heading,
  ErrorBox,
  Empty,
  useTask,
  StatCard,
  Badge,
  SkeletonLoader,
} from '../components/UI';

export default function StudentDashboard() {
  const { user } = useAuth('student');
  const task = useTask();

  const [attendance, setAttendance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [enrolStatus, setEnrolStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    await task.run(async () => {
      const [attRes, noteRes, enrolRes] = await Promise.all([
        api.get('/attendance/me').catch(() => ({ data: [] })),
        api.get('/notifications').catch(() => ({ data: [] })),
        api.get('/enrol/status').catch(() => ({ data: null })),
      ]);
      setAttendance(attRes.data || []);
      setNotifications(noteRes.data || []);
      setEnrolStatus(enrolRes.data);
    });
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalSections = attendance.length;
  const belowLimitSections = attendance.filter(a => a.below_limit);
  const closedSectionsWithData = attendance.filter(a => a.percentage !== null);

  const calculatedAvg = closedSectionsWithData.length > 0
    ? Math.round(
        closedSectionsWithData.reduce((sum, a) => sum + a.percentage, 0) /
          closedSectionsWithData.length
      )
    : null;

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const isEnrolled = enrolStatus?.complete;
  const hasConsented = enrolStatus?.consented;

  return (
    <div className="space-y-6">
      {/* 1. Header with Direct Action */}
      <Heading
        title={`Welcome, ${user?.name || 'Student'}`}
        date={todayFormatted}
        detail={`Student ID: ${user?.student_code || 'Enrolled'} · Academic Attendance Overview`}
      >
        <Link
          to="/student/checkin"
          className="btn text-xs py-2 px-4 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          Launch QR Check-in →
        </Link>
      </Heading>

      <ErrorBox error={task.error} retry={loadData} />

      {/* 2. Below Limit Attendance Alert Banner */}
      {belowLimitSections.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 shadow-xs flex items-start gap-3.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-200 text-amber-900 shrink-0 mt-0.5">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-1 flex-1">
            <p className="font-bold text-sm text-amber-950">Minimum Attendance Threshold Alert</p>
            <p className="text-xs text-amber-900 leading-relaxed">
              You are currently below the required attendance threshold in <strong>{belowLimitSections.length} enrolled section(s)</strong>.
              Institutional regulations require meeting the 75% threshold to qualify for final exams. If an attendance record requires manual correction, please contact your instructor.
            </p>
          </div>
        </div>
      )}

      {/* 3. Actionable Face Enrolment Notice (if incomplete) */}
      {!loading && (!hasConsented || !isEnrolled) && (
        <div className="card border-teal-200 bg-teal-50/50 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 text-teal-800 shrink-0 mt-0.5">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-teal-950">
                Face Enrolment Required for 2-Factor Verification
              </p>
              <p className="text-xs text-teal-900 leading-relaxed">
                {!hasConsented
                  ? 'To check in via classroom QR or camera recognition, review biometric consent and complete your 5-pose reference enrolment.'
                  : `You have registered ${enrolStatus?.count || 0} of 5 required reference poses. Complete all poses to activate classroom verification.`}
              </p>
            </div>
          </div>
          <Link
            to="/student/enrol"
            className="btn text-xs py-2 px-4 shadow-sm shrink-0"
          >
            {!hasConsented ? 'Review Consent & Enrol →' : 'Complete Reference Poses →'}
          </Link>
        </div>
      )}

      {/* 4. University Metric Cards */}
      {loading ? (
        <SkeletonLoader count={1} className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Enrolled Sections"
            value={totalSections}
            detail="Active course rosters"
            badge={<Badge variant="info">SECTIONS</Badge>}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />

          <StatCard
            title="Average Attendance"
            value={calculatedAvg === null ? '—' : `${calculatedAvg}%`}
            detail={
              calculatedAvg === null
                ? 'No closed sessions yet'
                : 'Across all evaluated closed sessions'
            }
            highlight={calculatedAvg !== null && calculatedAvg >= 75}
            badge={
              calculatedAvg !== null ? (
                calculatedAvg >= 75 ? (
                  <Badge variant="live">COMPLIANT</Badge>
                ) : (
                  <Badge variant="expired">LOW</Badge>
                )
              ) : (
                <Badge variant="neutral">PENDING</Badge>
              )
            }
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />

          <StatCard
            title="Academic Standing"
            value={belowLimitSections.length === 0 ? 'Good Standing' : 'At Risk'}
            detail={
              belowLimitSections.length === 0
                ? 'Meets minimum course limits'
                : `${belowLimitSections.length} section(s) below threshold`
            }
            badge={
              belowLimitSections.length === 0 ? (
                <Badge variant="live">VERIFIED</Badge>
              ) : (
                <Badge variant="danger">ATTENTION</Badge>
              )
            }
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          <StatCard
            title="Face Enrolment"
            value={isEnrolled ? 'Active' : 'Incomplete'}
            detail={
              isEnrolled
                ? `${enrolStatus?.count || 5} reference poses registered`
                : 'Enrol 5 poses to unlock verification'
            }
            badge={
              isEnrolled ? (
                <Badge variant="live">READY</Badge>
              ) : (
                <Badge variant="expired">ACTION</Badge>
              )
            }
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
        </div>
      )}

      {/* 5. Course Attendance Cards Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Enrolled Course Sections</h2>
            <p className="text-xs text-slate-500">
              Evaluated against university threshold limits across closed class sessions.
            </p>
          </div>
          <Link
            to="/student/attendance"
            className="text-xs font-semibold text-teal-800 hover:text-teal-950 underline"
          >
            Full Details →
          </Link>
        </div>

        {loading ? (
          <SkeletonLoader count={2} />
        ) : attendance.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attendance.map(item => {
              const hasPercentage = item.percentage !== null;
              const isBelow = item.below_limit;

              return (
                <div
                  key={item.section_id}
                  className={`card flex flex-col justify-between space-y-4 ${
                    isBelow ? 'border-amber-300 bg-amber-50/20' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-info font-mono font-bold">
                        {item.course}
                      </span>
                      <Badge variant={isBelow ? 'expired' : hasPercentage ? 'live' : 'neutral'}>
                        {isBelow ? 'BELOW LIMIT' : hasPercentage ? 'GOOD STANDING' : 'NEW'}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {item.section}
                    </h3>
                  </div>

                  {/* Percentage Display */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-baseline justify-between">
                      <p
                        className={`text-3xl font-extrabold tracking-tight ${
                          isBelow
                            ? 'text-amber-800'
                            : hasPercentage
                            ? 'text-teal-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {hasPercentage ? `${item.percentage}%` : '—'}
                      </p>
                      <span className="text-xs font-medium text-slate-500">
                        Threshold: {item.limit}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isBelow ? 'bg-amber-600' : 'bg-teal-700'
                        }`}
                        style={{ width: `${item.percentage || 0}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>{item.present} attended of {item.closed_sessions} closed sessions</span>
                      {hasPercentage && (
                        <span className="font-semibold text-slate-700">
                          {item.percentage >= item.limit ? 'Compliant' : 'Action required'}
                        </span>
                      )}
                    </p>

                    {!hasPercentage && (
                      <p className="text-[11px] text-slate-400 italic">
                        No closed sessions yet. Attendance calculated when sessions conclude.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No enrolled course sections yet"
            children="Your student registration is approved and active. Course sections will appear here once an administrator completes your semester section assignments. You can complete your face enrolment now so you are prepared for class sessions."
            action={
              !isEnrolled ? (
                <Link
                  to="/student/enrol"
                  className="btn text-xs py-2 px-4 shadow-sm"
                >
                  Complete Face Enrolment Now →
                </Link>
              ) : null
            }
          />
        )}
      </section>

      {/* 6. Quick Action Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/student/checkin"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge badge-open">
                Attendance Verification
              </span>
              <span className="text-xs font-semibold text-teal-800 group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              Classroom QR + Face Verification
            </h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Scan your instructor's live classroom barcode or enter the session code to verify presence.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-teal-800">
            Requires camera access & reference enrolment
          </div>
        </Link>

        <Link
          to="/student/enrol"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge badge-info">
                Biometric Settings
              </span>
              <span className="text-xs font-semibold text-teal-800 group-hover:translate-x-1 transition-transform">
                Manage →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              Face Enrolment & Consent
            </h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Inspect your reference samples, review data privacy terms, or delete biometric data at any time.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-teal-800">
            {isEnrolled ? 'Enrolment complete (5/5 poses)' : 'Enrolment incomplete'}
          </div>
        </Link>
      </div>

      {/* 7. Academic Notifications */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Academic Notifications</h2>
          <span className="text-xs text-slate-400">
            {notifications.filter(n => !n.read).length} unread
          </span>
        </div>

        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {notifications.slice(0, 5).map(n => (
              <div
                key={n.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <p className={n.read ? 'text-slate-500' : 'text-slate-900 font-semibold'}>
                    {n.message}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    className="btn secondary btn-sm text-xs"
                    onClick={() =>
                      task.run(async () => {
                        await api.post(`/notifications/${n.id}/read`);
                        setNotifications(
                          notifications.map(x => (x.id === n.id ? { ...x, read: true } : x))
                        );
                      })
                    }
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted text-xs py-4 text-center text-slate-400">No alerts or notifications.</p>
        )}
      </section>
    </div>
  );
}
