import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ErrorBox } from './UI';
export const Webcam = forwardRef(function Webcam({ facingMode = 'user' }, ref) {
  const video = useRef(null), stream = useRef(null);
  const [error, setError] = useState(''), [ready, setReady] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  useEffect(() => {
    async function initDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const all = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = all.filter(d => d.kind === 'videoinput');
        setDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          // Let users select a camera; do not automatically prefer a virtual camera
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch (_) {}
    }
    initDevices();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setReady(false);
      setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs localhost or an HTTPS secure origin.');
        if (stream.current) {
          stream.current.getTracks().forEach(t => t.stop());
          stream.current = null;
        }
        const videoConstraints = selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } };

        const media = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
        if (cancelled) { media.getTracks().forEach(t => t.stop()); return; }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        if (!cancelled) setReady(true);

        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          const videoInputs = all.filter(d => d.kind === 'videoinput');
          setDevices(videoInputs);
        }
      } catch (e) {
        if (!cancelled) {
          setReady(false);
          setError(e.message || 'Camera error');
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      if (stream.current) {
        stream.current.getTracks().forEach(t => t.stop());
        stream.current = null;
      }
    };
  }, [facingMode, selectedDeviceId]);

  async function capture() {
    if (!ready || !video.current?.videoWidth) throw new Error('Camera is not ready');
    const canvas = document.createElement('canvas');
    canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    canvas.getContext('2d').drawImage(video.current, 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Capture failed')), 'image/jpeg', .9));
  }

  useImperativeHandle(ref, () => ({ capture, video: () => video.current, ready }));

  return (
    <div>
      <ErrorBox error={error}/>
      {devices.length > 1 && (
        <div className="mb-2 flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Camera:</label>
          <select
            className="text-xs bg-slate-100 text-slate-700 border border-slate-300 rounded px-2 py-1"
            value={selectedDeviceId}
            onChange={e => setSelectedDeviceId(e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <video className="aspect-video w-full rounded-xl bg-slate-950 object-contain" ref={video} autoPlay muted playsInline/>
      <p className="muted mt-2">Camera frames stay in memory. Keep all pictured volunteers informed.</p>
    </div>
  );
});

export async function captureBurst(camera, onProgress, options = {}) {
  const count = typeof options === 'number' ? options : (options?.count || 8);
  const prompt = typeof options === 'object' ? options?.prompt : undefined;
  // Appropriate sampling intervals:
  // Human blinks last ~150-350ms, so ~160ms interval samples rapidly enough to catch the closed-eye state.
  // Head turns need ~320ms so user has time to execute the turn smoothly.
  let defaultInterval = 250;
  if (prompt === 'blink') defaultInterval = 160;
  else if (prompt === 'turn_left' || prompt === 'turn_right') defaultInterval = 320;
  const interval = (typeof options === 'object' && options?.interval !== undefined) ? options.interval : defaultInterval;

  const frames = [];
  for (let i = 0; i < count; i++) {
    onProgress?.(i + 1, count);
    frames.push(await camera.capture());
    if (i < count - 1 && interval > 0) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  return frames;
}
