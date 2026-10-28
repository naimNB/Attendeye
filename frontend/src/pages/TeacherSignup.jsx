import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useTask, ErrorBox, Field } from '../components/UI';

export default function TeacherSignup() {
  const task = useTask();
  const [form, setForm] = useState({
    name: '',
    staff_id: '',
    email: '',
    department: '',
    password: '',
    confirm_password: '',
  });
  const [validationError, setValidationError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  function updateField(key, value) {
    setValidationError('');
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setValidationError('');

    if (form.password.length < 10) {
      setValidationError('Account password must be at least 10 characters long.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setValidationError('Passwords do not match. Please verify your password entry.');
      return;
    }

    await task.run(async () => {
      const payload = {
        name: form.name.trim(),
        staff_id: form.staff_id.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        password: form.password,
      };
      const { data } = await api.post('/auth/register/teacher', payload);
      setRegisteredUser(data.user);
      setSubmitted(true);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm grid md:grid-cols-2">
        {/* Dark Navy Faculty Column */}
        <div className="bg-slate-900 p-8 sm:p-10 text-white flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 font-bold text-white text-xs">
                PUB
              </span>
              <span className="font-bold text-sm tracking-tight text-white">
                PUB AttendEye
              </span>
            </div>

            <div className="text-xs font-bold tracking-widest uppercase mb-4 text-teal-400">
              Faculty Application
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold whitespace-pre-line leading-tight text-white">
              Faculty Registration
            </h1>
            <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Create an instructor account to manage class sections, initiate live camera attendance
              sessions, broadcast rotating check-in QR codes, and review matches.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="rounded-xl bg-slate-800/80 p-4 border border-slate-750 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">Academic Roster Verification</p>
              <p className="leading-relaxed text-slate-400">
                Staff IDs are cross-referenced with university faculty directories. Your account will be activated once confirmed by the department administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Form or Submitted State Column */}
        <div className="p-8 sm:p-10 flex flex-col justify-between bg-white">
          {submitted ? (
            <div className="my-auto space-y-6">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <span className="badge badge-expired text-xs font-bold mb-2">
                  Registration Received · Pending Review
                </span>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Faculty Application Submitted
                </h2>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Your instructor registration application for <strong>{registeredUser?.name}</strong> has been logged.
                  Staff ID <strong>{registeredUser?.staff_id}</strong> will be confirmed against faculty rosters prior to account approval.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                <p className="font-semibold text-slate-700">Account Summary</p>
                <p className="text-slate-600">Email: {registeredUser?.email}</p>
                <p className="text-slate-600">Department: {registeredUser?.department}</p>
                <p className="text-slate-600">Status: Pending Administrative Review</p>
              </div>

              <Link
                to="/teacher/login"
                className="btn w-full py-2.5 text-xs text-center block"
              >
                Go to Teacher Login →
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-5">
                <div className="inline-block rounded-md bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-800 mb-2">
                  Faculty Registration
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Register Instructor Account</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your official university employment credentials.
                </p>
              </div>

              <ErrorBox error={validationError || task.error} />

              <form className="mt-4 space-y-3.5" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="Full Legal Name" required>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="e.g. Dr. Ayesha Rahman"
                    />
                  </Field>

                  <Field title="Staff / Faculty ID" hint="Official employee ID" required>
                    <input
                      type="text"
                      required
                      value={form.staff_id}
                      onChange={e => updateField('staff_id', e.target.value)}
                      placeholder="e.g. FAC-CSE-012"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="Academic Department" required>
                    <input
                      type="text"
                      required
                      value={form.department}
                      onChange={e => updateField('department', e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                    />
                  </Field>

                  <Field title="Official University Email" required>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => updateField('email', e.target.value)}
                      placeholder="instructor@university.edu"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="Create Password" hint="Minimum 10 chars" required>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={form.password}
                        onChange={e => updateField('password', e.target.value)}
                        placeholder="••••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field title="Confirm Password" required>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.confirm_password}
                      onChange={e => updateField('confirm_password', e.target.value)}
                      placeholder="••••••••••"
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  disabled={task.busy}
                  className="btn w-full py-2.5 text-xs font-semibold mt-2"
                >
                  {task.busy ? 'Submitting Application…' : 'Submit Faculty Registration'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-center text-slate-500">
                Already registered?{' '}
                <Link to="/teacher/login" className="font-semibold text-teal-800 hover:text-teal-950 underline">
                  Sign in here
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
