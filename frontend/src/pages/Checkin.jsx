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
        setPhase('Verifying facial biometrics, motion liveness, and ticket binding…');
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
        } else if (msg.includes('enrolment') || msg.includes('consented')) {
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
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-slate-700 border-slate-200">
            Liveness Engine: <strong className="text-teal-800">{livenessStatus.active_backend.toUpperCase()}</strong>
          </span>
        )}
      </div>

      <ErrorBox error={customError || task.error} />

      {/* SUCCESS CONFIRMATION CARD */}
      {success && successDetails && (
        <section className="card border-teal-300 bg-teal-50/70 p-6 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-white shrink-0 shadow-xs">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-teal-950">Attendance Successfully Recorded!</h2>
              <p className="text-xs text-teal-900 leading-relaxed">
                You have been authenticated and marked <strong>PRESENT</strong> for Session #{successDetails.sessionId} at {successDetails.timestamp}.
              </p>
              <p className="text-[11px] text-teal-800">
                Two-factor verification completed: Rotating QR token + live facial motion verification confirmed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-teal-200">
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
            isStep1Done ? 'bg-teal-50/80 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">1. Classroom Code</span>
            {isStep1Done ? (
              <span className="text-teal-700 font-bold" aria-label="Completed">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="text-slate-400">Step 1</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isStep1Done ? `Session #${sessionId} Ready` : 'Scan or enter'}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 border transition-all ${
            isStep2Done ? 'bg-teal-50/80 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">2. Face Camera</span>
            {isStep2Done ? (
              <span className="text-teal-700 font-bold" aria-label="Completed">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
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
            ticketTimeLeft !== null ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">3. Ticket Window</span>
            {ticketTimeLeft !== null ? (
              <span className="font-mono font-bold text-amber-900 text-xs">{ticketTimeLeft}s</span>
            ) : (
              <span className="text-slate-400">15s Limit</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {ticketTimeLeft !== null ? `${ticketTimeLeft}s remaining` : 'Bound to session'}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 border transition-all ${
            success ? 'bg-teal-50/80 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">4. Presence Seal</span>
            {success ? (
              <span className="text-teal-700 font-bold" aria-label="Completed">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="text-slate-400">Final Step</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {success ? 'Marked Present' : 'Verified match'}
          </p>
        </div>
      </div>

      {/* Main Check-in Workspace */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: QR Scan & Code Inputs (5 cols) */}
        <div className="card space-y-4 lg:col-span-5 bg-white">
          <div className="border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900">1. Classroom QR Token</h2>
            <p className="text-xs text-slate-500">
              Obtain the 30-second rotating code from your teacher's projector or screen.
            </p>
          </div>

          <div className="space-y-3">
            <Field title="Session Number" hint="e.g. 1, 2" required>
              <input
                type="number"
                min="1"
                required
                value={sessionId}
                onChange={e => setSessionId(e.target.value)}
                placeholder="Enter Session ID"
              />
            </Field>

            <Field title="QR Security Token" hint="From rotating classroom code" required>
              <input
                type="text"
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Paste token or scan barcode"
              />
            </Field>

            <button
              type="button"
              onClick={() => setScan(!scan)}
              className="btn secondary w-full text-xs py-2 px-4 flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {scan ? 'Close Barcode Scanner' : 'Open Camera to Scan Barcode'}
            </button>

            {scan && (
              <div className="rounded-xl border border-slate-200 p-2 bg-slate-50">
                <QRScanner onScan={parseQRData} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Camera Viewfinder & Challenge Execution (7 cols) */}
        <div className="card space-y-4 lg:col-span-7 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Liveness Challenge & Verification</h2>
              <p className="text-xs text-slate-500">
                Front camera verifies face motion to prevent spoofing or photo-proxy check-ins.
              </p>
            </div>
            {ticketTimeLeft !== null && (
              <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono text-xs font-bold px-2.5 py-0.5">
                Ticket: {ticketTimeLeft}s
              </span>
            )}
          </div>

          {/* Viewfinder Screen */}
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
            {cameraOn ? (
              <div className="relative h-full w-full">
                <Webcam ref={camera} facingMode="user" />

                {/* Challenge Prompt Overlay */}
                {prompt && (
                  <div className="absolute inset-x-0 bottom-0 bg-slate-900/90 p-3 text-center border-t border-slate-800">
                    <p className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-0.5">
                      Active Challenge:
                    </p>
                    <p className="text-sm font-bold text-white">{prompt}</p>
                    {burstCount !== null && (
                      <p className="text-[11px] font-mono text-slate-300 mt-1">
                        Recording frame {burstCount} of {burstTotal}…
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-slate-400 border border-slate-800">
                  <svg className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Camera Offline</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                    Enable camera to prepare for the 2-factor facial motion verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOn(true)}
                  className="btn text-xs py-2 px-4 shadow-sm"
                >
                  Enable Camera
                </button>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              disabled={!isStep1Done || !cameraOn || task.busy}
              onClick={handleCheckin}
              className="btn w-full py-3 text-xs font-bold shadow-sm"
            >
              {task.busy ? 'Executing Liveness Challenge…' : 'Start 2-Factor Verification →'}
            </button>

            {!isStep1Done && (
              <p className="text-[11px] text-slate-400 text-center">
                Enter or scan the classroom session number and code on the left to activate verification.
              </p>
            )}

            {phase && (
              <p className="text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg p-2.5 text-center">
                {phase}
              </p>
            )}

            <Progress busy={task.busy} label={phase || 'Processing check-in on server…'} />
          </div>
        </div>
      </div>
    </div>
  );
}
