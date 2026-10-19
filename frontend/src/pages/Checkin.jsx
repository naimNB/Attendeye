import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Webcam, captureBurst } from '../components/Webcam';
import { QRScanner } from '../components/QRScanner';
import { Heading, Field, ErrorBox, useTask, Progress } from '../components/UI';

export default function Checkin() {
  const camera = useRef(), task = useTask();
  const [sessionId, setSessionId] = useState('');
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState('');
  const [success, setSuccess] = useState(false);
  const [ticketTimeLeft, setTicketTimeLeft] = useState(null);
  const [livenessStatus, setLivenessStatus] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/liveness/status').then(r => {
      if (active) setLivenessStatus(r.data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ticketTimeLeft === null || ticketTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setTicketTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ticketTimeLeft]);

  function parse(raw) {
    try {
      const value = JSON.parse(raw);
      setCode(value.token);
      setSessionId(String(value.session_id));
    } catch {
      setCode(raw.trim());
    }
  }

  async function checkin() {
    await task.run(async () => {
      setSuccess(false);
      setPhase('Validating QR code and reserving check-in ticket…');
      // Step 1: Start check-in: validate raw QR immediately in its current window
      const { data: ticketData } = await api.post('/checkin/start', {
        session_id: Number(sessionId),
        qr_token: code,
        mode: 'random'
      });

      setTicketTimeLeft(ticketData.expires_in || 15);
      setPrompt(ticketData.instructions);

      // Step 2: Preparation countdown
      setPhase('Get ready: face the camera. Capture starts in 2 seconds…');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Capture burst appropriate for challenge prompt
      const frames = await captureBurst(
        camera.current,
        (n, total) => setPhase(`Capturing frame ${n}/${total} — ${ticketData.instructions}`),
        { prompt: ticketData.prompt, count: 8 }
      );

      // Step 4: Complete check-in with ticket and frames
      setPhase('Verifying identity, liveness motion and security ticket…');
      const body = new FormData();
      body.append('ticket_token', ticketData.ticket_token);
      body.append('challenge_token', ticketData.challenge_token);
      frames.forEach((f, i) => body.append('frames', f, `frame-${i}.jpg`));

      await api.post(`/checkin/${sessionId}`, body);
      setSuccess(true);
      setCameraOn(false);
      setCode('');
      setPrompt('');
      setTicketTimeLeft(null);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading title="QR + face check-in" detail="Scan the current classroom code, then complete your live face challenge."/>
        {livenessStatus && (
          <div className="text-xs font-medium px-3 py-1.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
            Liveness: <span className="font-semibold text-emerald-700">{livenessStatus.active_backend.toUpperCase()}</span>
            {livenessStatus.active_backend === 'baseline' && !livenessStatus.baseline_auto && ' (Review Mode)'}
          </div>
        )}
      </div>

      <ErrorBox error={task.error}/>
      {success && <p className="rounded-xl bg-mint p-4 font-semibold text-emerald-950">Checked in successfully. You are marked present.</p>}
      
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">1. Teacher QR Code / Barcode</h2>
            <p className="muted text-xs">Scan the live QR code from the teacher's screen, or paste the session code below.</p>
          </div>
          <button type="button" className={`btn ${scan ? 'danger' : 'secondary'}`} onClick={() => setScan(!scan)}>
            {scan ? 'Close Scanner' : 'Open Camera QR Scanner'}
          </button>
        </div>

        {scan && (
          <QRScanner
            onScan={decoded => {
              parse(decoded);
              setScan(false);
            }}
            onClose={() => setScan(false)}
          />
        )}

        <Field title="Session ID">
          <input type="number" min="1" value={sessionId} onChange={e => setSessionId(e.target.value)} placeholder="e.g. 1"/>
        </Field>
        <Field title="Current code (paste token or scanned JSON)">
          <textarea value={code} onChange={e => parse(e.target.value)} rows={3} placeholder="Paste session token or scan teacher QR above"/>
        </Field>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">2. Live Face Challenge</h2>
          {ticketTimeLeft !== null && (
            <span className={`text-xs font-mono font-semibold px-2 py-1 rounded ${ticketTimeLeft <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
              Ticket expires in: {ticketTimeLeft}s
            </span>
          )}
        </div>

        {cameraOn ? <Webcam ref={camera}/> : <button className="btn" onClick={() => setCameraOn(true)}>Enable face camera</button>}
        
        {prompt && (
          <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-950 space-y-1">
            <p className="font-bold text-sm">Challenge Instruction:</p>
            <p className="text-sm font-semibold">{prompt}</p>
          </div>
        )}

        <button className="btn" disabled={task.busy || !cameraOn || !sessionId || !code} onClick={checkin}>
          Start challenge and check in
        </button>
        <Progress busy={task.busy} label={phase}/>
      </section>
    </>
  );
}
