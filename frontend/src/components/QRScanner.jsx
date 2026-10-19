import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QRScanner({ onScan, onError, onClose }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);
  const containerId = 'html5qr-code-region';

  useEffect(() => {
    let isMounted = true;
    Html5Qrcode.getCameras()
      .then(devices => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // For QR code scanning, prefer the rear/environment camera on mobile phones
          const rear = devices.find(d => /back|rear|environment/i.test(d.label));
          const preferred = rear || devices[0];
          setSelectedCam(preferred.id);
        } else {
          setErrorMsg('No camera detected on this device.');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setErrorMsg('Camera access denied or unavailable: ' + (err.message || err));
      });

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedCam) return;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner.start(
      selectedCam,
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      },
      (decodedText) => {
        scanner.stop()
          .then(() => onScan(decodedText))
          .catch(() => onScan(decodedText));
      },
      () => {}
    ).catch(err => {
      setErrorMsg('Failed to start scanner: ' + (err.message || err));
      onError?.(err);
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [selectedCam]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-white space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-emerald-400">Real-Time QR Scanner</span>
        {onClose && (
          <button type="button" onClick={onClose} className="text-xs text-slate-300 hover:text-white px-2.5 py-1 bg-slate-800 rounded transition">
            Close Scanner
          </button>
        )}
      </div>

      {cameras.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-400">Camera:</label>
          <select
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
            value={selectedCam}
            onChange={e => setSelectedCam(e.target.value)}
          >
            {cameras.map(c => (
              <option key={c.id} value={c.id}>
                {c.label || `Camera ${c.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {errorMsg && <p className="text-xs text-rose-400 bg-rose-950/50 p-2 rounded">{errorMsg}</p>}

      <div id={containerId} className="w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black" />
      <p className="text-xs text-slate-400 text-center">Point your camera at the teacher's QR code to scan automatically</p>
    </div>
  );
}
