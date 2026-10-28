import { useState, useEffect } from 'react';
import { errorText } from '../api/client';

export function ErrorBox({ error, onDismiss, retry }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-900 shadow-sm"
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
          <p className="font-semibold text-rose-950">System Notice</p>
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

export function SuccessBox({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/90 p-4 text-sm text-teal-900 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-teal-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <div>
          <p className="font-semibold text-teal-950">Success</p>
          <p className="mt-0.5 text-xs text-teal-800 leading-relaxed">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-teal-600 hover:text-teal-900 p-1"
          aria-label="Dismiss notification"
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

export function Field({ title, hint, error, required, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          {title}
          {required && <span className="text-rose-600 ml-1" aria-hidden="true">*</span>}
        </span>
        {hint && <span className="text-[11px] font-normal text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
    </label>
  );
}

export function Heading({ title, detail, badge, children, date }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div className="min-w-0">
        {date && (
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 mb-1">
            {date}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {detail && <p className="muted mt-1.5 text-xs sm:text-sm text-slate-600">{detail}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function Empty({ icon, title, children = 'No records yet.', action }) {
  return (
    <div className="card py-12 text-center flex flex-col items-center justify-center border-dashed">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-500 mb-3">
        {icon || (
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
      <p className="muted mt-1 text-xs max-w-sm text-slate-500">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ busy, label, count, total }) {
  if (!busy) return null;

  const isDeterminate = typeof count === 'number' && typeof total === 'number' && total > 0;
  const pct = isDeterminate ? Math.min(100, Math.round((count / total) * 100)) : null;

  return (
    <div role="status" className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold text-teal-950">
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-teal-700" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {label || 'Processing on the server. Please keep this page open.'}
        </span>
        {isDeterminate && <span className="font-mono text-teal-800">{count}/{total} frames</span>}
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-teal-200/60">
        {isDeterminate ? (
          <div
            className="h-full rounded-full bg-teal-700 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-700" />
        )}
      </div>

      <p className="mt-2 text-[11px] text-teal-900/80">
        {isDeterminate
          ? 'Sampling consecutive video frames for real-time motion and liveness verification.'
          : 'Server executing facial detection, liveness scoring, and roster embedding comparison on CPU.'}
      </p>
    </div>
  );
}

export function Badge({ variant = 'info', children, icon, className = '' }) {
  const styles = {
    live: 'badge-live',
    open: 'badge-open',
    expired: 'badge-expired',
    closed: 'badge-closed',
    review: 'badge-review',
    demo: 'badge-demo',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  const activeStyle = styles[variant] || styles.info;

  return (
    <span
      className={`badge ${activeStyle} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function StatCard({ title, value, detail, badge, icon, highlight, to, onClick }) {
  return (
    <div
      className={`card ${highlight ? 'border-teal-300 bg-teal-50/20' : ''} ${
        to || onClick ? 'card-hover cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {icon && (
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-teal-800">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {badge}
      </div>
      {detail && <p className="muted mt-1.5 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export function Modal({ open, title, description, onClose, children, maxWidth = 'max-w-lg' }) {
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
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3.5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description && <p className="muted text-xs mt-0.5 text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
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

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={busy ? () => {} : onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            className="btn secondary text-xs py-2 px-3.5"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn text-xs py-2 px-4 ${confirmVariant === 'danger' ? 'danger' : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
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

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus-visible:border-teal-600"
      />
    </div>
  );
}
