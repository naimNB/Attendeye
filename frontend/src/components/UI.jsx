import { useState } from 'react';
import { errorText } from '../api/client';
export function ErrorBox({ error }) { return error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null; }
export function useTask() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function run(fn) { setBusy(true); setError(''); try { return await fn(); } catch (e) { setError(errorText(e)); return undefined; } finally { setBusy(false); } }
  return { busy, error, run, setError };
}
export function Field({ title, children }) { return <label className="field"><span>{title}</span>{children}</label>; }
export function Heading({ title, detail, children }) { return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1>{title}</h1>{detail && <p className="muted mt-2">{detail}</p>}</div>{children}</div>; }
export function Empty({ children = 'No records yet.' }) { return <p className="card py-10 text-center text-slate-500">{children}</p>; }
export function Progress({ busy, label }) { return busy ? <div role="status" className="rounded-xl bg-mint p-4"><p className="text-sm font-medium">{label || 'Processing on the server. Please keep this page open.'}</p><div className="mt-2 h-1.5 overflow-hidden rounded bg-emerald-100"><div className="h-full w-1/2 animate-pulse rounded bg-emerald-600"/></div></div> : null; }
