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

function PoseIcon({ pose, className = 'h-5 w-5' }) {
  if (pose === 'front') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  }
  if (pose === 'left') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    );
  }
  if (pose === 'right') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    );
  }
  if (pose === 'up') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  }
  if (pose === 'down') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  return null;
}

const POSE_INFO = {
  front: {
    step: '1',
    label: 'Front View',
    direction: 'Look directly into the camera',
    hint: 'Keep head level, centered in the frame, and maintain a neutral expression.',
  },
  left: {
    step: '2',
    label: 'Turn Left',
    direction: 'Turn your face slightly to your left',
    hint: 'Rotate head 15°–25° to your left while keeping eyes directed toward screen.',
  },
  right: {
    step: '3',
    label: 'Turn Right',
    direction: 'Turn your face slightly to your right',
    hint: 'Rotate head 15°–25° to your right while keeping eyes directed toward screen.',
  },
  up: {
    step: '4',
    label: 'Tilt Up',
    direction: 'Raise your chin upward slightly',
    hint: 'Tilt chin up by 10°–15° in even room lighting without tilting your torso.',
  },
  down: {
    step: '5',
    label: 'Tilt Down',
    direction: 'Lower your chin downward slightly',
    hint: 'Lower chin by 10°–15° while keeping eyes clearly visible to the camera.',
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
  const [lastFeedback, setLastFeedback] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  async function loadStatus() {
    setLoading(true);
    await task.run(async () => {
      const res = await api.get('/enrol/status');
      setStatus(res.data);
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
          message: `Successfully registered and encrypted ${selectedPose.toUpperCase()} pose sample!`,
        });

        const nextMissing = POSES.find(p => !data.poses.includes(p));
        if (nextMissing) {
          setSelectedPose(nextMissing);
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.detail || err.message || 'Capture quality check failed. Ensure good lighting and face visibility.';
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
        message: 'Your biometric embeddings and temporary review crops have been permanently erased.',
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
          className={`rounded-xl border p-4 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs ${
            lastFeedback.type === 'success'
              ? 'border-teal-300 bg-teal-50 text-teal-950'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {lastFeedback.type === 'success' ? (
              <svg className="h-4 w-4 text-teal-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{lastFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastFeedback(null)}
            className="text-slate-500 hover:text-slate-800 p-1"
            aria-label="Dismiss notification"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonLoader count={2} className="h-40" />
      ) : status && !status.consented ? (
        /* ================= STEP 1: CONSENT AGREEMENT ================= */
        <section className="card space-y-5 border-teal-200">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="h-5 w-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Biometric Privacy & Consent Agreement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please review the university data protection policy for facial biometric attendance.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">
              Institutional Privacy Policy:
            </p>
            <p className="italic bg-white p-3 rounded-lg border border-slate-200/80">
              “{status.consent_text}”
            </p>

            <div className="pt-2 border-t border-slate-200 space-y-1.5 text-slate-600">
              <p>• <strong>Zero Raw Image Storage:</strong> Enrolment photos are processed in volatile RAM into mathematical 512D feature vectors and immediately discarded.</p>
              <p>• <strong>Cryptographic Protection:</strong> Feature vectors are encrypted with Fernet AES before persistence to the database.</p>
              <p>• <strong>Revocable Anytime:</strong> You can delete all your biometric data at any time. Faculty members always provide a non-biometric manual alternative.</p>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-xs text-teal-950 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
            />
            <span className="leading-relaxed">
              I have read this privacy notice and give explicit consent for facial biometric enrolment (Policy Version {status.text_version}).
            </span>
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!consentChecked || task.busy}
              onClick={handleConsentSubmit}
              className="btn text-xs py-2.5 px-6 font-bold"
            >
              {task.busy ? 'Registering Consent…' : 'Accept Consent & Start Enrolment →'}
            </button>
          </div>
        </section>
      ) : (
        /* ================= STEP 2: MULTI-POSE ENROLMENT WIZARD ================= */
        <div className="space-y-6">
          {/* Progress Overview Card with Numbered Pose Steps */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Numbered Reference Pose Steps</h2>
                <p className="text-xs text-slate-500">
                  {isEnrolmentComplete
                    ? 'All 5 required reference poses are registered. 2-factor QR attendance is fully unlocked.'
                    : `Please record each of the 5 guided poses (${posesRemaining.length} remaining).`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-800">
                  {status?.count} / 10 Samples Registered
                </span>
                <p className="text-[10px] text-slate-400">Minimum 5 required (1 per pose angle)</p>
              </div>
            </div>

            {/* 5-Pose Step Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {POSES.map((p, idx) => {
                const info = POSE_INFO[p];
                const isCaptured = completedPoses.includes(p);
                const isCurrent = selectedPose === p;

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPose(p)}
                    className={`rounded-xl p-3.5 text-left transition-all border ${
                      isCurrent
                        ? 'border-teal-700 bg-teal-50/70 shadow-sm ring-2 ring-teal-600/20'
                        : isCaptured
                        ? 'border-teal-200 bg-teal-50/40 hover:bg-teal-50/80'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        isCurrent
                          ? 'bg-teal-700 text-white'
                          : isCaptured
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        Step {info.step}
                      </span>
                      {isCaptured ? (
                        <span className="h-5 w-5 rounded-full bg-teal-700 text-white grid place-items-center" aria-label="Captured">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <PoseIcon pose={p} className={`h-4 w-4 ${isCurrent ? 'text-teal-700' : 'text-slate-600'}`} />
                      <p className="text-xs font-bold text-slate-900">{info.label}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isCaptured ? 'Captured' : isCurrent ? 'Current Selection' : 'Pending'}
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
                <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cameraOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  Face Camera Viewfinder
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Active Pose: {selectedPose.toUpperCase()}
                </span>
              </div>

              {/* Viewfinder Screen with Oval Guide Overlay */}
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                {cameraOn ? (
                  <div className="relative h-full w-full">
                    <Webcam ref={camera} facingMode="user" />
                    {/* Centering Face Oval Guide */}
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="w-48 h-64 border-2 border-teal-400/50 rounded-[50%] border-dashed" />
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-slate-400 border border-slate-800">
                      <svg className="h-7 w-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Camera Standby</p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                        Turn on your camera to capture reference poses in even room lighting.
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
                  Vectors extracted in volatile RAM; raw photographs are not retained.
                </p>
              </div>
            </div>

            {/* Pose Instruction & Action Column (5 cols) */}
            <div className="card space-y-4 lg:col-span-5">
              <div className="border-b border-slate-100 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  Step {POSE_INFO[selectedPose].step} · Guided Pose Instruction
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {POSE_INFO[selectedPose].label}
                </h3>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-2">
                <p className="text-xs font-bold text-teal-950 flex items-center gap-2">
                  <PoseIcon pose={selectedPose} className="h-4 w-4 text-teal-800 shrink-0" />
                  {POSE_INFO[selectedPose].direction}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {POSE_INFO[selectedPose].hint}
                </p>
                <div className="pt-2 border-t border-teal-200/60 text-[11px] text-slate-500 space-y-0.5">
                  <p>• Keep face centered inside the camera guide.</p>
                  <p>• Avoid strong backlight or deep shadows.</p>
                </div>
              </div>

              {/* Primary Capture Action Button */}
              <button
                type="button"
                disabled={!cameraOn || task.busy || (status?.count || 0) >= 10}
                onClick={handleCaptureSample}
                className="btn w-full py-3 text-xs font-bold shadow-sm"
              >
                {task.busy
                  ? 'Analyzing & Encrypting…'
                  : `Capture ${POSE_INFO[selectedPose].label} Sample`}
              </button>

              {!cameraOn && (
                <p className="text-[11px] text-slate-400 text-center">
                  Enable the face camera above to capture this pose.
                </p>
              )}

              {status?.count >= 10 && (
                <p className="text-xs text-amber-800 text-center font-medium">
                  Maximum sample limit (10) reached. Delete existing biometrics below if you wish to re-record.
                </p>
              )}

              <Progress busy={task.busy} label="Detecting face landmarks, verifying pose angle, and generating encrypted embedding vector…" />
            </div>
          </div>

          {/* Biometric Deletion & Consent Revocation Section */}
          <section className="card border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-sm font-bold text-slate-900">
                Revoke Consent & Erase Biometric Data
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Revoking consent permanently purges all encrypted facial embeddings and temporary review crops from the database. Existing course attendance records are preserved.
              </p>
            </div>
            <button
              type="button"
              disabled={task.busy}
              onClick={() => setDeleteConfirmOpen(true)}
              className="btn btn-outline-danger text-xs py-2 px-4 shadow-xs font-semibold shrink-0"
            >
              Delete Biometric Data
            </button>
          </section>
        </div>
      )}

      {/* Confirmation Modal: Delete Biometric Data */}
      <Modal
        open={deleteConfirmOpen}
        title="Revoke Consent & Delete Biometrics"
        description="Are you sure you want to permanently erase your biometric data?"
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 space-y-1.5">
            <p className="font-bold">Permanent Deletion Notice:</p>
            <p>
              All stored facial vector embeddings will be permanently deleted. You will not be able to use 2-factor QR classroom check-in until you re-enrol.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="btn secondary btn-sm text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={task.busy}
              onClick={handleDeleteBiometrics}
              className="btn danger btn-sm text-xs"
            >
              {task.busy ? 'Deleting…' : 'Yes, Delete Biometrics'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
