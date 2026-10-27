import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useTask, ErrorBox, Field } from '../components/UI';

export default function StudentSignup() {
  const task = useTask();
  const [form, setForm] = useState({
    name: '',
    student_code: '',
    email: '',
    department: '',
    batch: '',
    password: '',
    confirm_password: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 10) {
      alert('Password must be at least 10 characters long.');
      return;
    }
    if (form.password !== form.confirm_password) {
      alert('Passwords do not match. Please re-enter.');
      return;
    }

    await task.run(async () => {
      const payload = {
        name: form.name.trim(),
        student_code: form.student_code.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        batch: form.batch.trim() || undefined,
        password: form.password,
      };
      const { data } = await api.post('/auth/register/student', payload);
      setRegisteredUser(data.user);
      setSubmitted(true);
    });
  }

  return (
    <div className="grid min-h-screen place-items-center p-6 bg-slate-100">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        {/* Banner */}
        <div className="bg-emerald-950 p-10 text-white flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-12 text-emerald-300">
              PUB / STUDENT PORTAL
            </div>
            <h1 className="text-3xl font-bold whitespace-pre-line leading-tight text-white">
              Student Registration
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Create your student account to access course attendance records, biometric enrolment,
              and live QR check-ins.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-white/10 p-4 border border-white/10 backdrop-blur-sm">
              <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1.5">
                Identity Notice
              </p>
              <p className="text-xs text-slate-200 leading-relaxed">
                University student IDs are identifiers, not self-executing proof. All new registrations
                remain pending until explicitly verified against official university rosters by an administrator.
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Biometric face templates and temporary photos are never collected during registration.
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="p-8 md:p-10 flex flex-col justify-between">
          {submitted ? (
            <div className="space-y-6 my-auto">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-emerald-950">
                <span className="text-3xl block mb-2">📋</span>
                <h2 className="text-xl font-bold">Registration Submitted</h2>
                <p className="text-xs text-emerald-800 mt-2 leading-relaxed">
                  Your application has been received and is now pending administrator review.
                  An academic administrator will verify your identifier <strong>{registeredUser?.student_code}</strong> against institutional rosters before approval.
                </p>
                <div className="mt-4 pt-3 border-t border-emerald-200/60 text-xs text-emerald-900 space-y-1">
                  <p><strong>Name:</strong> {registeredUser?.name}</p>
                  <p><strong>Email:</strong> {registeredUser?.email}</p>
                  <p><strong>Department:</strong> {registeredUser?.department}</p>
                  <p><strong>Status:</strong> <span className="font-semibold text-amber-700 uppercase">Pending Approval</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  to="/student/login"
                  className="btn w-full text-center block bg-pine text-white"
                >
                  Proceed to Student Portal Sign In →
                </Link>
                <p className="text-center text-xs text-slate-500">
                  You can sign in anytime to monitor your application verification status.
                </p>
              </div>
            </div>
          ) : (
            <form className="space-y-3.5" onSubmit={handleSubmit}>
              <div>
                <div className="inline-block rounded-md bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-semibold mb-2">
                  Student Application
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Create Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your official university academic details below.
                </p>
              </div>

              <ErrorBox error={task.error} />

              <Field title="Full Name">
                <input
                  type="text"
                  required
                  placeholder="e.g. Anika Tabassum"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field title="University Student ID">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-CSE-042"
                    value={form.student_code}
                    onChange={e => updateField('student_code', e.target.value)}
                  />
                </Field>
                <Field title="Batch / Semester">
                  <input
                    type="text"
                    placeholder="e.g. 52nd Batch"
                    value={form.batch}
                    onChange={e => updateField('batch', e.target.value)}
                  />
                </Field>
              </div>

              <Field title="Department">
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science and Engineering"
                  value={form.department}
                  onChange={e => updateField('department', e.target.value)}
                />
              </Field>

              <Field title="Email Address">
                <input
                  type="email"
                  required
                  placeholder="e.g. student@pub.ac.bd"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field title="Password (min 10 chars)">
                  <input
                    type="password"
                    required
                    minLength={10}
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={e => updateField('password', e.target.value)}
                  />
                </Field>
                <Field title="Confirm Password">
                  <input
                    type="password"
                    required
                    minLength={10}
                    placeholder="••••••••••••"
                    value={form.confirm_password}
                    onChange={e => updateField('confirm_password', e.target.value)}
                  />
                </Field>
              </div>

              <button disabled={task.busy} className="btn w-full py-2.5 font-medium mt-2">
                {task.busy ? 'Submitting Application…' : 'Submit Student Registration'}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Already registered?{' '}
                <Link to="/student/login" className="font-semibold text-emerald-800 underline">
                  Sign in here
                </Link>
              </div>
            </form>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3 flex justify-between text-xs text-slate-400">
            <Link to="/teacher/signup" className="hover:text-slate-700">
              Teacher Registration →
            </Link>
            <Link to="/" className="hover:text-slate-700">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
