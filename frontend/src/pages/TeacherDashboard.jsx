import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../components/Auth';
import {
  Heading,
  ErrorBox,
  Empty,
  useTask,
  StatCard,
  Badge,
  Modal,
  Field,
  SkeletonLoader,
} from '../components/UI';

function localIsoString(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth('teacher');
  const navigate = useNavigate();
  const task = useTask();

  const [sessions, setSessions] = useState([]);
  const [sections, setSections] = useState([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Create session modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    section_id: '',
    starts_at: localIsoString(new Date()),
    ends_at: localIsoString(new Date(Date.now() + 2 * 3600000)),
    require_qr: true,
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadData() {
    setLoading(true);
    await task.run(async () => {
      const [sessRes, secRes] = await Promise.all([
        api.get('/sessions'),
        api.get('/sections'),
      ]);
      setSessions(sessRes.data || []);
      setSections(secRes.data || []);

      // Fetch pending reviews count using actual analytics endpoint
      try {
        const analyticsRes = await api.get('/analytics');
        const reviewCounts = analyticsRes.data?.review || [];
        const pendingItem = reviewCounts.find(r => r.name === 'pending');
        setPendingReviewsCount(pendingItem?.count || 0);
      } catch (_) {
        // Fallback: If analytics is unavailable, pending count remains 0
        setPendingReviewsCount(0);
      }
    });
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Classify sessions by operational status
  const now = new Date();
  const activeSessions = sessions.filter(
    s => s.status === 'open' && new Date(s.ends_at) >= now
  );
  const expiredSessions = sessions.filter(
    s => s.status === 'open' && new Date(s.ends_at) < now
  );
  const closedSessions = sessions.filter(s => s.status === 'closed');

  // Filter sessions scheduled for today
  const todaySessions = sessions.filter(s => {
    const start = new Date(s.starts_at);
    return isSameDay(start, now);
  });

  // Formatted date string for academic header
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now);

  async function handleCreateSession(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      if (!form.section_id) {
        setCreateError('Please select a course section.');
        setCreating(false);
        return;
      }
      const res = await api.post('/sessions', {
        section_id: Number(form.section_id),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        require_qr: Boolean(form.require_qr),
      });
      setCreateModalOpen(false);
      navigate(`/teacher/sessions/${res.data.id}`);
    } catch (err) {
      setCreateError(err.response?.data?.detail || err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  function getSectionLabel(sectionId) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return `Section #${sectionId}`;
    return `${sec.course_code} · ${sec.name}`;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Heading
        title={`Welcome, ${user?.name || 'Instructor'}`}
        date={todayFormatted}
        detail="Academic Attendance Management & Computer Vision Workspace"
      >
        <button
          type="button"
          onClick={() => {
            setForm({
              section_id: sections[0]?.id ? String(sections[0].id) : '',
              starts_at: localIsoString(new Date()),
              ends_at: localIsoString(new Date(Date.now() + 2 * 3600000)),
              require_qr: true,
            });
            setCreateError('');
            setCreateModalOpen(true);
          }}
          className="btn shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Session
        </button>
      </Heading>

      <ErrorBox error={task.error} retry={loadData} />

      {/* Real API Summary Cards */}
      {loading ? (
        <SkeletonLoader count={1} className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Live Sessions"
            value={activeSessions.length}
            detail={
              activeSessions.length > 0
                ? 'Accepting live biometric check-ins'
                : 'No active session running now'
            }
            highlight={activeSessions.length > 0}
            badge={
              activeSessions.length > 0 ? (
                <Badge variant="live">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  LIVE NOW
                </Badge>
              ) : null
            }
            icon={
              <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          />

          <StatCard
            title="Pending Reviews"
            value={pendingReviewsCount}
            detail={
              pendingReviewsCount > 0
                ? 'Unconfirmed faces needing teacher verification'
                : 'All face detections resolved'
            }
            highlight={pendingReviewsCount > 0}
            badge={
              pendingReviewsCount > 0 ? (
                <Badge variant="review">ACTION NEEDED</Badge>
              ) : (
                <Badge variant="neutral">UP TO DATE</Badge>
              )
            }
            icon={
              <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />

          <StatCard
            title="Assigned Sections"
            value={sections.length}
            detail="Active teaching rosters"
            badge={<Badge variant="info">SECTIONS</Badge>}
            icon={
              <svg className="h-5 w-5 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />

          <StatCard
            title="Completed Sessions"
            value={closedSessions.length}
            detail={`${sessions.length} total sessions recorded`}
            badge={<Badge variant="neutral">ARCHIVED</Badge>}
            icon={
              <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/teacher/sessions"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-emerald-50 text-emerald-800 border border-emerald-200">
                Sessions
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Browse →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Class Sessions & Live View</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Open attendance windows, display rotating 30-second QR codes, or capture classroom photos.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
            {sessions.length} total session{sessions.length !== 1 ? 's' : ''} in record
          </div>
        </Link>

        <Link
          to="/teacher/analytics"
          className="card card-hover flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-teal-50 text-teal-800 border border-teal-200">
                Analytics
              </span>
              <span className="text-xs font-semibold text-pine group-hover:translate-x-1 transition-transform">
                Explore →
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Attendance Trends & Risk</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Track attendance percentage by section, spot at-risk students below threshold, and review audit records.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
            Download CSV / View charts
          </div>
        </Link>

        <div className="card bg-slate-50/80 border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="badge bg-slate-200/80 text-slate-700">Policy</span>
              <span className="text-xs text-slate-500 font-mono">CV 1.0</span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Ethical AI Standards</h3>
            <p className="muted mt-1 text-xs leading-relaxed">
              Facial biometrics are computed in volatile memory. Unrecognized faces are never auto-assigned; human review is mandatory.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs text-slate-500">
            Compliant with university data privacy rules
          </div>
        </div>
      </div>

      {/* Main Content Area: Today's Schedule & Recent Sessions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2/3): Today's Schedule + Recent Activity */}
        <div className="space-y-6 lg:col-span-2">
          {/* Today's Schedule Section */}
          <section className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-pine">Today's Class Schedule</h2>
                <p className="text-xs text-slate-500">Scheduled attendance sessions for {todayFormatted}</p>
              </div>
              {todaySessions.length > 0 && (
                <span className="badge badge-info">{todaySessions.length} Scheduled</span>
              )}
            </div>

            {loading ? (
              <SkeletonLoader count={2} />
            ) : todaySessions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {todaySessions.map(s => {
                  const isExpired = s.status === 'open' && new Date(s.ends_at) < now;
                  const isLive = s.status === 'open' && !isExpired;

                  return (
                    <div
                      key={s.id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {getSectionLabel(s.section_id)}
                          </span>
                          {isLive && (
                            <Badge variant="live">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              LIVE NOW
                            </Badge>
                          )}
                          {isExpired && <Badge variant="expired">TIME EXPIRED</Badge>}
                          {s.status === 'closed' && <Badge variant="closed">CLOSED</Badge>}
                          {s.is_demo && <Badge variant="demo">DEMO</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(s.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(s.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {s.require_qr ? 'QR + Face Check-in' : 'Photo / Video Capture'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/teacher/sessions/${s.id}`}
                          className={`btn text-xs py-1.5 px-3.5 ${isLive ? 'bg-pine text-white' : 'secondary'}`}
                        >
                          {isLive ? 'Open Capture Workspace →' : 'Manage Session →'}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                title="No sessions scheduled for today"
                children="You can start an immediate session or schedule one for your assigned sections."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        section_id: sections[0]?.id ? String(sections[0].id) : '',
                        starts_at: localIsoString(new Date()),
                        ends_at: localIsoString(new Date(Date.now() + 2 * 3600000)),
                        require_qr: true,
                      });
                      setCreateError('');
                      setCreateModalOpen(true);
                    }}
                    className="btn secondary text-xs py-1.5 px-3"
                  >
                    + Schedule Session for Today
                  </button>
                }
              />
            )}
          </section>

          {/* Recent Sessions List */}
          <section className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-pine">Recent Class Sessions</h2>
                <p className="text-xs text-slate-500">Previous sessions across your assigned courses</p>
              </div>
              <Link
                to="/teacher/sessions"
                className="text-xs font-semibold text-pine hover:underline"
              >
                View All ({sessions.length}) →
              </Link>
            </div>

            {loading ? (
              <SkeletonLoader count={3} />
            ) : sessions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {sessions.slice(0, 6).map(s => {
                  const isExpired = s.status === 'open' && new Date(s.ends_at) < now;
                  const isLive = s.status === 'open' && !isExpired;

                  return (
                    <div
                      key={s.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {getSectionLabel(s.section_id)}
                          </span>
                          {isLive && <Badge variant="live">LIVE</Badge>}
                          {isExpired && <Badge variant="expired">EXPIRED</Badge>}
                          {s.status === 'closed' && <Badge variant="closed">CLOSED</Badge>}
                          {s.is_demo && <Badge variant="demo">DEMO</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">
                          Session #{s.id} · {new Date(s.starts_at).toLocaleDateString()} at{' '}
                          {new Date(s.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {s.require_qr ? 'QR + Face' : 'Photo capture'}
                        </p>
                      </div>

                      <Link
                        to={`/teacher/sessions/${s.id}`}
                        className="btn secondary text-xs py-1.5 px-3"
                      >
                        Details →
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>No class sessions created yet.</Empty>
            )}
          </section>
        </div>

        {/* Right Column (1/3): Assigned Sections & Quick Faculty Guide */}
        <div className="space-y-6">
          {/* Assigned Sections Card */}
          <section className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-pine">My Course Sections</h2>
              <span className="text-xs text-slate-500 font-medium">
                {sections.length} active
              </span>
            </div>

            {loading ? (
              <SkeletonLoader count={2} />
            ) : sections.length > 0 ? (
              <div className="space-y-2.5">
                {sections.map(sec => (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-slate-200/80 p-3 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                        {sec.course_code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Section #{sec.id}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-sm text-slate-900">{sec.name}</p>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/50">
                      <span className="text-[11px] text-slate-500">Semester Term</span>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            section_id: String(sec.id),
                            starts_at: localIsoString(new Date()),
                            ends_at: localIsoString(new Date(Date.now() + 2 * 3600000)),
                            require_qr: true,
                          });
                          setCreateError('');
                          setCreateModalOpen(true);
                        }}
                        className="text-xs font-semibold text-pine hover:underline"
                      >
                        + Start Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty children="No sections assigned to your faculty profile." />
            )}
          </section>

          {/* Pending Reviews Notice (if applicable) */}
          {pendingReviewsCount > 0 && (
            <div className="card border-amber-300 bg-amber-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Pending Review Items
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                You have <strong>{pendingReviewsCount}</strong> face match item(s) awaiting resolution across recent class sessions. Inspect thumbnails and confirm student IDs.
              </p>
              <Link
                to="/teacher/sessions"
                className="inline-block mt-2 text-xs font-bold text-amber-900 underline hover:text-amber-950"
              >
                Go to Sessions to resolve reviews →
              </Link>
            </div>
          )}

          {/* Quick Guidance Box */}
          <div className="card bg-emerald-50/40 border-emerald-200/80 p-4 space-y-2">
            <div className="flex items-center gap-2 text-pine font-bold text-sm">
              <svg className="h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Faculty Tips
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Ensure good classroom lighting when taking group photographs.</li>
              <li>Rotating QR check-in enforces 2-factor physical attendance.</li>
              <li>Always finalize attendance by closing the session after class.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Prominent Create Session Modal */}
      <Modal
        open={createModalOpen}
        title="Create New Class Session"
        description="Schedule a class session with live QR rotation or classroom computer-vision capture."
        onClose={() => setCreateModalOpen(false)}
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <ErrorBox error={createError} />

          <Field title="Course / Section" required>
            <select
              required
              value={form.section_id}
              onChange={e => setForm({ ...form, section_id: e.target.value })}
            >
              <option value="">Select an assigned section...</option>
              {sections.map(s => (
                <option value={s.id} key={s.id}>
                  {s.course_code} · {s.name} (ID: {s.id})
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-950 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-emerald-400 text-pine focus:ring-emerald-500"
              checked={form.require_qr}
              onChange={e => setForm({ ...form, require_qr: e.target.checked })}
            />
            <div>
              <span className="font-bold">Require QR + face check-in (Recommended)</span>
              <p className="text-slate-600 mt-0.5">
                Displays a rotating 30-second token that students scan on mobile alongside biometric liveness.
              </p>
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field title="Start Time" hint="Local time" required>
              <input
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={e => setForm({ ...form, starts_at: e.target.value })}
              />
            </Field>

            <Field title="End Time" hint="Local time" required>
              <input
                type="datetime-local"
                required
                value={form.ends_at}
                onChange={e => setForm({ ...form, ends_at: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="btn secondary text-xs py-2 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn text-xs py-2 px-5"
            >
              {creating ? 'Creating Session...' : 'Create & Open Workspace →'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
