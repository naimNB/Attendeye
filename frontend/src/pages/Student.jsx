import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Heading,
  ErrorBox,
  Empty,
  useTask,
  StatCard,
  Badge,
  SkeletonLoader,
} from '../components/UI';

export default function Student() {
  const [data, setData] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const task = useTask();

  async function load() {
    setLoading(true);
    await task.run(async () => {
      const [a, n] = await Promise.all([
        api.get('/attendance/me').catch(() => ({ data: [] })),
        api.get('/notifications').catch(() => ({ data: [] })),
      ]);
      setData(a.data || []);
      setNotes(n.data || []);
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totalSections = data.length;
  const belowLimitCount = data.filter(d => d.below_limit).length;
  const evaluatedCourses = data.filter(d => d.percentage !== null);

  const averagePercentage = evaluatedCourses.length > 0
    ? Math.round(
        evaluatedCourses.reduce((sum, d) => sum + d.percentage, 0) /
          evaluatedCourses.length
      )
    : null;

  const defaultLimit = data[0]?.limit || 75;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Heading
        title="My Attendance Records"
        detail="Course-by-course attendance compliance calculated across finalized class sessions."
      >
        <Link
          to="/student/checkin"
          className="btn text-xs py-2 px-4 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          Quick QR Check-in →
        </Link>
      </Heading>

      <ErrorBox error={task.error} retry={load} />

      {/* Threshold Warning Banner */}
      {belowLimitCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 shadow-xs flex items-start gap-3.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-200 text-amber-900 shrink-0 mt-0.5">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-950">Attendance Compliance Notice</p>
            <p className="text-xs text-amber-900 leading-relaxed">
              You are currently below the university threshold in <strong>{belowLimitCount} course section(s)</strong>.
              Students below {defaultLimit}% at the end of the term may be disqualified from sitting final examinations.
              If you have documented excused absences, please request manual review from your instructor.
            </p>
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      {loading ? (
        <SkeletonLoader count={1} className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Enrolled Sections"
            value={totalSections}
            detail="Active academic sections on your roster"
            badge={<Badge variant="info">ENROLLED</Badge>}
            icon={
              <svg className="h-5 w-5 text-teal-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />

          <StatCard
            title="Overall Attendance Rate"
            value={averagePercentage === null ? '—' : `${averagePercentage}%`}
            detail={
              averagePercentage === null
                ? 'No closed sessions yet'
                : 'Across all evaluated closed lectures'
            }
            highlight={averagePercentage !== null && averagePercentage >= defaultLimit}
            badge={
              averagePercentage !== null ? (
                averagePercentage >= defaultLimit ? (
                  <Badge variant="live">COMPLIANT</Badge>
                ) : (
                  <Badge variant="expired">LOW</Badge>
                )
              ) : (
                <Badge variant="neutral">PENDING</Badge>
              )
            }
            icon={
              <svg className="h-5 w-5 text-teal-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />

          <StatCard
            title="Attendance Limit"
            value={`${defaultLimit}%`}
            detail="Official institutional threshold"
            badge={<Badge variant="neutral">POLICY</Badge>}
            icon={
              <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Course Attendance Breakdown Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">Course Sections</h2>
          <span className="text-xs font-semibold text-slate-500">
            {data.length} course{data.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <SkeletonLoader count={2} />
        ) : data.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map(d => {
              const hasPercentage = d.percentage !== null;
              const isBelow = d.below_limit;

              return (
                <div
                  key={d.section_id}
                  className={`card flex flex-col justify-between space-y-4 ${
                    isBelow ? 'border-amber-300 bg-amber-50/20' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-info font-mono font-bold">
                        {d.course}
                      </span>
                      <Badge variant={isBelow ? 'expired' : hasPercentage ? 'live' : 'neutral'}>
                        {isBelow ? 'BELOW LIMIT' : hasPercentage ? 'GOOD STANDING' : 'NEW'}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {d.section}
                    </h3>
                  </div>

                  {/* Percentage Metric */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-baseline justify-between">
                      <p
                        className={`text-4xl font-extrabold tracking-tight ${
                          isBelow
                            ? 'text-amber-800'
                            : hasPercentage
                            ? 'text-teal-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {hasPercentage ? `${d.percentage}%` : '—'}
                      </p>
                      <span className="text-xs font-medium text-slate-500">
                        Target: {d.limit}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isBelow ? 'bg-amber-600' : 'bg-teal-700'
                        }`}
                        style={{ width: `${d.percentage || 0}%` }}
                      />
                    </div>

                    <p className="text-xs text-slate-600 flex items-center justify-between pt-1">
                      <span>{d.present} attended of {d.closed_sessions} closed sessions</span>
                      {hasPercentage && (
                        <span className="font-semibold text-slate-800">
                          {d.percentage >= d.limit ? 'Compliant' : 'Action required'}
                        </span>
                      )}
                    </p>

                    {!hasPercentage && (
                      <p className="text-[11px] text-slate-400 italic">
                        No closed sessions yet. Attendance calculated when sessions end.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No enrolled sections yet"
            children="You have not been assigned to any course sections by the academic administrator. Once assigned, your course-by-course attendance percentages will be displayed here."
            action={
              <Link to="/student/enrol" className="btn secondary text-xs py-1.5 px-3">
                Review Biometric Enrolment →
              </Link>
            }
          />
        )}
      </section>

      {/* University Attendance Regulations Card */}
      <div className="card bg-slate-50 border-slate-200 p-5 space-y-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <svg className="h-4 w-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          University Attendance Policy
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Attendance percentage is calculated dynamically based on closed academic class sessions.
          Students must attend at least <strong>{defaultLimit}%</strong> of scheduled sessions in each enrolled course.
          In cases of medical or university-approved absences, submit formal documentation to your faculty instructor for manual correction.
        </p>
      </div>
    </div>
  );
}
