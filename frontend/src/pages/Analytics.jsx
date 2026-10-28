import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { api, download } from '../api/client';
import { Heading, ErrorBox, useTask, Empty } from '../components/UI';

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="card space-y-4">
      <div className="border-b border-slate-100 pb-2.5">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

const PALETTE = ['#0f766e', '#1e293b', '#d97706', '#4f46e5', '#0284c7', '#be123c'];

export default function Analytics() {
  const task = useTask();
  const [data, setData] = useState(null);
  const [sections, setSections] = useState([]);
  const [section, setSection] = useState('');
  const [demo, setDemo] = useState(false);

  const query = `?include_demo=${demo}${section ? `&section_id=${section}` : ''}`;

  useEffect(() => {
    task.run(async () => {
      const [analyticsRes, sectionsRes] = await Promise.all([
        api.get(`/analytics${query}`),
        api.get('/sections').catch(() => ({ data: [] })),
      ]);
      setData(analyticsRes.data);
      setSections(sectionsRes.data || []);
    });
  }, [query]);

  const lines = useMemo(
    () => [...new Set((data?.over_time || []).map(r => r.section))],
    [data]
  );

  const timeline = useMemo(() => {
    const map = {};
    for (const r of data?.over_time || []) {
      map[r.date] ||= { date: r.date };
      map[r.date][r.section] = r.percentage;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const hasClosedSessions = Boolean(data?.sessions && data.sessions.length > 0);

  return (
    <div className="space-y-6">
      <Heading
        tag="Faculty Analytics"
        title="Attendance Analytics"
        detail="Aggregated attendance trends, review workload metrics, and compliance analysis across finalized sessions."
      />

      <ErrorBox error={task.error} />

      {/* Filter and Configuration Toolbar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="section-filter" className="text-xs font-semibold text-slate-700">
            Assigned Section:
          </label>
          <select
            id="section-filter"
            aria-label="Section filter"
            className="text-xs py-1.5 px-3 rounded-lg border-slate-300 w-64 max-w-full"
            value={section}
            onChange={e => {
              setData(null);
              setSection(e.target.value);
            }}
          >
            <option value="">All assigned sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {s.course_code} · {s.name} {s.room ? `(${s.room})` : ''}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            checked={demo}
            onChange={e => {
              setData(null);
              setDemo(e.target.checked);
            }}
          />
          <span>Include demonstration (DEMO) records</span>
        </label>
      </div>

      {/* Demo Data Disclaimer Banner */}
      {demo && (
        <div
          role="note"
          className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 flex items-start gap-3 shadow-sm"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-200 text-amber-900 shrink-0 mt-0.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <strong className="block font-semibold">Demonstration Records Active</strong>
            <p className="text-amber-900 mt-0.5">
              The metrics displayed below include synthetic sample records for demonstration purposes. These are not real live class verification sessions.
            </p>
          </div>
        </div>
      )}

      {/* Main Analytics Content */}
      {data && (
        <>
          {/* Key Metric Highlights */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Closed Sessions
              </span>
              <p className="text-2xl font-bold text-slate-900">{data.sessions?.length || 0}</p>
              <p className="text-[11px] text-slate-400">Finalized for calculation</p>
            </div>

            <div className="card p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                At-Risk Students
              </span>
              <p className="text-2xl font-bold text-rose-700">{data.at_risk?.length || 0}</p>
              <p className="text-[11px] text-slate-400">Below 75% attendance threshold</p>
            </div>

            <div className="card p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Review Verifications
              </span>
              <p className="text-2xl font-bold text-amber-700">
                {(data.review || []).reduce((acc, curr) => acc + (curr.count || 0), 0)}
              </p>
              <p className="text-[11px] text-slate-400">Flagged face items resolved</p>
            </div>

            <div className="card p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Manual Corrections
              </span>
              <p className="text-2xl font-bold text-indigo-700">
                {(data.corrections || []).reduce((acc, curr) => acc + (curr.count || 0), 0)}
              </p>
              <p className="text-[11px] text-slate-400">Adjusted by instructors</p>
            </div>
          </div>

          {!hasClosedSessions ? (
            <div className="card text-center py-12 space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">No Finalized Sessions Recorded</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Analytics are computed exclusively from closed, finalized class sessions to ensure academic record integrity. Close an active session or toggle synthetic DEMO data above to preview charts.
              </p>
            </div>
          ) : (
            <>
              {/* Analytics Charts Grid */}
              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Attendance Compliance Rate Over Time"
                  subtitle="Percentage of enrolled students marked present per session"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      {lines.map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          connectNulls
                          dataKey={name}
                          stroke={PALETTE[i % PALETTE.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Per-Session Attendance Performance"
                  subtitle="Recent finalized sessions attendance percentages"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.sessions} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="session" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="rate" fill="#0f766e" radius={[4, 4, 0, 0]} name="Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Attendance Distribution by Day of Week"
                  subtitle="Identifies recurring attendance patterns across lecture timetables"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weekday} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="rate" fill="#1e293b" radius={[4, 4, 0, 0]} name="Avg Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Recognition & Verification Resolution Counts"
                  subtitle="Volume of automatic biometric confirmations vs human resolutions"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.review} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} name="Total Items" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* At-Risk Students Compliance Table */}
              <section className="card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">At-Risk Student Monitoring</h2>
                    <p className="text-xs text-slate-500">
                      Students whose attendance compliance is below the 75% institutional threshold or rapidly trending downward.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    onClick={() =>
                      task.run(() => download(`/analytics/at-risk.csv${query}`, 'at-risk-students.csv'))
                    }
                  >
                    <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export At-Risk CSV
                  </button>
                </div>

                {data.at_risk && data.at_risk.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Section</th>
                          <th>Overall Rate</th>
                          <th>Recent 5 Sessions</th>
                          <th>Previous 5 Sessions</th>
                          <th>Compliance Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.at_risk.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="font-semibold text-slate-900">{r.name}</td>
                            <td className="text-xs font-mono text-slate-600">{r.section}</td>
                            <td>
                              <span
                                className={`font-bold ${
                                  r.percentage < 75 ? 'text-rose-700' : 'text-slate-800'
                                }`}
                              >
                                {r.percentage}%
                              </span>
                            </td>
                            <td className="text-xs text-slate-700 font-medium">{r.recent_5}%</td>
                            <td className="text-xs text-slate-500">
                              {r.previous_5 == null ? '—' : `${r.previous_5}%`}
                            </td>
                            <td>
                              {r.trending_down ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 text-xs font-medium">
                                  <svg className="h-3 w-3 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                  </svg>
                                  Trending Down
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 text-xs font-medium">
                                  Below 75% Limit
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="No At-Risk Students"
                    children="All students in this selection currently meet or exceed the attendance requirements."
                  />
                )}
              </section>

              {/* Manual Corrections Reason Analysis */}
              <ChartCard
                title="Instructor Attendance Corrections by Reason"
                subtitle="Categorical breakdown of why manual adjustments were made"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.corrections} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="reason" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Corrections Count" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Institutional Methodology Note */}
              {data.definitions && (
                <div className="card bg-slate-50/80 border-slate-200 text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Calculation Methodology & Rules:</p>
                  <p>{data.definitions}</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
