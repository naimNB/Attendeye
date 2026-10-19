import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Heading, Field, ErrorBox, useTask } from '../components/UI';

export default function Admin() {
  const task = useTask();
  const [tab, setTab] = useState('teachers'); // 'teachers' | 'students' | 'admins' | 'academics' | 'settings'

  // Data states
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [enrolments, setEnrolments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [settings, setSettings] = useState(null);

  // Search filter
  const [search, setSearch] = useState('');

  // Modals & Forms
  const [userModal, setUserModal] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: '', student_code: '', password: '' });
  const [linkModal, setLinkModal] = useState(null);
  const [selectedSection, setSelectedSection] = useState('');

  // Course / Section modal
  const [academicModal, setAcademicModal] = useState(null);
  const [academicForm, setAcademicForm] = useState({});

  async function load() {
    const [u, c, s, e, a, st] = await Promise.all([
      api.get('/users'),
      api.get('/courses'),
      api.get('/sections'),
      api.get('/enrolments'),
      api.get('/teacher-assignments'),
      api.get('/settings')
    ]);
    setUsers(u.data);
    setCourses(c.data);
    setSections(s.data);
    setEnrolments(e.data);
    setAssignments(a.data);
    setSettings(st.data);
  }

  useEffect(() => {
    task.run(load);
  }, []);

  // Filtered User Lists
  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const admins = users.filter(u => u.role === 'admin');

  // Search logic
  const q = search.toLowerCase().trim();
  const filteredTeachers = teachers.filter(t => !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  const filteredStudents = students.filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.student_code && s.student_code.toLowerCase().includes(q)));
  const filteredAdmins = admins.filter(a => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));

  // Helpers to resolve section names
  function getSectionLabel(secId) {
    const sec = sections.find(s => s.id === secId);
    if (!sec) return `Section ${secId}`;
    return `${sec.course_code || 'Course'} / ${sec.name}`;
  }

  function getTeacherSections(teacherId) {
    return assignments.filter(a => a.teacher_id === teacherId).map(a => ({
      section_id: a.section_id,
      label: getSectionLabel(a.section_id)
    }));
  }

  function getStudentSections(studentId) {
    return enrolments.filter(e => e.student_id === studentId).map(e => ({
      section_id: e.section_id,
      label: getSectionLabel(e.section_id)
    }));
  }

  // User Actions
  function openAddUser(role) {
    setUserForm({ name: '', email: '', role, student_code: '', password: '' });
    setUserModal({ mode: 'add', role });
  }

  function openEditUser(user) {
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      student_code: user.student_code || '',
      password: ''
    });
    setUserModal({ mode: 'edit', role: user.role, data: user });
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    await task.run(async () => {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        student_code: userForm.role === 'student' ? (userForm.student_code?.trim() || null) : null,
      };
      if (userForm.password) {
        payload.password = userForm.password;
      }

      if (userModal.mode === 'edit') {
        await api.put(`/users/${userModal.data.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      setUserModal(null);
      await load();
    });
  }

  async function handleDeleteUser(userId, name) {
    if (!window.confirm(`Delete ${name}? Historical records may prevent deletion.`)) return;
    await task.run(async () => {
      await api.delete(`/users/${userId}`);
      await load();
    });
  }

  // Section Linking Actions
  async function handleAssignSection(e) {
    e.preventDefault();
    if (!selectedSection) return;
    await task.run(async () => {
      if (linkModal.type === 'teacher') {
        await api.post('/teacher-assignments', {
          teacher_id: linkModal.userId,
          section_id: Number(selectedSection)
        });
      } else {
        await api.post('/enrolments', {
          student_id: linkModal.userId,
          section_id: Number(selectedSection)
        });
      }
      setLinkModal(null);
      setSelectedSection('');
      await load();
    });
  }

  async function handleRemoveAssignment(teacherId, sectionId) {
    if (!window.confirm('Remove this section assignment?')) return;
    await task.run(async () => {
      await api.delete(`/teacher-assignments/${teacherId}/${sectionId}`);
      await load();
    });
  }

  async function handleRemoveEnrolment(studentId, sectionId) {
    if (!window.confirm('Un-enrol student from this section?')) return;
    await task.run(async () => {
      await api.delete(`/enrolments/${studentId}/${sectionId}`);
      await load();
    });
  }

  // Course / Section Actions
  async function handleSaveAcademic(e) {
    e.preventDefault();
    await task.run(async () => {
      const isCourse = academicModal.type === 'course';
      const endpoint = isCourse ? '/courses' : '/sections';
      const body = { ...academicForm };
      if (!isCourse) body.course_id = Number(body.course_id);

      if (academicModal.mode === 'edit') {
        await api.put(`${endpoint}/${academicModal.data.id}`, body);
      } else {
        await api.post(endpoint, body);
      }
      setAcademicModal(null);
      await load();
    });
  }

  async function handleDeleteAcademic(type, id, label) {
    if (!window.confirm(`Delete ${type} "${label}"?`)) return;
    await task.run(async () => {
      await api.delete(`/${type}s/${id}`);
      await load();
    });
  }

  return (
    <>
      <Heading
        title="Administration Panel"
        detail="Manage Teachers, Students, Administrators, Courses, and System Thresholds."
      />
      <ErrorBox error={task.error}/>

      {/* Main Tabs (Strictly No Emojis/Symbols) */}
      <nav className="flex flex-wrap gap-2 mb-6">
        <button
          className={`btn ${tab === 'teachers' ? '' : 'secondary'}`}
          onClick={() => { setTab('teachers'); setSearch(''); }}
        >
          Teachers ({teachers.length})
        </button>
        <button
          className={`btn ${tab === 'students' ? '' : 'secondary'}`}
          onClick={() => { setTab('students'); setSearch(''); }}
        >
          Students ({students.length})
        </button>
        <button
          className={`btn ${tab === 'admins' ? '' : 'secondary'}`}
          onClick={() => { setTab('admins'); setSearch(''); }}
        >
          Administrators ({admins.length})
        </button>
        <button
          className={`btn ${tab === 'academics' ? '' : 'secondary'}`}
          onClick={() => { setTab('academics'); setSearch(''); }}
        >
          Courses and Sections ({courses.length}/{sections.length})
        </button>
        <button
          className={`btn ${tab === 'settings' ? '' : 'secondary'}`}
          onClick={() => { setTab('settings'); setSearch(''); }}
        >
          Recognition Settings
        </button>
      </nav>

      {/* TEACHERS SECTION */}
      {tab === 'teachers' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-pine">Teacher Management</h2>
              <p className="muted text-xs">Assigned teachers can open sessions, review photos, and issue QR check-ins.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search teacher by name or email..."
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button className="btn" onClick={() => openAddUser('teacher')}>
                Add Teacher
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Assigned Sections</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map(t => {
                  const assigned = getTeacherSections(t.id);
                  return (
                    <tr key={t.id}>
                      <td className="text-xs text-slate-500">{t.id}</td>
                      <td className="font-medium text-slate-800">{t.name}</td>
                      <td className="text-xs text-slate-600">{t.email}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {assigned.map(a => (
                            <span key={a.section_id} className="badge inline-flex items-center gap-1 text-xs">
                              {a.label}
                              <button
                                type="button"
                                title="Unassign section"
                                className="text-red-700 hover:underline ml-1 text-xs"
                                onClick={() => handleRemoveAssignment(t.id, a.section_id)}
                              >
                                Remove
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            className="text-xs text-emerald-800 hover:underline px-2 py-0.5 border border-dashed border-emerald-500 rounded bg-emerald-50"
                            onClick={() => { setLinkModal({ type: 'teacher', userId: t.id, name: t.name }); setSelectedSection(''); }}
                          >
                            Assign Section
                          </button>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="btn secondary text-xs py-1" onClick={() => openEditUser(t)}>Edit</button>
                          <button className="btn secondary text-xs py-1 text-red-700" onClick={() => handleDeleteUser(t.id, t.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredTeachers.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 muted">No teachers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* STUDENTS SECTION */}
      {tab === 'students' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-pine">Student Management</h2>
              <p className="muted text-xs">Enrolled students can record multi-pose facial biometrics and perform live QR check-ins.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search by ID, name or email..."
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button className="btn" onClick={() => openAddUser('student')}>
                Add Student
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Student Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Enrolled Sections</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const enrolled = getStudentSections(s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200">
                          {s.student_code || 'None'}
                        </span>
                      </td>
                      <td className="font-medium text-slate-800">{s.name}</td>
                      <td className="text-xs text-slate-600">{s.email}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {enrolled.map(e => (
                            <span key={e.section_id} className="badge inline-flex items-center gap-1 text-xs">
                              {e.label}
                              <button
                                type="button"
                                title="Un-enrol from section"
                                className="text-red-700 hover:underline ml-1 text-xs"
                                onClick={() => handleRemoveEnrolment(s.id, e.section_id)}
                              >
                                Remove
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            className="text-xs text-emerald-800 hover:underline px-2 py-0.5 border border-dashed border-emerald-500 rounded bg-emerald-50"
                            onClick={() => { setLinkModal({ type: 'student', userId: s.id, name: s.name }); setSelectedSection(''); }}
                          >
                            Enrol Section
                          </button>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="btn secondary text-xs py-1" onClick={() => openEditUser(s)}>Edit</button>
                          <button className="btn secondary text-xs py-1 text-red-700" onClick={() => handleDeleteUser(s.id, s.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredStudents.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 muted">No students found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ADMINISTRATORS SECTION */}
      {tab === 'admins' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-pine">System Administrators</h2>
              <p className="muted text-xs">Admins have full privileges across academic rosters, threshold configurations and user accounts.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search admin..."
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button className="btn" onClick={() => openAddUser('admin')}>
                Add Administrator
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map(a => (
                  <tr key={a.id}>
                    <td className="text-xs text-slate-500">{a.id}</td>
                    <td className="font-medium text-slate-800">{a.name}</td>
                    <td className="text-xs text-slate-600">{a.email}</td>
                    <td>
                      <span className="badge text-xs">
                        Administrator
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button className="btn secondary text-xs py-1" onClick={() => openEditUser(a)}>Edit</button>
                        <button className="btn secondary text-xs py-1 text-red-700" onClick={() => handleDeleteUser(a.id, a.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* COURSES AND SECTIONS */}
      {tab === 'academics' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Courses */}
          <section className="card space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-pine">Courses ({courses.length})</h2>
                <p className="muted text-xs">Course codes and official titles.</p>
              </div>
              <button className="btn text-xs" onClick={() => { setAcademicForm({ code: '', title: '' }); setAcademicModal({ type: 'course', mode: 'add' }); }}>
                Add Course
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono text-xs font-semibold text-slate-700">{c.code}</td>
                      <td className="text-slate-800">{c.title}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn secondary text-xs py-1" onClick={() => { setAcademicForm({ code: c.code, title: c.title }); setAcademicModal({ type: 'course', mode: 'edit', data: c }); }}>Edit</button>
                          <button className="btn secondary text-xs py-1 text-red-700" onClick={() => handleDeleteAcademic('course', c.id, c.code)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!courses.length && <tr><td colSpan={3} className="text-center py-4 muted">No courses.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sections */}
          <section className="card space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-pine">Sections ({sections.length})</h2>
                <p className="muted text-xs">Course sections linked to student enrolments and teachers.</p>
              </div>
              <button className="btn text-xs" onClick={() => { setAcademicForm({ course_id: courses[0]?.id || '', name: '' }); setAcademicModal({ type: 'section', mode: 'add' }); }}>
                Add Section
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Section Name</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(s => (
                    <tr key={s.id}>
                      <td className="text-xs text-slate-600">{s.course_code || `Course ${s.course_id}`}</td>
                      <td className="font-medium text-slate-800">{s.name}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn secondary text-xs py-1" onClick={() => { setAcademicForm({ course_id: s.course_id, name: s.name }); setAcademicModal({ type: 'section', mode: 'edit', data: s }); }}>Edit</button>
                          <button className="btn secondary text-xs py-1 text-red-700" onClick={() => handleDeleteAcademic('section', s.id, s.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sections.length && <tr><td colSpan={3} className="text-center py-4 muted">No sections.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* SETTINGS SECTION */}
      {tab === 'settings' && settings && (
        <form className="card max-w-xl space-y-5" onSubmit={e => { e.preventDefault(); task.run(async () => { setSettings((await api.put('/settings', settings)).data); alert('Settings updated successfully.'); }); }}>
          <div>
            <h2 className="text-lg font-semibold text-pine">Recognition and Attendance Settings</h2>
            <p className="muted text-xs">Tune facial recognition and attendance thresholds. Scores represent cosine similarities.</p>
          </div>
          {Object.keys(settings).map(key => (
            <Field title={key.replaceAll('_', ' ')} key={key}>
              <input
                type="number"
                required
                min="0"
                max={key === 'attendance_limit' ? 100 : 1}
                step="0.01"
                className="text-slate-800"
                value={settings[key]}
                onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })}
              />
            </Field>
          ))}
          <button className="btn" disabled={task.busy}>Save Settings</button>
        </form>
      )}

      {/* USER MODAL */}
      {userModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form className="card w-full max-w-md space-y-4" onSubmit={handleSaveUser}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h2 className="text-lg font-semibold text-pine">
                {userModal.mode === 'add' ? `Add New ${userModal.role}` : `Edit ${userModal.role}`}
              </h2>
              <button type="button" className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setUserModal(null)}>Cancel</button>
            </div>

            <Field title="Full Name">
              <input
                type="text"
                required
                placeholder="e.g. Dr. John Doe"
                className="text-slate-800"
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
              />
            </Field>

            <Field title="Email Address">
              <input
                type="email"
                required
                placeholder="e.g. user@university.edu"
                className="text-slate-800"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
              />
            </Field>

            {userModal.role === 'student' && (
              <Field title="Student ID or Code">
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-CSE-001"
                  className="text-slate-800"
                  value={userForm.student_code}
                  onChange={e => setUserForm({ ...userForm, student_code: e.target.value })}
                />
              </Field>
            )}

            <Field title={userModal.mode === 'add' ? 'Password (minimum 10 characters)' : 'Change Password (leave empty to keep current)'}>
              <input
                type="password"
                required={userModal.mode === 'add'}
                minLength={10}
                placeholder={userModal.mode === 'add' ? 'At least 10 characters' : 'Leave empty to keep unchanged'}
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn secondary" onClick={() => setUserModal(null)}>Cancel</button>
              <button className="btn" disabled={task.busy}>
                {userModal.mode === 'add' ? 'Create Account' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LINK MODAL */}
      {linkModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form className="card w-full max-w-sm space-y-4" onSubmit={handleAssignSection}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h2 className="text-base font-semibold text-pine">
                {linkModal.type === 'teacher' ? `Assign Section to ${linkModal.name}` : `Enrol ${linkModal.name} in Section`}
              </h2>
              <button type="button" className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setLinkModal(null)}>Cancel</button>
            </div>

            <Field title="Select Course Section">
              <select
                required
                className="text-slate-800"
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
              >
                <option value="">Choose a Section</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.course_code || 'Course'} / {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn secondary" onClick={() => setLinkModal(null)}>Cancel</button>
              <button className="btn" disabled={!selectedSection || task.busy}>
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ACADEMIC MODAL */}
      {academicModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form className="card w-full max-w-sm space-y-4" onSubmit={handleSaveAcademic}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h2 className="text-base font-semibold text-pine">
                {academicModal.mode === 'add' ? `Add ${academicModal.type}` : `Edit ${academicModal.type}`}
              </h2>
              <button type="button" className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setAcademicModal(null)}>Cancel</button>
            </div>

            {academicModal.type === 'course' ? (
              <>
                <Field title="Course Code (e.g. CSE-3205)">
                  <input
                    type="text"
                    required
                    className="text-slate-800"
                    value={academicForm.code || ''}
                    onChange={e => setAcademicForm({ ...academicForm, code: e.target.value })}
                  />
                </Field>
                <Field title="Course Title">
                  <input
                    type="text"
                    required
                    className="text-slate-800"
                    value={academicForm.title || ''}
                    onChange={e => setAcademicForm({ ...academicForm, title: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field title="Parent Course">
                  <select
                    required
                    className="text-slate-800"
                    value={academicForm.course_id || ''}
                    onChange={e => setAcademicForm({ ...academicForm, course_id: e.target.value })}
                  >
                    <option value="">Choose Course</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
                    ))}
                  </select>
                </Field>
                <Field title="Section Name (e.g. Section A)">
                  <input
                    type="text"
                    required
                    className="text-slate-800"
                    value={academicForm.name || ''}
                    onChange={e => setAcademicForm({ ...academicForm, name: e.target.value })}
                  />
                </Field>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn secondary" onClick={() => setAcademicModal(null)}>Cancel</button>
              <button className="btn" disabled={task.busy}>Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
