import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, download, errorText } from '../api/client';
import { Webcam, captureBurst } from '../components/Webcam';
import { ErrorBox, Heading, Progress, Field, Empty, useTask } from '../components/UI';
function Thumbnail({ id }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let cancelled = false, resource; api.get(`/review/${id}/thumbnail`, { responseType: 'blob' }).then(r => { resource = URL.createObjectURL(r.data); if (!cancelled) setUrl(resource); else URL.revokeObjectURL(resource); }).catch(() => {}); return () => { cancelled = true; if (resource) URL.revokeObjectURL(resource); }; }, [id]);
  return url ? <img src={url} alt="Temporary review face" className="h-24 w-24 rounded-lg object-cover"/> : <div className="grid h-24 w-24 place-items-center rounded-lg bg-slate-100 text-xs">Image expired</div>;
}
function ReviewCard({ item, roster, resolve, busy }) {
  const [student, setStudent] = useState(''), [reason, setReason] = useState('');
  return <article className="card space-y-3"><div className="flex gap-4">{item.has_thumbnail && <Thumbnail id={item.id}/>}<div><span className="badge">{item.status}</span><p className="mt-2 text-sm">{item.reason}</p></div></div>{item.status === 'pending' && <><div className="flex flex-wrap gap-2">{item.candidates.map(c => <button key={c.student_id} className={`btn ${String(student) === String(c.student_id) ? '' : 'secondary'}`} onClick={() => setStudent(String(c.student_id))}>{c.name} · {c.score.toFixed(3)}</button>)}</div><Field title="Confirm candidate or choose another enrolled student"><select value={student} onChange={e => setStudent(e.target.value)}><option value="">Reject / no student</option>{roster.map(u => <option value={u.id} key={u.id}>{u.name} ({u.student_code})</option>)}</select></Field><Field title="Mandatory reason"><input value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></Field><button className="btn" disabled={busy || reason.trim().length < 3} onClick={() => resolve(item.id, { student_id: student ? Number(student) : null, reason })}>{student ? 'Confirm present' : 'Reject face'}</button></>}</article>;
}
export default function SessionDetail() {
  const { id } = useParams(), task = useTask(), camera = useRef();
  const [session, setSession] = useState(null), [roster, setRoster] = useState([]), [reviews, setReviews] = useState([]), [records, setRecords] = useState([]), [tab, setTab] = useState('capture');
  const [cameraOn, setCameraOn] = useState(false), [consent, setConsent] = useState(false), [file, setFile] = useState(null), [result, setResult] = useState(null), [preview, setPreview] = useState(''), [previewFrame, setPreviewFrame] = useState(0), [phase, setPhase] = useState(''), [prompt, setPrompt] = useState(null), [debug, setDebug] = useState(false), [qr, setQr] = useState(null), [qrError, setQrError] = useState(''), [editing, setEditing] = useState(null), [audit, setAudit] = useState([]), [livenessStatus, setLivenessStatus] = useState(null);
  async function load() { const [s, u, r, a, h] = await Promise.all([api.get(`/sessions/${id}`), api.get(`/sessions/${id}/roster`), api.get(`/sessions/${id}/review`), api.get(`/sessions/${id}/records`), api.get(`/sessions/${id}/audit`)]); setSession(s.data); setRoster(u.data); setReviews(r.data); setRecords(a.data); setAudit(h.data); }
  useEffect(() => { task.run(load); api.get('/liveness/status').then(r => setLivenessStatus(r.data)).catch(() => {}); }, [id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!session?.require_qr || session.status !== 'open') return;
    let cancelled = false, timer;
    async function refresh() { try { const { data } = await api.get(`/sessions/${id}/qr`); if (!cancelled) { setQr(data); setQrError(''); timer = setTimeout(refresh, data.expires_in * 1000); } } catch (e) { if (!cancelled) { setQr(null); setQrError(errorText(e)); timer = setTimeout(refresh, 5000); } } }
    refresh(); return () => { cancelled = true; clearTimeout(timer); };
  }, [id, session?.require_qr, session?.status]);
  async function submitPhoto() {
    await task.run(async () => {
      try {
        const body = new FormData(); body.append('image', file); body.append('volunteers_confirmed', consent); body.append('debug', debug);
        setPreviewFrame(0);
        setPreview(URL.createObjectURL(file));
        setPhase('Detecting faces, checking liveness and matching the class roster…');
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
  async function live() {
    await task.run(async () => {
      try {
        const { data: challenge } = await api.post('/liveness/challenge', { session_id: Number(id) }); setPrompt(challenge);
        setPhase('Get ready: follow the challenge below. Capture starts in 2 seconds.');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const frames = await captureBurst(camera.current, n => setPhase(`Capturing frame ${n} of 8 — perform the challenge now`), { prompt: challenge.prompt, count: 8 });
        const body = new FormData(); frames.forEach((f, i) => body.append('frames', f, `frame-${i}.jpg`)); body.append('challenge_token', challenge.token); body.append('volunteers_confirmed', consent); body.append('debug', debug);
        setPreviewFrame(frames.length - 1);
        setPreview(URL.createObjectURL(frames[frames.length - 1]));
        setPhase('Processing eight frames on CPU. Voting and checking liveness…');
        const { data } = await api.post(`/sessions/${id}/capture-frames`, body);
        setResult(data);
        setPrompt(null);
        await load();
      } catch (err) {
        setResult(null);
        setPreview('');
        setPrompt(null);
        throw err;
      }
    });
  }
  const displayedBoxes = result?.boxes.filter(b => b.frame === previewFrame) || [];
  return <><div className="flex flex-wrap items-center justify-between gap-3"><Heading title={`Session #${id}`} detail={session ? `${session.status.toUpperCase()}${session.is_demo ? ' · DEMO DATA' : ''} · ${new Date(session.starts_at).toLocaleString()}` : 'Loading…'}>{session?.status === 'open' && <button className="btn secondary" disabled={task.busy} onClick={() => { if (window.confirm('Close session? Students without a present record will become absent.')) task.run(async () => { await api.post(`/sessions/${id}/close`); await load(); }); }}>Close session</button>}</Heading>{livenessStatus && <div className="text-xs font-medium px-3 py-1.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">Liveness: <span className="font-semibold text-emerald-700">{livenessStatus.active_backend.toUpperCase()}</span>{livenessStatus.active_backend === 'baseline' && !livenessStatus.baseline_auto && ' (Review Mode)'}</div>}</div><ErrorBox error={task.error}/><nav className="flex flex-wrap gap-2">{['capture', 'review', 'records', 'reports', 'audit'].map(t => <button key={t} className={`btn ${tab === t ? '' : 'secondary'}`} onClick={() => setTab(t)}>{t}{t === 'review' ? ` (${reviews.filter(r => r.status === 'pending').length})` : ''}</button>)}</nav>
    {tab === 'capture' && <>
      {session?.require_qr ? (
        <section className="card space-y-3">
          <h2>QR + face check-in (Barcode / QR Code)</h2>
          <p className="muted">Students open their QR check-in page and scan this live QR code. The token rotates every 30 seconds.</p>
          <ErrorBox error={qrError}/>
          {qr && (
            <div className="flex flex-wrap items-center gap-6 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <QRCodeSVG value={JSON.stringify({ session_id: Number(id), token: qr.token })} size={190}/>
              </div>
              <div className="flex-1 min-w-[280px] space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Signed 30-Second Token</p>
                <textarea aria-label="Current check-in code" className="w-full font-mono text-xs" readOnly rows={4} value={qr.token}/>
                <p className="text-xs text-emerald-700 font-medium">Active and refreshing every 30 seconds</p>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="card bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center gap-2 font-medium text-slate-800 text-sm">
            <span>QR Code Check-in Not Enabled For This Session</span>
          </div>
          <p className="muted text-xs leading-relaxed">
            This session was configured for photo/video capture. To use rotating 30-second QR check-in, tick <strong>"Require QR + face check-in"</strong> when creating a session, or visit the <a href="/sessions" className="text-emerald-700 underline font-semibold">Sessions list</a> to select a QR-enabled session.
          </p>
        </section>
      )}
    <div className="grid gap-4 lg:grid-cols-2"><section className="card space-y-4">{cameraOn ? <Webcam ref={camera}/> : <button className="btn" onClick={() => setCameraOn(true)}>Enable camera</button>}<label className="flex items-start gap-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>Every pictured volunteer has consented to this capture and temporary review storage.</label>{session?.debug_available && <label className="flex items-center gap-2"><input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)}/>Teacher debug: show similarity scores and margins</label>}<button className="btn" disabled={!cameraOn || !consent || task.busy || session?.status !== 'open'} onClick={live}>Start live challenge + capture</button>{prompt && <p className="rounded-xl bg-amber-100 p-4 font-semibold" role="alert">{prompt.instructions}</p>}</section><section className="card space-y-4"><h2>Classroom photograph</h2><p className="muted">JPEG, PNG or WEBP · max 8 MB · max 16 megapixels. Small faces and uncertain matches go to review.</p><input aria-label="Classroom photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files[0])}/><button className="btn" disabled={!file || !consent || task.busy || session?.status !== 'open'} onClick={submitPhoto}>Process photograph</button><Progress busy={task.busy} label={phase}/>{result && <p className="text-sm">{result.faces_detected} detections · {result.accepted.length} accepted students · {result.review_ids.length} review items · {(result.elapsed_ms / 1000).toFixed(2)} seconds</p>}</section></div>
    {preview && result && <section className="card space-y-3"><h2>Capture results (Preview Frame {previewFrame + 1})</h2><div className="relative inline-block w-full"><img className="w-full" src={preview} alt="Current capture, held only in this browser tab"/>{displayedBoxes.map((b, i) => <div key={i} className={`absolute border-2 ${b.decision === 'auto' ? 'border-emerald-400' : 'border-amber-400'}`} style={{ left: `${100 * b.box[0] / b.width}%`, top: `${100 * b.box[1] / b.height}%`, width: `${100 * (b.box[2] - b.box[0]) / b.width}%`, height: `${100 * (b.box[3] - b.box[1]) / b.height}%` }}><span className="absolute left-0 top-0 bg-black/75 px-1 text-[10px] text-white">{b.decision}{b.score != null ? ` ${b.score.toFixed(3)}` : ''}</span></div>)}{displayedBoxes.length === 0 && <div className="absolute inset-0 grid place-items-center bg-black/30 text-white text-xs font-semibold">No faces detected in preview frame</div>}</div><button className="btn secondary" onClick={() => { setPreview(''); setResult(null); }}>Clear local preview</button><div className="flex flex-wrap gap-2">{result.accepted.map(a => <span className="badge" key={a.student_id}>{a.name} · {a.votes} vote(s)</span>)}</div></section>}</>}
    {tab === 'review' && <div className="grid gap-4 lg:grid-cols-2">{reviews.map(r => <ReviewCard item={r} roster={roster} key={r.id} busy={task.busy} resolve={(key, body) => task.run(async () => { await api.post(`/review/${key}/resolve`, body); await load(); })}/>)}{!reviews.length && <Empty>No review items.</Empty>}</div>}
    {tab === 'records' && <section className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Student</th><th>Status</th><th>Source</th><th>Action</th></tr></thead><tbody>{records.map(r => <tr key={r.id}><td>{r.name}</td><td><span className="badge">{r.status}</span></td><td>{r.source}</td><td><button className="btn secondary" onClick={() => setEditing({ ...r, reason: '' })}>Correct</button></td></tr>)}</tbody></table>{!records.length && <p className="muted py-6">No attendance records yet.</p>}</section>}
    {editing && <div role="dialog" aria-modal="true" aria-label="Correct attendance" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5"><form className="card w-full max-w-md space-y-4" onSubmit={e => { e.preventDefault(); task.run(async () => { await api.put(`/attendance/${editing.id}`, { status: editing.status, reason: editing.reason }); setEditing(null); await load(); }); }}><h2>Correct {editing.name}</h2><ErrorBox error={task.error}/><select aria-label="Status" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}><option>present</option><option>absent</option></select><Field title="Reason (required)"><textarea required minLength={3} maxLength={500} value={editing.reason} onChange={e => setEditing({ ...editing, reason: e.target.value })}/></Field><div className="flex gap-2"><button className="btn" disabled={task.busy}>Save correction</button><button className="btn secondary" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form></div>}
    {tab === 'reports' && <section className="card space-y-4"><h2>Download reports</h2>{['csv', 'pdf'].map(format => <div className="flex flex-wrap gap-3" key={format}><button className="btn" onClick={() => task.run(() => download(`/reports/date/${id}?format=${format}`, `session-${id}.${format}`))}>This session · {format.toUpperCase()}</button><button className="btn secondary" onClick={() => task.run(() => download(`/reports/course/${session.section_id}?format=${format}`, `section-${session.section_id}.${format}`))}>Entire section · {format.toUpperCase()}</button></div>)}</section>}
    {tab === 'audit' && <section className="card space-y-3"><h2>Append-only correction history</h2>{audit.map(a => <div className="border-t py-3 text-sm" key={a.id}>Record #{a.record_id}: {a.old_status || 'none'} → {a.new_status} · {a.reason}<p className="muted">Actor #{a.actor_id} · {new Date(a.created_at).toLocaleString()}</p></div>)}{!audit.length && <p className="muted">No corrections.</p>}</section>}
  </>;
}
