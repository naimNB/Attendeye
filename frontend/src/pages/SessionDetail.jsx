import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, download, errorText } from '../api/client';
import { Webcam, captureBurst } from '../components/Webcam';
import {
  ErrorBox,
  Heading,
  Progress,
  Field,
  Empty,
  useTask,
  Badge,
  Modal,
  SkeletonLoader,
} from '../components/UI';

// Face thumbnail with safe memory blob handling and unmount cleanup
function Thumbnail({ id }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resource;

    api
      .get(`/review/${id}/thumbnail`, { responseType: 'blob' })
      .then(r => {
        resource = URL.createObjectURL(r.data);
        if (!cancelled) setUrl(resource);
        else URL.revokeObjectURL(resource);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (resource) URL.revokeObjectURL(resource);
    };
  }, [id]);

  if (url) {
    return (
      <img
        src={url}
        alt="Temporary review crop"
        className="h-24 w-24 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0"
      />
    );
  }

  return (
    <div className="grid h-24 w-24 place-items-center rounded-xl bg-slate-100 text-[11px] text-slate-500 text-center p-2 border border-slate-200 shrink-0">
      {failed ? 'Thumbnail expired' : 'Loading crop…'}
    </div>
  );
}

// Review card for teacher verification of flagged faces
function ReviewCard({ item, roster, resolve, busy }) {
  const [student, setStudent] = useState('');
  const [reason, setReason] = useState('');

  return (
    <article className="card space-y-4 border-slate-200">
      <div className="flex gap-4">
        {item.has_thumbnail && <Thumbnail id={item.id} />}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={item.status === 'pending' ? 'review' : 'neutral'}>
              {item.status.toUpperCase()}
            </Badge>
            <span className="text-xs text-slate-400 font-mono">Item #{item.id}</span>
          </div>
          <p className="text-sm font-medium text-slate-900 leading-snug">{item.reason}</p>
          <p className="text-xs text-slate-500">
            Enrolled class roster: {roster.length} students
          </p>
        </div>
      </div>

      {item.status === 'pending' && (
        <div className="space-y-3 pt-3 border-t border-slate-100">
          {item.candidates && item.candidates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">
                Suggested Candidates (Cosine Similarity):
              </p>
              <div className="flex flex-wrap gap-2">
                {item.candidates.map(c => {
                  const isSelected = String(student) === String(c.student_id);
                  return (
                    <button
                      key={c.student_id}
                      type="button"
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                        isSelected
                          ? 'bg-teal-700 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      onClick={() => setStudent(String(c.student_id))}
                    >
                      {c.name} · Score {c.score.toFixed(3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field title="Assign to Student from Class Roster">
            <select
              value={student}
              onChange={e => setStudent(e.target.value)}
              className="text-xs py-1.5"
            >
              <option value="">Reject / No match (Unidentified person)</option>
              {roster.map(u => (
                <option value={u.id} key={u.id}>
                  {u.name} ({u.student_code || `ID #${u.id}`})
                </option>
              ))}
            </select>
          </Field>

          <Field
            title="Resolution Reason (Mandatory)"
            hint="Min 3 characters for audit logging"
            required
          >
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Visual verification from seat 4; or Unenrolled visitor"
              className="text-xs"
            />
          </Field>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              className={`btn text-xs py-2 px-4 ${student ? 'bg-teal-700 hover:bg-teal-800 text-white' : 'danger'}`}
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                resolve(item.id, {
                  student_id: student ? Number(student) : null,
                  reason: reason.trim(),
                })
              }
            >
              {student ? 'Confirm Student Present' : 'Reject & Mark Unknown'}
            </button>
            <span className="text-[11px] text-slate-400">
              Audit logged permanently with instructor ID
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export default function SessionDetail() {
  const { id } = useParams();
  const task = useTask();
  const camera = useRef();

  // Core Data
  const [session, setSession] = useState(null);
  const [section, setSection] = useState(null);
  const [roster, setRoster] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [records, setRecords] = useState([]);
  const [audit, setAudit] = useState([]);
  const [livenessStatus, setLivenessStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Workspace Navigation Tab
  const [tab, setTab] = useState('capture'); // 'capture' | 'qr' | 'review' | 'records' | 'reports' | 'audit'

  // Capture Workspace State
  const [captureMode, setCaptureMode] = useState('camera'); // 'camera' | 'photo'
  const [cameraOn, setCameraOn] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState('');
  const [previewFrame, setPreviewFrame] = useState(0);
  const [phase, setPhase] = useState('');
  const [burstCount, setBurstCount] = useState(null);
  const [burstTotal, setBurstTotal] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [debug, setDebug] = useState(false);

  // QR Check-in State
  const [qr, setQr] = useState(null);
  const [qrError, setQrError] = useState('');

  // Modals
  const [editingRecord, setEditingRecord] = useState(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  async function load() {
    try {
      const [s, u, r, a, h, secList] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get(`/sessions/${id}/roster`),
        api.get(`/sessions/${id}/review`),
        api.get(`/sessions/${id}/records`),
        api.get(`/sessions/${id}/audit`),
        api.get('/sections').catch(() => ({ data: [] })),
      ]);
      setSession(s.data);
      setRoster(u.data || []);
      setReviews(r.data || []);
      setRecords(a.data || []);
      setAudit(h.data || []);

      if (s.data?.section_id && secList.data) {
        const found = secList.data.find(item => item.id === s.data.section_id);
        if (found) setSection(found);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    task.run(load);
    api
      .get('/liveness/status')
      .then(r => setLivenessStatus(r.data))
      .catch(() => {});
  }, [id]);

  // Cleanup local image URL on unmount or replace
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const isTimeExpired = session && new Date(session.ends_at) < new Date();
  const isCaptureAllowed = session && session.status === 'open' && !isTimeExpired;

  // Live QR Polling (rotates every 30s)
  useEffect(() => {
    if (!session?.require_qr || session.status !== 'open') return;
    if (new Date(session.ends_at) < new Date()) {
      setQr(null);
      setQrError('Session scheduled time window has passed. Capture is disabled.');
      return;
    }

    let cancelled = false;
    let timer;

    async function refresh() {
      try {
        const { data } = await api.get(`/sessions/${id}/qr`);
        if (!cancelled) {
          setQr(data);
          setQrError('');
          timer = setTimeout(refresh, (data.expires_in || 30) * 1000);
        }
      } catch (e) {
        if (!cancelled) {
          setQr(null);
          setQrError(errorText(e));
          timer = setTimeout(refresh, 5000);
        }
      }
    }

    refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, session?.require_qr, session?.status, session?.ends_at]);

  // Handle Photo Upload
  function handleFileSelection(e) {
    const selected = e.target.files?.[0];
    setFileError('');
    if (!selected) {
      setFile(null);
      return;
    }

    // Supported formats: JPEG, PNG, WEBP, up to 8MB
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selected.type)) {
      setFileError('Invalid image format. Supported formats: JPEG, PNG, WEBP.');
      setFile(null);
      return;
    }

    if (selected.size > 8 * 1024 * 1024) {
      setFileError('File size exceeds the 8 MB maximum limit.');
      setFile(null);
      return;
    }

    setFile(selected);
  }

  async function submitPhoto() {
    if (!file) return;
    await task.run(async () => {
      try {
        const body = new FormData();
        body.append('image', file);
        body.append('volunteers_confirmed', consent);
        body.append('debug', debug);

        setPreviewFrame(0);
        setBurstCount(null);
        setBurstTotal(null);
        setPreview(URL.createObjectURL(file));
        setPhase('Detecting faces, analyzing liveness, and matching section roster…');

        const { data } = await api.post(`/sessions/${id}/capture-photo`, body);
        setResult(data);
        await load();
      } catch (err) {
        setResult(null);
        setPreview('');
        throw err;
      }
    });
  }

  // Handle Live Camera Burst Capture
  async function submitLiveBurst() {
    await task.run(async () => {
      try {
        const { data: challenge } = await api.post('/liveness/challenge', {
          session_id: Number(id),
        });
        setPrompt(challenge);
        setPhase('Follow challenge prompt. Capture begins in 2 seconds.');

        await new Promise(res => setTimeout(res, 2000));

        const frames = await captureBurst(
          camera.current,
          (n, total) => {
            setBurstCount(n);
            setBurstTotal(total);
            setPhase(`Capturing frame ${n} of ${total} — execute the challenge`);
          },
          { prompt: challenge.prompt, count: 8 }
        );

        const body = new FormData();
        frames.forEach((f, i) => body.append('frames', f, `frame-${i}.jpg`));
        body.append('challenge_token', challenge.token);
        body.append('volunteers_confirmed', consent);
        body.append('debug', debug);

        setPreviewFrame(frames.length - 1);
        setPreview(URL.createObjectURL(frames[frames.length - 1]));
        setBurstCount(null);
        setBurstTotal(null);
        setPhase('Server computing facial landmarks, liveness motion, and feature vectors…');

        const { data } = await api.post(`/sessions/${id}/capture-frames`, body);
        setResult(data);
        setPrompt(null);
        await load();
      } catch (err) {
        setResult(null);
        setPreview('');
        setPrompt(null);
        setBurstCount(null);
        setBurstTotal(null);
        throw err;
      }
    });
  }

  // Handle Session Close
  async function handleCloseSession() {
    await task.run(async () => {
      await api.post(`/sessions/${id}/close`);
      setCloseConfirmOpen(false);
      await load();
    });
  }

  const pendingReviews = reviews.filter(r => r.status === 'pending');
  const displayedBoxes = result?.boxes?.filter(b => b.frame === previewFrame) || [];

  return (
    <div className="space-y-5">
      {/* 1. Academic Session Header */}
      <div className="card space-y-4 border-slate-200/90 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                to="/teacher/sessions"
                className="text-xs font-semibold text-slate-500 hover:text-teal-700 flex items-center gap-1"
              >
                ← Class Sessions
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-bold text-slate-700">Session #{id}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {section ? `${section.course_code} · ${section.name}` : `Class Session #${id}`}
              </h1>

              {session?.status === 'open' && !isTimeExpired && (
                <Badge variant="live">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  LIVE NOW
                </Badge>
              )}
              {session?.status === 'open' && isTimeExpired && (
                <Badge variant="expired">TIME EXPIRED</Badge>
              )}
              {session?.status === 'closed' && <Badge variant="closed">CLOSED</Badge>}
              {session?.is_demo && <Badge variant="demo">DEMO DATA</Badge>}
            </div>

            {session && (
              <p className="text-xs text-slate-500">
                Window:{' '}
                <span className="font-medium text-slate-700">
                  {new Date(session.starts_at).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {new Date(session.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(session.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {' · '}
                Room: <span className="font-medium text-slate-700 font-mono">{session.room || section?.room || '—'}</span>
                {' · '}
                Roster: <span className="font-medium text-slate-700">{roster.length} students</span>
              </p>
            )}
          </div>

          {/* Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {livenessStatus && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                Engine: <strong className="text-emerald-800">{livenessStatus.active_backend.toUpperCase()}</strong>
                {livenessStatus.active_backend === 'baseline' && !livenessStatus.baseline_auto && ' (Review Mode)'}
              </span>
            )}

            {session?.status === 'open' && (
              <button
                type="button"
                onClick={() => setCloseConfirmOpen(true)}
                disabled={task.busy}
                className="btn secondary text-xs py-2 px-3.5 hover:border-rose-300 hover:text-rose-900"
              >
                Close & Finalize Session
              </button>
            )}
          </div>
        </div>

        {/* Time expired alert notice */}
        {session?.status === 'open' && isTimeExpired && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-bold text-xs uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                <svg className="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Scheduled Attendance Window Has Ended
              </p>
              <p className="text-xs text-amber-800">
                This session scheduled end time passed at {new Date(session.ends_at).toLocaleTimeString()}. Camera capture and QR check-in are disabled. Please close this session to record absent statuses.
              </p>
            </div>
            <button
              type="button"
              className="btn danger text-xs py-2 px-4 shadow-sm"
              disabled={task.busy}
              onClick={() => setCloseConfirmOpen(true)}
            >
              Close & Finalize Now
            </button>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <button
            type="button"
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === 'capture' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setTab('capture')}
          >
            Capture Workspace
          </button>

          {session?.require_qr && (
            <button
              type="button"
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === 'qr' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setTab('qr')}
            >
              QR Code Check-in
            </button>
          )}

          <button
            type="button"
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === 'review' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setTab('review')}
          >
            Review Queue
            {pendingReviews.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-200 text-amber-900 px-1.5 py-0.2 text-[10px] font-bold">
                {pendingReviews.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === 'records' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setTab('records')}
          >
            Attendance Records ({records.length})
          </button>

          <button
            type="button"
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === 'reports' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setTab('reports')}
          >
            Reports & Export
          </button>

          <button
            type="button"
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === 'audit' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setTab('audit')}
          >
            Audit Trail ({audit.length})
          </button>
        </div>
      </div>

      <ErrorBox error={task.error} />

      {/* ================= TAB 1: CAPTURE WORKSPACE ================= */}
      {tab === 'capture' && (
        <div className="space-y-6">
          {/* Quick Notice if QR Check-in is active */}
          {session?.require_qr && (
            <div className="card bg-teal-50/60 border-teal-200/90 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-800 font-bold text-sm">
                  QR
                </div>
                <div>
                  <p className="text-xs font-bold text-teal-950">
                    2-Factor QR Check-in Active for this Session
                  </p>
                  <p className="text-xs text-teal-800">
                    Students scan the rotating 30s QR code on mobile while doing facial liveness check.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab('qr')}
                className="btn secondary text-xs py-1.5 px-3 bg-white hover:border-teal-400"
              >
                Display Projector QR Code →
              </button>
            </div>
          )}

          {/* Desktop 2-Column CV Workspace */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* LEFT COLUMN: Large Camera / Photo Viewfinder (7 cols) */}
            <div className="space-y-4 lg:col-span-7 xl:col-span-8">
              <div className="card p-4 space-y-3 bg-white">
                {/* Mode Selector Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        captureMode === 'camera'
                          ? 'bg-white text-teal-800 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => setCaptureMode('camera')}
                    >
                      Live Camera Burst
                    </button>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        captureMode === 'photo'
                          ? 'bg-white text-teal-800 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => setCaptureMode('photo')}
                    >
                      Classroom Photo
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {captureMode === 'camera' ? '8-Frame Burst Liveness' : 'High-Res Photo Match'}
                  </span>
                </div>

                {/* Live Challenge Banner (when in challenge burst) */}
                {prompt && (
                  <div
                    role="alert"
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 text-xs font-semibold shadow-sm flex items-center gap-2.5 animate-pulse"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-200 text-amber-900 shrink-0">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </span>
                    <span>{prompt.instructions}</span>
                  </div>
                )}

                {/* Viewfinder / Preview Container */}
                <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                  {/* View 1: Photo or Burst Frame Preview with Bounding Boxes */}
                  {preview ? (
                    <div className="relative h-full w-full">
                      <img
                        src={preview}
                        alt="Current capture frame held in memory"
                        className="h-full w-full object-contain"
                      />

                      {/* Bounding Boxes Overlaid Exactly */}
                      {displayedBoxes.map((b, i) => {
                        const left = `${(100 * b.box[0]) / b.width}%`;
                        const top = `${(100 * b.box[1]) / b.height}%`;
                        const width = `${(100 * (b.box[2] - b.box[0])) / b.width}%`;
                        const height = `${(100 * (b.box[3] - b.box[1])) / b.height}%`;

                        const isAuto = b.decision === 'auto';
                        const isReview = b.decision === 'review';
                        const borderColor = isAuto
                          ? 'border-emerald-400 bg-emerald-500/10'
                          : isReview
                          ? 'border-amber-400 bg-amber-500/15'
                          : 'border-slate-400 bg-slate-500/15';
                        const tagBg = isAuto
                          ? 'bg-emerald-800 text-emerald-100'
                          : isReview
                          ? 'bg-amber-800 text-amber-100'
                          : 'bg-slate-800 text-slate-100';

                        return (
                          <div
                            key={i}
                            className={`absolute border-2 transition-all ${borderColor}`}
                            style={{ left, top, width, height }}
                          >
                            <span
                              className={`absolute -top-5 left-0 px-1 py-0.2 text-[9px] font-semibold rounded-sm shadow-sm ${tagBg} whitespace-nowrap`}
                            >
                              {isAuto ? 'Matched' : isReview ? 'Review' : 'Unknown'}
                              {debug && b.score != null && ` (${b.score.toFixed(3)})`}
                            </span>
                          </div>
                        );
                      })}

                      {displayedBoxes.length === 0 && result && (
                        <div className="absolute inset-x-0 bottom-3 text-center">
                          <span className="bg-slate-900/80 text-white text-[11px] px-3 py-1 rounded-full border border-slate-700">
                            No face detections in this frame
                          </span>
                        </div>
                      )}
                    </div>
                  ) : captureMode === 'camera' ? (
                    /* View 2: Live Webcam Stream */
                    cameraOn ? (
                      <div className="h-full w-full">
                        <Webcam ref={camera} />
                      </div>
                    ) : (
                      <div className="p-8 text-center space-y-3">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-slate-400 border border-slate-800">
                          <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Camera Standby</p>
                          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                            Enable camera to test liveness challenge and capture class attendance.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCameraOn(true)}
                          className="btn text-xs py-2 px-4 shadow-sm"
                        >
                          Turn On Camera
                        </button>
                      </div>
                    )
                  ) : (
                    /* View 3: Photo Upload Dropzone */
                    <div className="p-8 text-center space-y-3">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-slate-400 border border-slate-800">
                        <svg className="h-7 w-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Select Classroom Photo</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                          Upload high-resolution wide-angle photograph of the lecture hall.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Viewfinder Controls & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    {preview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreview('');
                          setResult(null);
                        }}
                        className="btn secondary text-xs py-1.5 px-3"
                      >
                        ← Clear Preview / Retake
                      </button>
                    )}
                    {cameraOn && captureMode === 'camera' && !preview && (
                      <button
                        type="button"
                        onClick={() => setCameraOn(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Turn Off Camera
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Frames analyzed in memory. Photos not permanently stored.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Controls, Consent, Actions & Results (5 cols) */}
            <div className="space-y-4 lg:col-span-5 xl:col-span-4">
              {/* Primary Controls Card */}
              <div className="card space-y-4">
                <div className="border-b border-slate-100 pb-2.5">
                  <h2 className="text-base font-bold text-slate-900">Capture Controls</h2>
                  <p className="text-xs text-slate-500">
                    Execute computer vision matching against the class roster.
                  </p>
                </div>

                {/* Mode specific controls */}
                {captureMode === 'photo' && (
                  <div className="space-y-2">
                    <Field
                      title="Select Image File"
                      hint="JPEG, PNG, WEBP · Max 8MB"
                      error={fileError}
                      required
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileSelection}
                        className="text-xs"
                      />
                    </Field>
                    {file && (
                      <p className="text-xs text-emerald-800 font-medium">
                        Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                )}

                {/* Consent Confirmation Checkbox */}
                <label className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-950 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-teal-400 text-teal-700 focus:ring-teal-600"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                  />
                  <div>
                    <span className="font-bold">Mandatory Volunteer Consent</span>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      Every pictured student has given explicit consent to biometric capture and temporary review crop storage.
                    </p>
                  </div>
                </label>

                {/* Teacher Debug Setting (if enabled on backend) */}
                {session?.debug_available && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debug}
                      onChange={e => setDebug(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span>Teacher Debug: display raw cosine scores & margins</span>
                  </label>
                )}

                {/* Primary Action Button */}
                {captureMode === 'camera' ? (
                  <button
                    type="button"
                    disabled={!cameraOn || !consent || task.busy || !isCaptureAllowed}
                    onClick={submitLiveBurst}
                    className="btn w-full py-3 text-sm shadow-sm font-bold"
                  >
                    {task.busy ? 'Processing Burst...' : 'Start Live Challenge + Capture'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!file || !consent || task.busy || !isCaptureAllowed}
                    onClick={submitPhoto}
                    className="btn w-full py-3 text-sm shadow-sm font-bold"
                  >
                    {task.busy ? 'Processing Photo...' : 'Process Classroom Photograph'}
                  </button>
                )}

                {/* Status Guidance if button disabled */}
                {!isCaptureAllowed && (
                  <p className="text-[11px] text-amber-800 text-center font-medium">
                    Capture disabled: Session is {session?.status === 'closed' ? 'closed' : 'past scheduled end time'}.
                  </p>
                )}
                {isCaptureAllowed && !consent && (
                  <p className="text-[11px] text-slate-400 text-center">
                    Tick volunteer consent checkbox above to enable capture.
                  </p>
                )}

                {/* Honest Progress Indicator */}
                <Progress
                  busy={task.busy}
                  label={phase}
                  count={burstCount}
                  total={burstTotal}
                />
              </div>

              {/* Recognition Results Summary Card */}
              {result && (
                <div className="card space-y-4 border-emerald-200/80 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">Capture Results</h2>
                    <span className="text-[11px] font-mono text-slate-500">
                      {(result.elapsed_ms / 1000).toFixed(2)}s elapsed
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <p className="text-lg font-bold text-slate-800">{result.faces_detected}</p>
                      <p className="text-[10px] uppercase font-semibold text-slate-500">Faces</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-100">
                      <p className="text-lg font-bold text-emerald-800">{result.accepted.length}</p>
                      <p className="text-[10px] uppercase font-semibold text-emerald-700">Accepted</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2.5 border border-amber-100">
                      <p className="text-lg font-bold text-amber-800">{result.review_ids.length}</p>
                      <p className="text-[10px] uppercase font-semibold text-amber-700">For Review</p>
                    </div>
                  </div>

                  {/* Confirmed Students List */}
                  {result.accepted.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-700">
                        Confirmed Present ({result.accepted.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.accepted.map(a => (
                          <span
                            key={a.student_id}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-900 px-2 py-0.5 text-xs font-medium"
                          >
                            <svg className="h-3 w-3 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            {a.name}
                            {a.votes != null && <span className="opacity-75 font-mono">({a.votes}v)</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Path to Review Items */}
                  {result.review_ids.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setTab('review')}
                        className="btn secondary w-full text-xs py-2 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                      >
                        Inspect Flagged Faces ({result.review_ids.length}) in Review Queue →
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 leading-tight">
                    * Similarity values reflect cosine orientation (0.00–1.00) relative to enrolled biometric vectors, not statistical probability.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: QR CODE CHECK-IN ================= */}
      {tab === 'qr' && (
        <section className="card space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900">2-Factor Rotating QR Check-in</h2>
            <p className="text-xs text-slate-500">
              Project this high-contrast QR code on the lecture screen. Students scan it from their mobile Student Portal.
            </p>
          </div>

          <ErrorBox error={qrError} />

          {qr ? (
            <div className="flex flex-wrap items-center justify-center gap-8 py-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm text-center">
                <QRCodeSVG
                  value={JSON.stringify({ session_id: Number(id), token: qr.token })}
                  size={240}
                  level="H"
                  includeMargin={true}
                />
                <span className="mt-2 block text-xs font-mono font-bold text-slate-600">
                  SESSION #{id}
                </span>
              </div>

              <div className="flex-1 max-w-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Active Security Token
                  </span>
                  <Badge variant="live">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Rotates Every 30s
                  </Badge>
                </div>

                <textarea
                  aria-label="Current check-in token"
                  className="w-full font-mono text-xs bg-slate-50 border-slate-300 rounded-xl"
                  readOnly
                  rows={4}
                  value={qr.token}
                />

                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs text-emerald-950 space-y-1">
                  <p className="font-bold">Student Check-in Instructions:</p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-emerald-900">
                    <li>Students log in to <strong>Student Portal</strong> on their phone.</li>
                    <li>Navigate to <strong>QR Check-in</strong>.</li>
                    <li>Scan this screen code or paste the security token.</li>
                    <li>Perform quick face verification to seal attendance.</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <Empty
              title="QR Token Not Active"
              children={
                isTimeExpired
                  ? 'Scheduled session window has expired. Close session or create a new session.'
                  : 'Waiting for token synchronization...'
              }
            />
          )}
        </section>
      )}

      {/* ================= TAB 3: REVIEW QUEUE ================= */}
      {tab === 'review' && (
        <div className="space-y-4">
          <div className="card border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Human Verification Queue</h2>
              <p className="text-xs text-slate-500">
                Low-confidence face detections, multiple candidate ambiguities, and unrecognized persons.
              </p>
            </div>
            <Badge variant="review">
              {pendingReviews.length} pending / {reviews.length} total
            </Badge>
          </div>

          {reviews.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {reviews.map(r => (
                <ReviewCard
                  key={r.id}
                  item={r}
                  roster={roster}
                  busy={task.busy}
                  resolve={(key, body) =>
                    task.run(async () => {
                      await api.post(`/review/${key}/resolve`, body);
                      await load();
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <Empty title="No review items" children="All face detections have been resolved." />
          )}
        </div>
      )}

      {/* ================= TAB 4: ATTENDANCE RECORDS ================= */}
      {tab === 'records' && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Section Attendance Records</h2>
              <p className="text-xs text-slate-500">
                Finalized and in-progress attendance records for this session.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {records.filter(r => r.status === 'present').length} Present ·{' '}
              {records.filter(r => r.status === 'absent').length} Absent
            </span>
          </div>

          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Attendance Status</th>
                    <th>Detection Source</th>
                    <th>Last Updated</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="font-semibold text-slate-900">{r.name}</td>
                      <td>
                        <Badge
                          variant={r.status === 'present' ? 'live' : 'closed'}
                          className="font-bold"
                        >
                          {r.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-slate-500 uppercase">
                          {r.source}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500">
                        {r.updated_at ? new Date(r.updated_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn secondary text-xs py-1 px-3"
                          onClick={() => setEditingRecord({ ...r, reason: '' })}
                        >
                          Manual Correct
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty children="No attendance records created yet. Run capture or close session to record." />
          )}
        </section>
      )}

      {/* ================= TAB 5: REPORTS & EXPORT ================= */}
      {tab === 'reports' && (
        <section className="card space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Export Attendance Reports</h2>
            <p className="text-xs text-slate-500">
              Download authenticated university attendance records for academic records and auditing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">This Session Attendance (# {id})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed timestamped roster for this single lecture.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn text-xs py-2 px-3"
                  onClick={() =>
                    task.run(() => download(`/reports/date/${id}?format=csv`, `session-${id}.csv`))
                  }
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  className="btn secondary text-xs py-2 px-3"
                  onClick={() =>
                    task.run(() => download(`/reports/date/${id}?format=pdf`, `session-${id}.pdf`))
                  }
                >
                  Download PDF
                </button>
              </div>
            </div>

            {session?.section_id && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Entire Section Cumulative Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Semester-long attendance percentage and absences for Section #{session.section_id}.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn text-xs py-2 px-3"
                    onClick={() =>
                      task.run(() =>
                        download(`/reports/course/${session.section_id}?format=csv`, `section-${session.section_id}.csv`)
                      )
                    }
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    className="btn secondary text-xs py-2 px-3"
                    onClick={() =>
                      task.run(() =>
                        download(`/reports/course/${session.section_id}?format=pdf`, `section-${session.section_id}.pdf`)
                      )
                    }
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= TAB 6: AUDIT TRAIL ================= */}
      {tab === 'audit' && (
        <section className="card space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Immutable Audit Log</h2>
            <p className="text-xs text-slate-500">
              Cryptographic and database audit history of all manual attendance corrections.
            </p>
          </div>

          {audit.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {audit.map(a => (
                <div key={a.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Record #{a.record_id}:{' '}
                      <span className="text-slate-500 font-normal">{a.old_status || 'none'}</span> →{' '}
                      <span className="text-teal-800 font-bold">{a.new_status}</span>
                    </span>
                    <span className="text-slate-400 font-mono">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700">Reason: “{a.reason}”</p>
                  <p className="text-[11px] text-slate-400">Recorded by Faculty Actor #{a.actor_id}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty children="No manual corrections recorded for this session." />
          )}
        </section>
      )}

      {/* ================= MODAL: MANUAL CORRECTION ================= */}
      {editingRecord && (
        <Modal
          open={Boolean(editingRecord)}
          title={`Correct Attendance for ${editingRecord.name}`}
          description="Update attendance record. A mandatory reason is required for institutional audit logging."
          onClose={() => setEditingRecord(null)}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              task.run(async () => {
                await api.put(`/attendance/${editingRecord.id}`, {
                  status: editingRecord.status,
                  reason: editingRecord.reason,
                });
                setEditingRecord(null);
                await load();
              });
            }}
            className="space-y-4"
          >
            <ErrorBox error={task.error} />

            <Field title="Attendance Status" required>
              <select
                aria-label="Status"
                value={editingRecord.status}
                onChange={e =>
                  setEditingRecord({ ...editingRecord, status: e.target.value })
                }
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </Field>

            <Field
              title="Mandatory Correction Reason"
              hint="Min 3 characters"
              required
            >
              <textarea
                required
                minLength={3}
                maxLength={500}
                rows={3}
                placeholder="e.g. Student presented valid university excused absence note"
                value={editingRecord.reason}
                onChange={e =>
                  setEditingRecord({ ...editingRecord, reason: e.target.value })
                }
              />
            </Field>

            {session?.require_qr && editingRecord.status === 'present' && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Note: For QR-required sessions, marking present manually is validated against QR redemption logs.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="btn secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={task.busy || (editingRecord.reason || '').trim().length < 3}
                className="btn text-xs py-2 px-4"
              >
                Save Correction
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: CLOSE SESSION CONFIRMATION ================= */}
      <Modal
        open={closeConfirmOpen}
        title="Close & Finalize Class Session"
        description="Are you sure you want to close this attendance session?"
        onClose={() => setCloseConfirmOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1.5">
            <p className="font-bold">Important Notice:</p>
            <p>
              Closing this session will finalize attendance. Any enrolled student who has not checked in or been confirmed will be marked <strong>ABSENT</strong>.
            </p>
            <p>Live QR codes and camera capture will be permanently disabled for this session.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCloseConfirmOpen(false)}
              className="btn secondary text-xs py-2 px-4"
            >
              Keep Session Open
            </button>
            <button
              type="button"
              disabled={task.busy}
              onClick={handleCloseSession}
              className="btn danger text-xs py-2 px-4"
            >
              {task.busy ? 'Closing...' : 'Confirm & Close Session'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
