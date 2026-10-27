import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Webcam, captureBurst } from '../components/Webcam';
import { QRScanner } from '../components/QRScanner';
import {
  Heading,
  Field,
  ErrorBox,
  useTask,
  Progress,
  Badge,
} from '../components/UI';

export default function Checkin() {
  const camera = useRef();
  const task = useTask();

  const [sessionId, setSessionId] = useState('');
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState('');
  const [burstCount, setBurstCount] = useState(null);
  const [burstTotal, setBurstTotal] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successDetails, setSuccessDetails] = useState(null);
  const [ticketTimeLeft, setTicketTimeLeft] = useState(null);
  const [livenessStatus, setLivenessStatus] = useState(null);
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/liveness/status')
      .then(r => {
        if (active) setLivenessStatus(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // 15-second server-synchronized ticket countdown timer
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

  function parseQRData(raw) {
    if (!raw) return;
    setCustomError('');
    try {
      const parsed = JSON.parse(raw);
      if (parsed.token) setCode(parsed.token);
      if (parsed.session_id) setSessionId(String(parsed.session_id));
    } catch {
      setCode(raw.trim());
    }
  }

  async function handleCheckin() {
    setCustomError('');
    setSuccess(false);
    setSuccessDetails(null);

    await task.run(async () => {
      try {
        setPhase('Validating QR token with server security window…');

        // Step 1: Validate QR code and receive bound 15-second ticket & challenge
        const { data: ticketData } = await api.post('/checkin/start', {
          session_id: Number(sessionId),
          qr_token: code.trim(),
          mode: 'random',
        });

        setTicketTimeLeft(ticketData.expires_in || 15);
        setPrompt(ticketData.instructions);

        // Step 2: Brief 2s preparation
        setPhase('Get ready: face the camera. Challenge begins in 2 seconds…');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Capture burst with pose/blink prompt
        const frames = await captureBurst(
          camera.current,
          (n, total) => {
            setBurstCount(n);
            setBurstTotal(total);
            setPhase(`Capturing frame ${n} of ${total} — ${ticketData.instructions}`);
          },
          { prompt: ticketData.prompt, count: 8 }
        );

        // Step 4: Submit ticket, challenge, and frames for verification
        setPhase('Verifying facial biometrics, motion liveness, and ticket ticket binding…');
        const body = new FormData();
        body.append('ticket_token', ticketData.ticket_token);
        body.append('challenge_token', ticketData.challenge_token);
        frames.forEach((f, i) => body.append('frames', f, `frame-${i}.jpg`));

        const response = await api.post(`/checkin/${sessionId}`, body);

        // Verified success
        setSuccess(true);
        setSuccessDetails({
          sessionId,
          timestamp: new Date().toLocaleTimeString(),
          confidence: response.data?.confidence,
        });
        setCameraOn(false);
        setCode('');
        setPrompt('');
        setTicketTimeLeft(null);
        setBurstCount(null);
        setBurstTotal(null);
      } catch (err) {
        setTicketTimeLeft(null);
        setPrompt('');
        setBurstCount(null);
        setBurstTotal(null);

        const msg = errorText(err);
        if (msg.includes('QR code expired') || msg.includes('QR_EXPIRED')) {
          setCustomError('Classroom QR code has expired (the teacher screen rotates every 30 seconds). Please scan the current code displayed in class.');
        } else if (msg.includes('ticket') || msg.includes('expired')) {
          setCustomError('Security ticket window timed out. Please retry with the latest classroom code.');
        } else if (msg.includes('enrolment')) {
          setCustomError('You must complete face enrolment before participating in QR check-in.');
        } else if (msg.includes('Already checked in')) {
          setCustomError('You are already checked in and marked present for this session.');
        } else {
          setCustomError(msg);
        }
        throw err;
      }
    });
  }

  const isStep1Done = Boolean(sessionId && code.trim());
  const isStep2Done = cameraOn;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading
          title="Classroom QR Check-in"
          detail="Scan the live 30-second classroom QR code, then execute your 2-factor liveness challenge."
        />
        {livenessStatus && (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
            Liveness: <strong className="text-emerald-800">{livenessStatus.active_backend.toUpperCase()}</strong>
          </span>
        )}
      </div>

      <ErrorBox error={customError || task.error} />

      {/* SUCCESS CONFIRMATION CARD */}
      {success && successDetails && (
        <section className="card border-emerald-300 bg-emerald-50/80 p-6 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shrink-0 shadow-xs">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-emerald-950">Attendance Successfully Recorded!</h2>
              <p className="text-xs text-emerald-900 leading-relaxed">
                You have been authenticated and marked <strong>PRESENT</strong> for Session #{successDetails.sessionId} at {successDetails.timestamp}.
              </p>
              <p className="text-[11px] text-emerald-800">
                Two-factor verification sealed: Rotating QR token + live facial motion verification confirmed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
            <Link to="/student/dashboard" className="btn text-xs py-2 px-4">
              Return to Dashboard →
            </Link>
            <Link to="/student/attendance" className="btn secondary text-xs py-2 px-4 bg-white">
              View My Attendance Records
            </Link>
          </div>
        </section>
      )}

      {/* 4-Step Visual Progress Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div
          className={`rounded-xl p-3 border transition-all ${
            isStep1Done ? 'bg-mint/60 border-emerald-300' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">1. Classroom Code</span>
            {isStep1Done ? (
              <span className="text-emerald-700 font-bold">✓</span>
            ) : (
              <span className="text-slate-400">Step 1</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isStep1Done ? `Session #${sessionId} Ready` : 'Scan or paste'}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 border transition-all ${
            isStep2Done ? 'bg-mint/60 border-emerald-300' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">2. Face Camera</span>
            {isStep2Done ? (
              <span className="text-emerald-700 font-bold">✓</span>
            ) : (
              <span className="text-slate-400">Step 2</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isStep2Done ? 'Camera Active' : 'Enable front camera'}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 border transition-all ${
            prompt ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400/20' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">3. Live Challenge</span>
            {ticketTimeLeft !== null ? (
              <span className="text-amber-800 font-bold font-mono">{ticketTimeLeft}s</span>
            ) : (
              <span className="text-slate-400">Step 3</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {prompt ? 'Challenge Active' : 'Pose / blink check'}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 border transition-all ${
            success ? 'bg-mint/80 border-emerald-400' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">4. Verified</span>
            {success ? (
              <span className="text-emerald-700 font-bold">✓</span>
            ) : (
              <span className="text-slate-400">Step 4</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {success ? 'Marked Present' : 'Pending check-in'}
          </p>
        </div>
      </div>

      {/* STEP 1 CARD: QR CODE SCAN / INPUT */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-pine flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-pine text-xs font-bold">
                1
              </span>
              Classroom QR Code or Session Token
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Point your phone camera at the projected code, or manually paste the session token.
            </p>
          </div>

          <button
            type="button"
            className={`btn text-xs py-2 px-3.5 ${scan ? 'danger' : 'secondary'}`}
            onClick={() => setScan(!scan)}
          >
            {scan ? 'Close Rear Camera Scanner' : '📷 Open Camera QR Scanner'}
          </button>
        </div>

        {/* Real-time HTML5 Camera QR Scanner */}
        {scan && (
          <div className="p-2 bg-slate-900 rounded-2xl">
            <QRScanner
              onScan={decoded => {
                parseQRData(decoded);
                setScan(false);
              }}
              onClose={() => setScan(false)}
            />
          </div>
        )}

        {/* Input Fields */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Field title="Session ID" hint="Required" required>
              <input
                type="number"
                min="1"
                value={sessionId}
                onChange={e => setSessionId(e.target.value)}
                placeholder="e.g. 22"
                className="text-xs font-mono"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field title="Session Token / Scanned JSON" hint="30-second signed JWT token" required>
              <input
                type="text"
                value={code}
                onChange={e => parseQRData(e.target.value)}
                placeholder="Paste code or JSON from QR code..."
                className="text-xs font-mono"
              />
            </Field>
          </div>
        </div>

        {isStep1Done && (
          <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
            <span>✓</span>
            Classroom credentials loaded for Session #{sessionId}.
          </p>
        )}
      </section>

      {/* STEP 2 & 3 CARD: FACE CAMERA & LIVENESS CHALLENGE */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-pine flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-pine text-xs font-bold">
                2
              </span>
              Front Face Camera & Challenge
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hold phone at eye level. When you start, follow the on-screen movement prompt.
            </p>
          </div>

          {ticketTimeLeft !== null && (
            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                ticketTimeLeft <= 5
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              Security Ticket: {ticketTimeLeft}s remaining
            </span>
          )}
        </div>

        {/* Viewfinder */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-video max-w-lg mx-auto flex items-center justify-center">
          {cameraOn ? (
            <div className="h-full w-full">
              <Webcam ref={camera} facingMode="user" />
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-slate-400 border border-slate-800">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-xs text-slate-300">Front camera is currently off</p>
              <button
                type="button"
                onClick={() => setCameraOn(true)}
                className="btn text-xs py-2 px-4 shadow-sm"
              >
                Turn On Front Camera
              </button>
            </div>
          )}
        </div>

        {/* Live Challenge Instruction Banner */}
        {prompt && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 text-xs font-bold shadow-sm flex items-center gap-3 animate-pulse"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-200 text-amber-900 shrink-0 text-base">
              ⚡
            </span>
            <div className="space-y-0.5">
              <p className="uppercase tracking-wider text-[10px] text-amber-800">Challenge Prompt</p>
              <p className="text-sm">{prompt}</p>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="button"
          disabled={task.busy || !cameraOn || !sessionId || !code}
          onClick={handleCheckin}
          className="btn w-full py-3 text-sm shadow-sm font-bold"
        >
          {task.busy ? 'Verifying Challenge & Attendance...' : 'Start Liveness Challenge & Check In'}
        </button>

        {(!sessionId || !code) && (
          <p className="text-[11px] text-slate-400 text-center">
            Scan or enter the classroom QR code in Step 1 to unlock verification.
          </p>
        )}
        {sessionId && code && !cameraOn && (
          <p className="text-[11px] text-slate-400 text-center">
            Turn on your front face camera to proceed.
          </p>
        )}

        {/* Honest Progress Tracker */}
        <Progress
          busy={task.busy}
          label={phase}
          count={burstCount}
          total={burstTotal}
        />
      </section>
    </div>
  );
}
