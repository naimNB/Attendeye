import { useState, useEffect } from 'react';
import { errorText } from '../api/client';

export function ErrorBox({ error, onDismiss, retry }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-900 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p className="font-semibold text-rose-950">Notice</p>
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">{error}</p>
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="mt-2 text-xs font-semibold text-rose-900 underline hover:text-rose-950"
            >
              Retry operation
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-rose-500 hover:text-rose-800 p-1"
          aria-label="Dismiss alert"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run, setError };
}

export function Field({ title, hint, error, required, children }) {
  return (
    <label className="field">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          {title}
          {required && <span className="text-rose-600 ml-1">*</span>}
        </span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
    </label>
  );
}

export function Heading({ title, detail, badge, children, date }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/60 pb-5">
      <div>
        {date && (
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-1">
            {date}
          </p>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-pine sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {detail && <p className="muted mt-1.5 text-xs sm:text-sm">{detail}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ icon, title, children = 'No records yet.', action }) {
  return (
    <div className="card py-12 text-center flex flex-col items-center justify-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-pine mb-3">
        {icon || (
          <svg className="h-6 w-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
      <p className="muted mt-1 text-xs max-w-sm">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ busy, label, count, total }) {
  if (!busy) return null;

  const isDeterminate = typeof count === 'number' && typeof total === 'number' && total > 0;
  const pct = isDeterminate ? Math.min(100, Math.round((count / total) * 100)) : null;

  return (
    <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold text-emerald-950">
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-emerald-700" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {label || 'Processing on the server. Please keep this page open.'}
        </span>
        {isDeterminate && <span className="font-mono text-emerald-800">{count}/{total} frames</span>}
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-emerald-200/60">
        {isDeterminate ? (
          <div
            className="h-full rounded-full bg-emerald-700 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-700" />
        )}
      </div>

      <p className="mt-2 text-[11px] text-emerald-800/80">
        {isDeterminate
          ? 'Sampling consecutive video frames for real-time motion and liveness verification.'
          : 'Server executing facial detection, liveness scoring, and roster embedding comparison on CPU.'}
      </p>
    </div>
  );
}

export function Badge({ variant = 'info', children, icon, className = '' }) {
  const styles = {
    live: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    open: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    expired: 'bg-amber-100 text-amber-800 border border-amber-300',
    closed: 'bg-slate-100 text-slate-700 border border-slate-300',
    review: 'bg-amber-50 text-amber-900 border border-amber-300',
    demo: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    danger: 'bg-rose-100 text-rose-800 border border-rose-300',
    info: 'bg-mint text-pine border border-emerald-200',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  const activeStyle = styles[variant] || styles.info;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${activeStyle} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatCard({ title, value, detail, badge, icon, highlight, to, onClick }) {
  const content = (
    <div
      className={`card ${highlight ? 'border-emerald-300 bg-emerald-50/20' : ''} ${
        to || onClick ? 'card-hover cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {icon && (
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-pine">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {badge}
      </div>
      {detail && <p className="muted mt-1.5 text-xs">{detail}</p>}
    </div>
  );

  return content;
}

export function Modal({ open, title, description, onClose, children }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-pine">{title}</h2>
            {description && <p className="muted text-xs mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function SkeletonLoader({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-slate-200/70" />
      ))}
    </div>
  );
}
