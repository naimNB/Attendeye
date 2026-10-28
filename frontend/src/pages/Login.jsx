import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../components/Auth';
import { useTask, ErrorBox, Field } from '../components/UI';

export default function Login() {
  const { user, login } = useAuth();
  const task = useTask();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) return <Navigate to="/" replace/>;

  return (
    <div className="grid min-h-screen place-items-center p-6 bg-slate-50">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <div className="bg-slate-900 p-10 text-white flex flex-col justify-between">
          <div>
            <div className="mb-12 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 font-bold text-white text-xs">
                PUB
              </span>
              <span className="font-bold text-sm tracking-tight text-white">
                PUB AttendEye
              </span>
            </div>
            <div className="mb-4 text-xs font-bold tracking-widest text-teal-400 uppercase">PUB / ACADEMIC ACCESS</div>
            <h1 className="text-3xl font-extrabold text-white leading-tight">Every class.<br/>Every student.</h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">A clear attendance record, with face matching, consent and teacher review.</p>
          </div>
          <p className="mt-8 text-xs text-slate-400">Academic Attendance & Biometric Verification System</p>
        </div>
        <form className="space-y-4 p-10 flex flex-col justify-between" onSubmit={e => { e.preventDefault(); task.run(() => login(email.trim(), password)); }}>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome to PUB AttendEye</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in with your institutional account:</p>

            <div className="mt-6 space-y-4">
              <ErrorBox error={task.error}/>
              <Field title="Email Address" required>
                <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@university.edu"/>
              </Field>
              <Field title="Password" required>
                <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
              </Field>
              <button disabled={task.busy} className="btn w-full mt-2">{task.busy ? 'Signing in…' : 'Sign in'}</button>
            </div>
          </div>
          <p className="text-xs text-slate-400 pt-6">Signing out or refreshing clears your browser login. Biometric face vectors are encrypted with Fernet.</p>
        </form>
      </div>
    </div>
  );
}
