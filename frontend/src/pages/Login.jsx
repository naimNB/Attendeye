import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../components/Auth';
import { useTask, ErrorBox, Field } from '../components/UI';
export default function Login() {
  const { user, login } = useAuth(); const task = useTask();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  function fill(demoEmail) {
    setEmail(demoEmail);
    setPassword('password123');
  }

  if (user) return <Navigate to="/" replace/>;

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-xl md:grid-cols-2">
        <div className="bg-pine p-10 text-white">
          <div className="mb-20 text-sm font-semibold tracking-widest text-emerald-200">PUB / TRACK B4</div>
          <h1 className="text-4xl text-white">Every class.<br/>Every student.</h1>
          <p className="mt-5 text-emerald-100">A clear attendance record, with face matching, consent and teacher review.</p>
          <div className="mt-12 rounded-xl bg-emerald-900/40 p-4 border border-emerald-700/50">
            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2">Default Password</p>
            <code className="text-sm font-mono text-white bg-black/30 px-2 py-1 rounded">password123</code>
          </div>
          <p className="mt-8 text-xs text-emerald-200">University hackathon prototype</p>
        </div>
        <form className="space-y-4 p-10" onSubmit={e => { e.preventDefault(); task.run(() => login(email.trim(), password)); }}>
          <h2 className="text-2xl font-bold">Welcome to AttendEye</h2>
          <p className="muted text-sm">Sign in with a demo account below:</p>
          
          <div className="flex flex-wrap gap-2 pt-1 pb-2">
            <button type="button" onClick={() => fill('admin@demo.invalid')} className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition">
              Admin
            </button>
            <button type="button" onClick={() => fill('teacher1@demo.invalid')} className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition">
              Teacher 1
            </button>
            <button type="button" onClick={() => fill('student1@demo.invalid')} className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition">
              Student 1
            </button>
            <button type="button" onClick={() => fill('student2@demo.invalid')} className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition">
              Student 2
            </button>
          </div>

          <ErrorBox error={task.error}/>
          <Field title="Email">
            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. admin@demo.invalid"/>
          </Field>
          <Field title="Password">
            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
          </Field>
          <button disabled={task.busy} className="btn w-full">{task.busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="muted text-xs">Signing out or refreshing clears your browser login. No biometric data is stored in your browser.</p>
        </form>
      </div>
    </div>
  );
}
