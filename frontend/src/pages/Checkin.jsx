import { useRef, useState } from 'react';
import { api } from '../api/client';
import { Webcam, captureBurst } from '../components/Webcam';
import { QRScanner } from '../components/QRScanner';
import { Heading, Field, ErrorBox, useTask, Progress } from '../components/UI';

export default function Checkin() {
  const camera = useRef(), task = useTask();
  const [sessionId, setSessionId] = useState(''), [code, setCode] = useState(''), [scan, setScan] = useState(false), [cameraOn, setCameraOn] = useState(false), [prompt, setPrompt] = useState(''), [phase, setPhase] = useState(''), [success, setSuccess] = useState(false);
  
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
      const { data } = await api.post('/liveness/challenge', { session_id: Number(sessionId) });
      setPrompt(data.instructions);
      setPhase('Get ready. Capture begins in 2 seconds.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const frames = await captureBurst(camera.current, n => setPhase(`Capturing ${n}/8. Follow the prompt.`));
      const body = new FormData();
      body.append('qr_token', code);
      body.append('challenge_token', data.token);
      frames.forEach((f, i) => body.append('frames', f, `frame-${i}.jpg`));
      setPhase('Verifying QR, face and liveness…');
      await api.post(`/checkin/${sessionId}`, body);
      setSuccess(true);
      setCameraOn(false);
      setCode('');
      setPrompt('');
    });
  }

  return (
    <>
      <Heading title="QR + face check-in" detail="Use the current classroom code, then complete your live face challenge."/>
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
        {cameraOn ? <Webcam ref={camera}/> : <button className="btn" onClick={() => setCameraOn(true)}>Enable face camera</button>}
        {prompt && <p role="alert" className="rounded-xl bg-amber-100 p-4 font-semibold text-amber-950">{prompt}</p>}
        <button className="btn" disabled={task.busy || !cameraOn || !sessionId || !code} onClick={checkin}>
          Start challenge and check in
        </button>
        <Progress busy={task.busy} label={phase}/>
      </section>
    </>
  );
}
