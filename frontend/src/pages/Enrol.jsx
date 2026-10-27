import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Webcam } from '../components/Webcam';
import {
  Heading,
  ErrorBox,
  useTask,
  Progress,
  Badge,
  Modal,
  SkeletonLoader,
} from '../components/UI';

const POSES = ['front', 'left', 'right', 'up', 'down'];

const POSE_INFO = {
  front: {
    label: 'Front View',
    direction: 'Look directly into the camera',
    hint: 'Keep head level, centered, and maintain a neutral expression.',
    icon: '👤',
  },
  left: {
    label: 'Turn Left',
    direction: 'Turn your face slightly to your left',
    hint: 'Turn about 15°–25° to the left while keeping your eyes on screen.',
    icon: '👈',
  },
  right: {
    label: 'Turn Right',
    direction: 'Turn your face slightly to your right',
    hint: 'Turn about 15°–25° to the right while keeping your eyes on screen.',
    icon: '👉',
  },
  up: {
    label: 'Tilt Up',
    direction: 'Raise your chin upwards slightly',
    hint: 'Tilt your chin up by about 10°–15° in even room lighting.',
    icon: '👆',
  },
  down: {
    label: 'Tilt Down',
    direction: 'Lower your chin downwards slightly',
    hint: 'Lower your chin by about 10°–15° with eyes visible.',
    icon: '👇',
  },
};

export default function Enrol() {
  const camera = useRef();
  const task = useTask();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [selectedPose, setSelectedPose] = useState('front');
  const [cameraOn, setCameraOn] = useState(false);
  const [lastFeedback, setLastFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  async function loadStatus() {
    setLoading(true);
    await task.run(async () => {
      const res = await api.get('/enrol/status');
      setStatus(res.data);
      // Auto-select first missing pose
      const missing = POSES.find(p => !res.data.poses?.includes(p));
      if (missing) setSelectedPose(missing);
    });
    setLoading(false);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleConsentSubmit() {
    await task.run(async () => {
      await api.post('/enrol/consent', { accepted: true, text_version: '1.0' });
      await loadStatus();
    });
  }

  async function handleCaptureSample() {
    setLastFeedback(null);
    await task.run(async () => {
      try {
        if (!camera.current) throw new Error('Camera hardware not initialized.');
        const blob = await camera.current.capture();
        const body = new FormData();
        body.append('image', blob, 'sample.jpg');
        body.append('pose', selectedPose);

        const { data } = await api.post('/enrol/sample', body);
        setStatus(data);
        setLastFeedback({
          type: 'success',
          message: `Successfully captured and encrypted ${selectedPose.toUpperCase()} pose sample!`,
        });

        // Automatically advance to the next incomplete pose
        const nextMissing = POSES.find(p => !data.poses.includes(p));
        if (nextMissing) {
          setSelectedPose(nextMissing);
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.detail || err.message || 'Capture quality check failed.';
        setLastFeedback({
          type: 'error',
          message: errorMsg,
        });
        throw err;
      }
    });
  }

  async function handleDeleteBiometrics() {
    await task.run(async () => {
      await api.delete('/enrol/me');
      setCameraOn(false);
      setConsentChecked(false);
      setDeleteConfirmOpen(false);
      setLastFeedback({
        type: 'success',
        message: 'Your biometric embeddings and temporary review crops have been permanently deleted.',
      });
      await loadStatus();
    });
  }

  const completedPoses = status?.poses || [];
  const posesRemaining = POSES.filter(p => !completedPoses.includes(p));
  const isEnrolmentComplete = status?.complete;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Heading
        title="Face Enrolment Wizard"
        detail="Register 5 multi-pose facial reference vectors for 2-factor classroom QR attendance."
      >
        {status?.consented && (
          <Badge variant={isEnrolmentComplete ? 'live' : 'expired'}>
            {isEnrolmentComplete ? 'ENROLMENT COMPLETE' : `${completedPoses.length}/5 POSES CAPTURED`}
          </Badge>
        )}
      </Heading>

      <ErrorBox error={task.error} />

      {/* Success / Action Feedback Banner */}
      {lastFeedback && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm ${
            lastFeedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{lastFeedback.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{lastFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastFeedback(null)}
            className="text-slate-500 hover:text-slate-800 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonLoader count={2} className="h-40" />
      ) : status && !status.consented ? (
        /* ================= STEP 1: CONSENT AGREEMENT ================= */
        <section className="card space-y-5 border-emerald-200/90 shadow-sm">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-pine flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Biometric Privacy & Consent Agreement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please review the university data protection policy for facial biometric attendance.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">
              Institutional Privacy Policy:
            </p>
            <p className="italic">“{status.consent_text}”</p>

            <div className="pt-2 border-t border-slate-200/60 space-y-1.5 text-slate-600">
              <p>• <strong>Zero Raw Image Storage:</strong> Enrolment photos are processed in volatile memory into 512D feature vectors and immediately discarded.</p>
              <p>• <strong>Strict Cryptography:</strong> All feature vectors are AES-encrypted before saving to the database.</p>
              <p>• <strong>Voluntary & Revocable:</strong> You can delete all your biometric data at any time using the button below. Instructors always provide a manual attendance alternative.</p>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-950 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-emerald-400 text-pine focus:ring-emerald-500"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
            />
            <span className="leading-snug">
              I have read this privacy notice and voluntarily give explicit consent for facial biometric enrolment (Policy Version {status.text_version}).
            </span>
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!consentChecked || task.busy}
              onClick={handleConsentSubmit}
              className="btn text-sm py-2.5 px-6 shadow-sm font-bold"
            >
              {task.busy ? 'Registering Consent...' : 'Accept Consent & Start Enrolment →'}
            </button>
          </div>
        </section>
      ) : (
        /* ================= STEP 2: MULTI-POSE ENROLMENT WIZARD ================= */
        <div className="space-y-6">
          {/* Progress Overview Card */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-pine">Reference Pose Progress</h2>
                <p className="text-xs text-slate-500">
                  {isEnrolmentComplete
                    ? 'All 5 required reference poses have been registered. QR check-in is fully enabled.'
                    : `Please capture each of the 5 guided poses (${posesRemaining.length} remaining).`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-700">
                  {status?.count} / 10 Samples
                </span>
                <p className="text-[10px] text-slate-400">Min 5 required (1 per pose)</p>
              </div>
            </div>

            {/* 5-Pose Step Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {POSES.map(p => {
                const info = POSE_INFO[p];
                const isCaptured = completedPoses.includes(p);
                const isCurrent = selectedPose === p;

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPose(p)}
                    className={`rounded-xl p-3 text-left transition-all border ${
                      isCurrent
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                        : isCaptured
                        ? 'border-emerald-200 bg-mint/40 hover:bg-mint/60'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{info.icon}</span>
                      {isCaptured ? (
                        <span className="h-5 w-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold grid place-items-center">
                          ✓
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-900">{info.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isCaptured ? 'Captured' : isCurrent ? 'Active Pose' : 'Pending'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2-Column Desktop / Stacked Mobile Capture Workspace */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Viewfinder Column (7 cols) */}
            <div className="card p-4 space-y-3 lg:col-span-7 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-pine flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Face Viewfinder
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Target: {selectedPose.toUpperCase()}
                </span>
              </div>

              {/* Viewfinder Screen */}
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                {cameraOn ? (
                  <div className="h-full w-full">
                    <Webcam ref={camera} facingMode="user" />
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-slate-400 border border-slate-800">
                      <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Face Camera Standby</p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                        Enable your front-facing camera to capture reference poses in good room lighting.
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
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                {cameraOn && (
                  <button
                    type="button"
                    onClick={() => setCameraOn(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Turn Off Camera
                  </button>
                )}
                <p className="text-[11px] text-slate-400 ml-auto">
                  Photographs processed into mathematical embeddings; raw images not stored.
                </p>
              </div>
            </div>

            {/* Pose Instruction & Action Column (5 cols) */}
            <div className="card space-y-4 lg:col-span-5">
              <div className="border-b border-slate-100 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Guided Pose Instruction
                </span>
                <h3 className="text-base font-bold text-pine mt-0.5">
                  {POSE_INFO[selectedPose].label}
                </h3>
              </div>

              <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                  <span className="text-base">{POSE_INFO[selectedPose].icon}</span>
                  {POSE_INFO[selectedPose].direction}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {POSE_INFO[selectedPose].hint}
                </p>
                <div className="pt-2 border-t border-emerald-200/50 text-[11px] text-slate-500 space-y-0.5">
                  <p>• Remove dark sunglasses or face-covering hats.</p>
                  <p>• Avoid strong backlight or deep shadows.</p>
                </div>
              </div>

              {/* Primary Capture Action Button */}
              <button
                type="button"
                disabled={!cameraOn || task.busy || (status?.count || 0) >= 10}
                onClick={handleCaptureSample}
                className="btn w-full py-3 text-sm shadow-sm font-bold"
              >
                {task.busy
                  ? 'Analyzing & Encrypting...'
                  : `Capture ${POSE_INFO[selectedPose].label} Sample`}
              </button>

              {!cameraOn && (
                <p className="text-[11px] text-slate-400 text-center">
                  Enable the face camera above to capture this pose.
                </p>
              )}

              {status?.count >= 10 && (
                <p className="text-xs text-amber-800 text-center font-medium">
                  Maximum sample limit (10) reached. Delete existing data below if you wish to re-record.
                </p>
              )}

              <Progress busy={task.busy} label="Detecting face landmarks, verifying pose angle, and generating encrypted embedding vector..." />
            </div>
          </div>

          {/* Withdrawal & Biometric Privacy Section */}
          <section className="card border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-sm font-bold text-slate-900">
                Withdraw Consent & Erase Biometric Data
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Revoking consent permanently purges all encrypted facial embeddings and temporary crops from the server database. Existing course attendance records will not be altered.
              </p>
            </div>
            <button
              type="button"
              disabled={task.busy}
              onClick={() => setDeleteConfirmOpen(true)}
              className="btn danger text-xs py-2 px-4 shadow-sm font-semibold shrink-0"
            >
              Delete My Biometric Data
            </button>
          </section>
        </div>
      )}

      {/* Confirmation Modal: Delete Biometric Data */}
      <Modal
        open={deleteConfirmOpen}
        title="Revoke Biometric Consent & Delete Embeddings"
        description="Are you sure you want to permanently erase your biometric data?"
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 space-y-1.5">
            <p className="font-bold">Permanent Deletion Notice:</p>
            <p>
              All stored facial vector embeddings will be permanently removed. You will not be able to use 2-factor QR classroom check-in until you re-enrol.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="btn secondary text-xs py-2 px-4"
            >
              Keep My Data
            </button>
            <button
              type="button"
              disabled={task.busy}
              onClick={handleDeleteBiometrics}
              className="btn danger text-xs py-2 px-4"
            >
              {task.busy ? 'Deleting...' : 'Yes, Permanently Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
