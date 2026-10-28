import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
import { Heading, Field, ErrorBox, useTask, Badge, Modal, Empty, SkeletonLoader } from '../components/UI';

export default function Admin({ initialTab = 'teachers' }) {
  const task = useTask();
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  // Core Data States
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [enrolments, setEnrolments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [requestFilter, setRequestFilter] = useState('all');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Modals & Forms
  const [userModal, setUserModal] = useState(null); // { mode: 'add' | 'edit', role, data }
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: '',
    student_code: '',
    staff_id: '',
    department: '',
    batch: '',
    password: '',
  });

  const [linkModal, setLinkModal] = useState(null); // { type: 'teacher' | 'student', userId, name }
  const [selectedSection, setSelectedSection] = useState('');

  const [academicModal, setAcademicModal] = useState(null); // { mode: 'add' | 'edit', type: 'course' | 'section', data }
  const [academicForm, setAcademicForm] = useState({});

  const [rosterModal, setRosterModal] = useState(null); // { section, data, loading }
  const [rosterStudentId, setRosterStudentId] = useState('');
  const [rosterActionError, setRosterActionError] = useState('');

  const [approvalModal, setApprovalModal] = useState(null); // { user }
  const [approvalMethod, setApprovalMethod] = useState('institutional_roster');

  const [rejectionModal, setRejectionModal] = useState(null); // { user }
  const [rejectionReason, setRejectionReason] = useState('');

  const [suspensionModal, setSuspensionModal] = useState(null); // { user }
  const [suspensionReason, setSuspensionReason] = useState('');

  async function load() {
    setLoading(true);
    await task.run(async () => {
      const [u, c, s, e, a, st, reqs, hist] = await Promise.all([
        api.get('/users'),
        api.get('/courses'),
        api.get('/sections'),
        api.get('/enrolments'),
        api.get('/teacher-assignments'),
        api.get('/settings'),
        api.get('/registration-requests'),
        api.get('/application-history'),
      ]);
      setUsers(u.data || []);
      setCourses(c.data || []);
      setSections(s.data || []);
      setEnrolments(e.data || []);
      setAssignments(a.data || []);
      setSettings(st.data || null);
      setRequests(reqs.data || []);
      setHistory(hist.data || []);
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Filtered User Lists
  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const admins = users.filter(u => u.role === 'admin');
  const pendingRequests = requests.filter(r => r.status === 'pending');

  // Client-side search filters operating on loaded dataset
  const q = search.toLowerCase().trim();

  const filteredTeachers = teachers.filter(
    t =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.staff_id && t.staff_id.toLowerCase().includes(q)) ||
      (t.department && t.department.toLowerCase().includes(q))
  );

  const filteredStudents = students.filter(
    s =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.student_code && s.student_code.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.batch && s.batch.toLowerCase().includes(q))
  );

  const filteredAdmins = admins.filter(
    a => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
  );

  const filteredRequests = requests.filter(r => {
    if (requestFilter !== 'all' && r.status !== requestFilter) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.student_code && r.student_code.toLowerCase().includes(q)) ||
      (r.staff_id && r.staff_id.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q))
    );
  });

  const filteredCourses = courses.filter(
    c => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
  );

  // Section Label Resolution Helper
  function getSectionLabel(secId) {
    const sec = sections.find(s => s.id === secId);
    if (!sec) return `Section #${secId}`;
    return `${sec.course_code || 'Course'} · ${sec.name}`;
  }

  function getTeacherSections(teacherId) {
    return assignments
      .filter(a => a.teacher_id === teacherId)
      .map(a => ({
        section_id: a.section_id,
        label: getSectionLabel(a.section_id),
      }));
  }

  function getStudentSections(studentId) {
    return enrolments
      .filter(e => e.student_id === studentId)
      .map(e => ({
        section_id: e.section_id,
        label: getSectionLabel(e.section_id),
      }));
  }

  // User Actions
  function openAddUser(role) {
    setUserForm({
      name: '',
      email: '',
      role,
      student_code: '',
      staff_id: '',
      department: '',
      batch: '',
      password: '',
    });
    setUserModal({ mode: 'add', role });
  }

  function openEditUser(user) {
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      student_code: user.student_code || '',
      staff_id: user.staff_id || '',
      department: user.department || '',
      batch: user.batch || '',
      password: '',
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
        student_code: userForm.role === 'student' ? userForm.student_code?.trim() || null : null,
        staff_id: userForm.role === 'teacher' ? userForm.staff_id?.trim() || null : null,
        department: userForm.department?.trim() || null,
        batch: userForm.role === 'student' ? userForm.batch?.trim() || null : null,
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
    if (!window.confirm(`Delete ${name}? Historical attendance records may prevent deletion if this account was part of completed class sessions.`)) {
      return;
    }
    await task.run(async () => {
      await api.delete(`/users/${userId}`);
      await load();
    });
  }

  // Registration Application Actions
  async function handleApprove(e) {
    e.preventDefault();
    if (!approvalModal) return;
    const candidate = approvalModal.user;
    await task.run(async () => {
      await api.post(`/registration-requests/${candidate.id}/approve`, {
        verification_method: approvalMethod,
      });
      setApprovalModal(null);
      await load();
      if (candidate.role === 'student') {
        setLinkModal({ type: 'student', userId: candidate.id, name: candidate.name });
        setSelectedSection('');
      }
    });
  }

  async function handleReject(e) {
    e.preventDefault();
    if (!rejectionModal) return;
    if (rejectionReason.trim().length < 3) {
      alert('Please provide a specific justification for rejection (at least 3 characters).');
      return;
    }
    await task.run(async () => {
      await api.post(`/registration-requests/${rejectionModal.user.id}/reject`, {
        reason: rejectionReason.trim(),
      });
      setRejectionModal(null);
      setRejectionReason('');
      await load();
    });
  }

  async function handleSuspend(e) {
    e.preventDefault();
    if (!suspensionModal) return;
    if (suspensionReason.trim().length < 3) {
      alert('Please provide a specific reason for suspension (at least 3 characters).');
      return;
    }
    await task.run(async () => {
      await api.post(`/users/${suspensionModal.user.id}/suspend`, {
        reason: suspensionReason.trim(),
      });
      setSuspensionModal(null);
      setSuspensionReason('');
      await load();
    });
  }

  async function handleUnsuspend(userId) {
    if (!window.confirm('Reactivate this account and restore portal access?')) return;
    await task.run(async () => {
      await api.post(`/users/${userId}/unsuspend`);
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
          section_id: Number(selectedSection),
        });
      } else {
        await api.post('/enrolments', {
          student_id: linkModal.userId,
          section_id: Number(selectedSection),
        });
      }
      setLinkModal(null);
      setSelectedSection('');
      await load();
    });
  }

  async function handleUnlinkSection(type, userId, sectionId, label) {
    if (!window.confirm(`Unassign from ${label}?`)) return;
    await task.run(async () => {
      if (type === 'teacher') {
        await api.delete(`/teacher-assignments/${userId}/${sectionId}`);
      } else {
        await api.delete(`/enrolments/${userId}/${sectionId}`);
      }
      await load();
    });
  }

  // Section Roster Inspection & Modification
  async function openSectionRoster(sec) {
    setRosterModal({ section: sec, data: null, loading: true });
    setRosterStudentId('');
    setRosterActionError('');
    try {
      const res = await api.get(`/sections/${sec.id}/roster`);
      setRosterModal({ section: sec, data: res.data, loading: false });
    } catch (err) {
      setRosterActionError(err.response?.data?.detail || err.message || 'Failed to load roster');
      setRosterModal({ section: sec, data: null, loading: false });
    }
  }

  async function handleAddStudentToRoster(e) {
    e.preventDefault();
    if (!rosterStudentId || !rosterModal?.section) return;
    setRosterActionError('');
    try {
      await api.post('/enrolments', {
        student_id: Number(rosterStudentId),
        section_id: rosterModal.section.id,
      });
      setRosterStudentId('');
      const res = await api.get(`/sections/${rosterModal.section.id}/roster`);
      setRosterModal(prev => ({ ...prev, data: res.data }));
      await load();
    } catch (err) {
      setRosterActionError(err.response?.data?.detail || err.message || 'Failed to enrol student');
    }
  }

  async function handleRemoveStudentFromRoster(studentId, studentName) {
    if (!window.confirm(`Unenrol ${studentName} from this section?`)) return;
    setRosterActionError('');
    try {
      await api.delete(`/enrolments/${studentId}/${rosterModal.section.id}`);
      const res = await api.get(`/sections/${rosterModal.section.id}/roster`);
      setRosterModal(prev => ({ ...prev, data: res.data }));
      await load();
    } catch (err) {
      setRosterActionError(err.response?.data?.detail || err.message || 'Failed to remove student');
    }
  }

  // Course & Section Management Actions
  function openAddAcademic(type) {
    if (type === 'course') {
      setAcademicForm({ code: '', title: '' });
    } else {
      setAcademicForm({
        course_id: courses[0]?.id ? String(courses[0].id) : '',
        name: '',
        room: '',
      });
    }
    setAcademicModal({ mode: 'add', type });
  }

  function openEditAcademic(type, item) {
    if (type === 'course') {
      setAcademicForm({ code: item.code, title: item.title });
    } else {
      setAcademicForm({
        course_id: String(item.course_id),
        name: item.name,
        room: item.room || '',
      });
    }
    setAcademicModal({ mode: 'edit', type, data: item });
  }

  async function handleSaveAcademic(e) {
    e.preventDefault();
    await task.run(async () => {
      if (academicModal.type === 'course') {
        const payload = {
          code: academicForm.code.trim(),
          title: academicForm.title.trim(),
        };
        if (academicModal.mode === 'edit') {
          await api.put(`/courses/${academicModal.data.id}`, payload);
        } else {
          await api.post('/courses', payload);
        }
      } else {
        const payload = {
          course_id: Number(academicForm.course_id),
          name: academicForm.name.trim(),
          room: academicForm.room ? academicForm.room.trim() : null,
        };
        if (academicModal.mode === 'edit') {
          await api.put(`/sections/${academicModal.data.id}`, payload);
        } else {
          await api.post('/sections', payload);
        }
      }
      setAcademicModal(null);
      await load();
    });
  }

  async function handleDeleteAcademic(type, id, label) {
    if (
      !window.confirm(
        `Delete ${type} "${label}"? Historical sessions, attendance logs, or rosters will prevent deletion.`
      )
    ) {
      return;
    }
    await task.run(async () => {
      await api.delete(`/${type}s/${id}`);
      await load();
    });
  }

  // Settings Action
  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsSaved(false);
    await task.run(async () => {
      await api.put('/settings', {
        verification_threshold: Number(settings.verification_threshold),
        review_threshold: Number(settings.review_threshold),
        attendance_limit: Number(settings.attendance_limit),
      });
      setSettingsSaved(true);
      await load();
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Heading */}
      <Heading
        title="System Administration"
        detail="Institutional Governance · User Management, Registration Approvals, Academic Rosters & Recognition Policies"
      />

      <ErrorBox error={task.error} retry={load} />

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => {
            setTab('requests');
            setSearch('');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'requests'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Registration Requests
          {pendingRequests.length > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-400 text-amber-950 px-1.5 py-0.2 text-[10px] font-bold">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('teachers');
            setSearch('');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'teachers'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Faculty Teachers ({teachers.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('students');
            setSearch('');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'students'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Enrolled Students ({students.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('admins');
            setSearch('');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'admins'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          System Admins ({admins.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('academics');
            setSearch('');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'academics'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Courses & Sections ({courses.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('settings');
            setSearch('');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'settings'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Recognition Settings
        </button>
      </div>

      {/* ================= TAB 1: REGISTRATION REQUESTS ================= */}
      {tab === 'requests' && (
        <section className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Registration Applications & Institutional Verification
                </h2>
                <p className="text-xs text-slate-500">
                  Review self-registered applicants. Identity must be verified against institutional rosters or physical credentials before granting portal access.
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-500 font-medium mr-1">Status:</span>
                {['all', 'pending', 'approved', 'rejected', 'suspended'].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRequestFilter(st)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold capitalize transition ${
                      requestFilter === st
                        ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                placeholder="Search applicants by name, email, student code, staff ID, or department..."
                className="text-xs max-w-md"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className="text-xs text-slate-400">
                Showing {filteredRequests.length} of {requests.length} applications
              </span>
            </div>

            {loading ? (
              <SkeletonLoader count={3} />
            ) : filteredRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Requested Role</th>
                      <th>Institutional Identifier</th>
                      <th>Academic Department</th>
                      <th>Application Status</th>
                      <th>Submitted Date</th>
                      <th className="text-right">Administrative Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td>
                          <div className="font-bold text-slate-900">{r.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.email}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Email verification planned in future release
                          </div>
                        </td>
                        <td>
                          <Badge variant={r.role === 'teacher' ? 'info' : 'live'}>
                            {r.role?.toUpperCase()}
                          </Badge>
                        </td>
                        <td>
                          <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            {r.student_code || r.staff_id || 'None Provided'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-700">
                          <div>{r.department || '—'}</div>
                          {r.batch && <div className="text-[11px] text-slate-400">Batch {r.batch}</div>}
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            <Badge
                              variant={
                                r.status === 'approved'
                                  ? 'live'
                                  : r.status === 'pending'
                                  ? 'review'
                                  : r.status === 'suspended'
                                  ? 'expired'
                                  : 'danger'
                              }
                            >
                              {r.status?.toUpperCase()}
                            </Badge>
                            {r.verified_method && (
                              <div className="text-[10px] text-slate-500">
                                Method: {r.verified_method.replace(/_/g, ' ')}
                              </div>
                            )}
                            {r.rejection_reason && (
                              <div className="text-[11px] text-rose-700 max-w-xs truncate" title={r.rejection_reason}>
                                Reason: {r.rejection_reason}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-slate-500 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {r.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="btn text-xs py-1 px-3 bg-emerald-700 hover:bg-emerald-800 text-white"
                                  onClick={() => {
                                    setApprovalModal({ user: r });
                                    setApprovalMethod('institutional_roster');
                                  }}
                                >
                                  Verify & Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn text-xs py-1 px-2.5 bg-rose-700 hover:bg-rose-800 text-white"
                                  onClick={() => {
                                    setRejectionModal({ user: r });
                                    setRejectionReason('');
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {r.status === 'approved' && (
                              <>
                                <button
                                  type="button"
                                  className="btn text-xs py-1 px-2.5 bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
                                  onClick={() => {
                                    setLinkModal({ type: r.role, userId: r.id, name: r.name });
                                    setSelectedSection('');
                                  }}
                                >
                                  {r.role === 'teacher' ? '+ Assign Section' : '+ Enrol in Section'}
                                </button>
                                <button
                                  type="button"
                                  className="btn secondary text-xs py-1 px-2.5 hover:border-amber-400 hover:text-amber-900"
                                  onClick={() => {
                                    setSuspensionModal({ user: r });
                                    setSuspensionReason('');
                                  }}
                                >
                                  Suspend Access
                                </button>
                              </>
                            )}
                            {r.status === 'suspended' && (
                              <button
                                type="button"
                                className="btn text-xs py-1 px-2.5 bg-amber-700 hover:bg-amber-800 text-white"
                                onClick={() => handleUnsuspend(r.id)}
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No applications found" children="No registration requests match the selected filter." />
            )}
          </div>

          {/* APPLICATION AUDIT TRAIL */}
          <section className="card space-y-3">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-bold text-slate-900">Verification Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Immutable chronological log of all administrative identity verification decisions and rationale.
              </p>
            </div>

            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Candidate</th>
                      <th>Role</th>
                      <th>Decision</th>
                      <th>Admin Actor</th>
                      <th>Verification Method / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="text-xs text-slate-500 whitespace-nowrap">
                          {h.created_at ? new Date(h.created_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          <div className="font-semibold text-slate-800">{h.candidate_name}</div>
                          <div className="text-xs text-slate-400 font-mono">{h.candidate_email}</div>
                        </td>
                        <td>
                          <Badge variant="neutral">{h.candidate_role?.toUpperCase()}</Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              h.action === 'approved'
                                ? 'live'
                                : h.action === 'rejected'
                                ? 'danger'
                                : 'expired'
                            }
                          >
                            {h.action?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="text-xs text-slate-700 font-medium">{h.actor_name}</td>
                        <td className="text-xs text-slate-600">
                          {h.verification_method && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] mr-1 text-slate-700 border border-slate-200">
                              {h.verification_method}
                            </span>
                          )}
                          <span>{h.reason || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty children="No verification audit records found." />
            )}
          </section>
        </section>
      )}

      {/* ================= TAB 2: FACULTY TEACHERS ================= */}
      {tab === 'teachers' && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Faculty Teacher Accounts</h2>
              <p className="text-xs text-slate-500">
                Assigned teachers can open attendance windows, inspect student review photos, and issue 30-second QR check-ins.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search teacher by name, email, or staff ID..."
                className="text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn text-xs py-2 px-3.5 shadow-sm whitespace-nowrap"
                onClick={() => openAddUser('teacher')}
              >
                + Add Teacher
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredTeachers.length} of {teachers.length} faculty teachers</span>
          </div>

          {loading ? (
            <SkeletonLoader count={3} />
          ) : filteredTeachers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Teacher Name</th>
                    <th>Email Address</th>
                    <th>Staff / Faculty ID</th>
                    <th>Department</th>
                    <th>Assigned Sections</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.map(t => {
                    const secList = getTeacherSections(t.id);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="font-bold text-slate-900">{t.name}</td>
                        <td className="text-xs font-mono text-slate-600">{t.email}</td>
                        <td>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {t.staff_id || '—'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-600">{t.department || '—'}</td>
                        <td>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {secList.map(s => (
                              <span
                                key={s.section_id}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 border border-slate-200"
                              >
                                {s.label}
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkSection('teacher', t.id, s.section_id, s.label)}
                                  className="text-slate-400 hover:text-rose-700 ml-0.5"
                                  title="Unassign section"
                                  aria-label={`Unassign ${s.label}`}
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setLinkModal({ type: 'teacher', userId: t.id, name: t.name });
                                setSelectedSection('');
                              }}
                              className="text-xs text-emerald-700 font-bold hover:underline ml-1"
                            >
                              + Assign
                            </button>
                          </div>
                        </td>
                        <td>
                          <Badge variant={t.status === 'suspended' ? 'expired' : 'live'}>
                            {t.status?.toUpperCase() || 'APPROVED'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUser(t)}
                              className="btn secondary text-xs py-1 px-2.5"
                            >
                              Edit
                            </button>
                            {t.status === 'suspended' ? (
                              <button
                                type="button"
                                onClick={() => handleUnsuspend(t.id)}
                                className="btn text-xs py-1 px-2 bg-amber-700 hover:bg-amber-800 text-white"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSuspensionModal({ user: t });
                                  setSuspensionReason('');
                                }}
                                className="btn secondary text-xs py-1 px-2 hover:border-amber-300 hover:text-amber-900"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(t.id, t.name)}
                              className="btn danger text-xs py-1 px-2.5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No teachers found" children="No faculty teacher records match your search." />
          )}
        </section>
      )}

      {/* ================= TAB 3: ENROLLED STUDENTS ================= */}
      {tab === 'students' && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Enrolled Student Accounts</h2>
              <p className="text-xs text-slate-500">
                Enrolled students can participate in 2-factor QR attendance check-in and review their attendance percentage.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search students by name, email, code, or department..."
                className="text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn text-xs py-2 px-3.5 shadow-sm whitespace-nowrap"
                onClick={() => openAddUser('student')}
              >
                + Add Student
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredStudents.length} of {students.length} students</span>
          </div>

          {loading ? (
            <SkeletonLoader count={3} />
          ) : filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email Address</th>
                    <th>Student ID / Code</th>
                    <th>Department / Batch</th>
                    <th>Face Enrolment</th>
                    <th>Enrolled Sections</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(s => {
                    const secList = getStudentSections(s.id);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="font-bold text-slate-900">{s.name}</td>
                        <td className="text-xs font-mono text-slate-600">{s.email}</td>
                        <td>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {s.student_code || '—'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-600">
                          <div>{s.department || '—'}</div>
                          {s.batch && <div className="text-[11px] text-slate-400">Batch {s.batch}</div>}
                        </td>
                        <td>
                          {s.biometric_enrolled ? (
                            <Badge variant="live">ENROLLED (5/5)</Badge>
                          ) : s.biometric_samples > 0 ? (
                            <Badge variant="review">{s.biometric_samples}/5 SAMPLES</Badge>
                          ) : (
                            <Badge variant="neutral">NOT ENROLLED</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {secList.map(sec => (
                              <span
                                key={sec.section_id}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 border border-slate-200"
                              >
                                {sec.label}
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkSection('student', s.id, sec.section_id, sec.label)}
                                  className="text-slate-400 hover:text-rose-700 ml-0.5"
                                  title="Unenrol from section"
                                  aria-label={`Unenrol from ${sec.label}`}
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setLinkModal({ type: 'student', userId: s.id, name: s.name });
                                setSelectedSection('');
                              }}
                              className="text-xs text-emerald-700 font-bold hover:underline ml-1"
                            >
                              + Enrol
                            </button>
                          </div>
                        </td>
                        <td>
                          <Badge variant={s.status === 'suspended' ? 'expired' : 'live'}>
                            {s.status?.toUpperCase() || 'APPROVED'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUser(s)}
                              className="btn secondary text-xs py-1 px-2.5"
                            >
                              Edit
                            </button>
                            {s.status === 'suspended' ? (
                              <button
                                type="button"
                                onClick={() => handleUnsuspend(s.id)}
                                className="btn text-xs py-1 px-2 bg-amber-700 hover:bg-amber-800 text-white"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSuspensionModal({ user: s });
                                  setSuspensionReason('');
                                }}
                                className="btn secondary text-xs py-1 px-2 hover:border-amber-300 hover:text-amber-900"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(s.id, s.name)}
                              className="btn danger text-xs py-1 px-2.5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No students found" children="No student records match your search." />
          )}
        </section>
      )}

      {/* ================= TAB 4: SYSTEM ADMINISTRATORS ================= */}
      {tab === 'admins' && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">System Administrators</h2>
              <p className="text-xs text-slate-500">
                Institutional administrators with authority to manage rosters, configure recognition thresholds, and inspect audit trails.
              </p>
            </div>
            <button
              type="button"
              className="btn text-xs py-2 px-3.5 shadow-sm"
              onClick={() => openAddUser('admin')}
            >
              + Add Administrator
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th>Administrator Name</th>
                  <th>Email Address</th>
                  <th>Privilege Level</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdmins.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="font-bold text-slate-900">{a.name}</td>
                    <td className="text-xs font-mono text-slate-600">{a.email}</td>
                    <td>
                      <Badge variant="info">FULL ADMIN</Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditUser(a)}
                          className="btn secondary text-xs py-1 px-2.5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={admins.length <= 1}
                          onClick={() => handleDeleteUser(a.id, a.name)}
                          className="btn danger text-xs py-1 px-2.5"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= TAB 5: COURSES & SECTIONS ================= */}
      {tab === 'academics' && (
        <div className="space-y-6">
          {/* Courses Catalog Card */}
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Course Catalog</h2>
                <p className="text-xs text-slate-500">
                  Institutional academic courses offering scheduled lecture sections.
                </p>
              </div>
              <button
                type="button"
                className="btn text-xs py-2 px-3.5 shadow-sm"
                onClick={() => openAddAcademic('course')}
              >
                + Add Course
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Active Sections</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCourses.map(c => {
                    const secCount = sections.filter(s => s.course_id === c.id).length;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td>
                          <span className="font-mono font-bold text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-200">
                            {c.code}
                          </span>
                        </td>
                        <td className="font-bold text-slate-900">{c.title}</td>
                        <td>
                          <span className="text-xs font-semibold text-slate-600">
                            {secCount} section{secCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAcademicForm({ course_id: String(c.id), name: '' });
                                setAcademicModal({ mode: 'add', type: 'section' });
                              }}
                              className="btn text-xs py-1 px-2.5 bg-teal-700 text-white hover:bg-teal-800"
                            >
                              + Add Section
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditAcademic('course', c)}
                              className="btn secondary text-xs py-1 px-2.5"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAcademic('course', c.id, c.code)}
                              className="btn danger text-xs py-1 px-2.5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sections Offerings Card */}
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Classroom Sections & Rosters</h2>
                <p className="text-xs text-slate-500">
                  Distinct section offerings with assigned faculty and student enrollments.
                </p>
              </div>
              <button
                type="button"
                className="btn text-xs py-2 px-3.5 shadow-sm"
                onClick={() => openAddAcademic('section')}
              >
                + Add Section
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Section Identifier</th>
                    <th>Course Code & Title</th>
                    <th>Room / Location</th>
                    <th>Assigned Faculty</th>
                    <th>Enrolled Students</th>
                    <th>Roster Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sections.map(s => {
                    const assignedTeachers = assignments
                      .filter(a => a.section_id === s.id)
                      .map(a => users.find(u => u.id === a.teacher_id)?.name || `Teacher #${a.teacher_id}`);
                    const studentCount = enrolments.filter(e => e.section_id === s.id).length;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td>
                          <span className="font-bold text-slate-900">{s.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono ml-2">(ID: {s.id})</span>
                        </td>
                        <td>
                          <span className="font-mono text-xs font-semibold text-emerald-900 mr-2">
                            {s.course_code}
                          </span>
                          <span className="text-xs text-slate-600">{s.course_title}</span>
                        </td>
                        <td>
                          {s.room ? (
                            <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                              {s.room}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td>
                          {assignedTeachers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedTeachers.map((tName, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                                >
                                  {tName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-700 italic">No faculty assigned</span>
                          )}
                        </td>
                        <td>
                          <span className="text-xs font-semibold text-slate-700">
                            {studentCount} student{studentCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          {s.roster_frozen ? (
                            <Badge variant="review">ROSTER FROZEN</Badge>
                          ) : (
                            <Badge variant="live">ACTIVE</Badge>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openSectionRoster(s)}
                              className="btn text-xs py-1 px-2.5 bg-teal-700 hover:bg-teal-800 text-white"
                            >
                              View Roster
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditAcademic('section', s)}
                              className="btn secondary text-xs py-1 px-2.5"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAcademic('section', s.id, s.name)}
                              className="btn danger text-xs py-1 px-2.5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ================= TAB 6: RECOGNITION SETTINGS ================= */}
      {tab === 'settings' && settings && (
        <section className="card space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Attendance Limits & Biometric Recognition Policies
            </h2>
            <p className="text-xs text-slate-500">
              Calibrate mathematical tolerances enforced by backend CPU neural recognition and liveness verification.
            </p>
          </div>

          {settingsSaved && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-950 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 shrink-0 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Recognition policies updated and applied system-wide.
              </span>
              <button
                type="button"
                onClick={() => setSettingsSaved(false)}
                className="text-emerald-700 hover:text-emerald-900 p-0.5"
                aria-label="Dismiss notification"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
            <div className="space-y-4">
              <Field
                title="Verification Threshold (0.00 – 1.00)"
                hint="Cosine similarity match floor"
                required
              >
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  max="0.99"
                  required
                  value={settings.verification_threshold ?? ''}
                  onChange={e =>
                    setSettings({ ...settings, verification_threshold: e.target.value })
                  }
                  className="font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Minimum cosine similarity score required to automatically mark a student present.
                  Higher thresholds require closer geometric vector alignment. Cosine scores (0.00–1.00) reflect vector orientation, not classification accuracy.
                </p>
              </Field>

              <Field
                title="Review Ambiguity Threshold (0.00 – 1.00)"
                hint="Review queue floor"
                required
              >
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  max="0.99"
                  required
                  value={settings.review_threshold ?? ''}
                  onChange={e =>
                    setSettings({ ...settings, review_threshold: e.target.value })
                  }
                  className="font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Faces scoring between the review threshold and verification threshold are routed to the instructor's Review Queue for human confirmation.
                  Faces below this score are classified as unknown.
                </p>
              </Field>

              <Field
                title="Attendance Compliance Limit (%)"
                hint="Institutional policy floor"
                required
              >
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={settings.attendance_limit ?? ''}
                  onChange={e =>
                    setSettings({ ...settings, attendance_limit: e.target.value })
                  }
                  className="font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Minimum required attendance percentage across closed class sessions.
                  Students whose attendance percentage falls below this threshold receive warning alerts and are flagged for institutional review.
                </p>
              </Field>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Server-side validated on submission.
              </span>
              <button
                type="submit"
                disabled={task.busy}
                className="btn text-xs py-2 px-5 shadow-sm font-bold"
              >
                {task.busy ? 'Saving Policies...' : 'Save Recognition Policies'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ================= MODAL: USER ADD / EDIT ================= */}
      {userModal && (
        <Modal
          open={Boolean(userModal)}
          title={
            userModal.mode === 'add'
              ? `Create New ${userModal.role?.toUpperCase()} Account`
              : `Edit ${userModal.data.name}`
          }
          description="Manage institutional credentials. Password changes take effect immediately."
          onClose={() => setUserModal(null)}
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <Field title="Full Legal Name" required>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Sarah Rahman"
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
              />
            </Field>

            <Field title="Email Address" required>
              <input
                type="email"
                required
                placeholder="e.g. s.rahman@university.edu"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
              />
            </Field>

            {userModal.role === 'student' && (
              <Field title="Student ID or Code" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-CSE-042"
                  value={userForm.student_code}
                  onChange={e => setUserForm({ ...userForm, student_code: e.target.value })}
                  className="font-mono"
                />
              </Field>
            )}

            {userModal.role === 'teacher' && (
              <Field title="Faculty / Staff ID" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. FAC-CSE-101"
                  value={userForm.staff_id}
                  onChange={e => setUserForm({ ...userForm, staff_id: e.target.value })}
                  className="font-mono"
                />
              </Field>
            )}

            <Field title="Academic Department">
              <input
                type="text"
                placeholder="e.g. Computer Science & Engineering"
                value={userForm.department}
                onChange={e => setUserForm({ ...userForm, department: e.target.value })}
              />
            </Field>

            {userModal.role === 'student' && (
              <Field title="Batch / Cohort">
                <input
                  type="text"
                  placeholder="e.g. 52nd Batch"
                  value={userForm.batch}
                  onChange={e => setUserForm({ ...userForm, batch: e.target.value })}
                />
              </Field>
            )}

            <Field
              title={
                userModal.mode === 'add'
                  ? 'Password (minimum 10 characters)'
                  : 'Change Password (leave empty to keep unchanged)'
              }
              required={userModal.mode === 'add'}
            >
              <input
                type="password"
                required={userModal.mode === 'add'}
                minLength={10}
                placeholder={userModal.mode === 'add' ? 'At least 10 characters' : '••••••••••••'}
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setUserModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={task.busy}
                className="btn text-xs py-2 px-4"
              >
                {userModal.mode === 'add' ? 'Create Account' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: LINK SECTION ================= */}
      {linkModal && (
        <Modal
          open={Boolean(linkModal)}
          title={
            linkModal.type === 'teacher'
              ? `Assign Section to ${linkModal.name}`
              : `Enrol ${linkModal.name} in Section`
          }
          description="Link an academic section to this account."
          onClose={() => setLinkModal(null)}
        >
          <form onSubmit={handleAssignSection} className="space-y-4">
            <Field title="Select Course Section" required>
              <select
                required
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
              >
                <option value="">Choose an available section...</option>
                {sections.map(s => {
                  const isBlocked = linkModal.type === 'student' && s.roster_frozen;
                  return (
                    <option key={s.id} value={s.id} disabled={isBlocked}>
                      {s.course_code} · {s.name} {s.room ? `(${s.room})` : ''} {isBlocked ? '— [ROSTER FROZEN]' : ''}
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setLinkModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedSection || task.busy}
                className="btn text-xs py-2 px-4"
              >
                Confirm Link
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ACADEMIC (COURSE / SECTION) ================= */}
      {academicModal && (
        <Modal
          open={Boolean(academicModal)}
          title={
            academicModal.mode === 'add'
              ? `Add New ${academicModal.type === 'course' ? 'Course' : 'Section'}`
              : `Edit ${academicModal.type === 'course' ? 'Course' : 'Section'}`
          }
          description="Configure institutional academic offerings."
          onClose={() => setAcademicModal(null)}
        >
          <form onSubmit={handleSaveAcademic} className="space-y-4">
            {academicModal.type === 'course' ? (
              <>
                <Field title="Course Catalog Code" hint="e.g. CSE-3205" required>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE-3205"
                    className="font-mono"
                    value={academicForm.code || ''}
                    onChange={e => setAcademicForm({ ...academicForm, code: e.target.value })}
                  />
                </Field>

                <Field title="Course Title" hint="Official catalog title" required>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Vision & Neural Systems"
                    value={academicForm.title || ''}
                    onChange={e => setAcademicForm({ ...academicForm, title: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <>
                {academicModal.mode === 'edit' && academicModal.data?.roster_frozen && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 font-medium">
                    <strong>Roster is Frozen:</strong> Historical class sessions exist. You can safely rename the section and change the room, but changing the parent course is restricted.
                  </div>
                )}

                <Field title="Parent Course" required>
                  <select
                    required
                    disabled={academicModal.mode === 'edit' && academicModal.data?.roster_frozen}
                    value={academicForm.course_id || ''}
                    onChange={e => setAcademicForm({ ...academicForm, course_id: e.target.value })}
                  >
                    <option value="">Select parent course...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.title}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field title="Section Name" hint="e.g. Section A" required>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Section A"
                    value={academicForm.name || ''}
                    onChange={e => setAcademicForm({ ...academicForm, name: e.target.value })}
                  />
                </Field>

                <Field title="Room / Location" hint="Default classroom location (optional, e.g. Room 402, Lab 3)">
                  <input
                    type="text"
                    placeholder="e.g. Room 402"
                    value={academicForm.room || ''}
                    onChange={e => setAcademicForm({ ...academicForm, room: e.target.value })}
                  />
                </Field>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setAcademicModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={task.busy}
                className="btn text-xs py-2 px-4"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: APPLICATION APPROVAL ================= */}
      {approvalModal && (
        <Modal
          open={Boolean(approvalModal)}
          title={`Verify & Approve: ${approvalModal.user.name}`}
          description="Administrative roster cross-check is required before granting access."
          onClose={() => setApprovalModal(null)}
        >
          <form onSubmit={handleApprove} className="space-y-4">
            <div className="text-xs text-slate-700 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div><span className="font-semibold text-slate-500">Applicant:</span> {approvalModal.user.name} ({approvalModal.user.email})</div>
              <div><span className="font-semibold text-slate-500">Requested Role:</span> {approvalModal.user.role?.toUpperCase()}</div>
              <div><span className="font-semibold text-slate-500">Submitted ID:</span> {approvalModal.user.student_code || approvalModal.user.staff_id || 'None'}</div>
              <div><span className="font-semibold text-slate-500">Department:</span> {approvalModal.user.department || '—'}</div>
            </div>

            <Field title="Identity Verification Method" required>
              <select
                required
                value={approvalMethod}
                onChange={e => setApprovalMethod(e.target.value)}
              >
                <option value="institutional_roster">Official Institutional Roster Cross-check</option>
                <option value="in_person_id">In-Person University ID Physical Inspection</option>
                <option value="department_records">Departmental HR / Dean Certified Records</option>
              </select>
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setApprovalModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={task.busy}
                className="btn bg-emerald-700 hover:bg-emerald-800 text-white text-xs py-2 px-4"
              >
                Confirm Verification & Approve
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: APPLICATION REJECTION ================= */}
      {rejectionModal && (
        <Modal
          open={Boolean(rejectionModal)}
          title={`Reject Application: ${rejectionModal.user.name}`}
          description="The applicant will see this reason upon attempting sign-in."
          onClose={() => setRejectionModal(null)}
        >
          <form onSubmit={handleReject} className="space-y-4">
            <Field title="Mandatory Rejection Reason" hint="Min 3 characters" required>
              <textarea
                required
                minLength={3}
                rows={3}
                placeholder="e.g. Student ID does not match registrar records for department CSE."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setRejectionModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejectionReason.trim().length < 3 || task.busy}
                className="btn danger text-xs py-2 px-4"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ACCOUNT SUSPENSION ================= */}
      {suspensionModal && (
        <Modal
          open={Boolean(suspensionModal)}
          title={`Suspend Account: ${suspensionModal.user.name}`}
          description="Active tokens will be invalidated immediately on next request."
          onClose={() => setSuspensionModal(null)}
        >
          <form onSubmit={handleSuspend} className="space-y-4">
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <p className="font-bold">Immediate Invalidation Notice:</p>
              <p>Suspending this user blocks all portal access and immediately rejects existing JWT access tokens.</p>
            </div>

            <Field title="Mandatory Suspension Reason" hint="Min 3 characters" required>
              <textarea
                required
                minLength={3}
                rows={3}
                placeholder="e.g. Account suspended pending academic integrity inquiry."
                value={suspensionReason}
                onChange={e => setSuspensionReason(e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setSuspensionModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={suspensionReason.trim().length < 3 || task.busy}
                className="btn bg-amber-700 hover:bg-amber-800 text-white text-xs py-2 px-4"
              >
                Confirm Suspension
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* ================= MODAL: SECTION ROSTER ================= */}
      {rosterModal && (
        <Modal
          open={Boolean(rosterModal)}
          title={`${rosterModal.section?.course_code || 'Course'} · ${rosterModal.section?.name || 'Section'} — Class Roster`}
          description={`Classroom Location: ${rosterModal.section?.room || 'None assigned'} · Section ID #${rosterModal.section?.id}`}
          onClose={() => setRosterModal(null)}
        >
          <div className="space-y-4">
            {rosterActionError && (
              <ErrorBox error={rosterActionError} />
            )}

            {rosterModal.data?.roster_frozen && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 font-medium space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <svg className="h-4 w-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Roster is Frozen
                </div>
                <p>
                  Historical class sessions have been recorded for this section. Enrolment modifications are locked to preserve historical attendance records. To enrol different students, please create a new section.
                </p>
              </div>
            )}

            {/* Quick Enrol Student form (only if not frozen) */}
            {!rosterModal.data?.roster_frozen && (
              <form onSubmit={handleAddStudentToRoster} className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enrol Approved Student into Section
                  </label>
                  <select
                    required
                    value={rosterStudentId}
                    onChange={e => setRosterStudentId(e.target.value)}
                    className="text-xs"
                  >
                    <option value="">Select student...</option>
                    {students
                      .filter(s => s.status === 'approved' && !rosterModal.data?.students?.some(en => en.id === s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.student_code || s.email}) {s.biometric_enrolled ? '· Face Ready' : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!rosterStudentId}
                  className="btn text-xs py-2 px-3.5 bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
                >
                  + Enrol Student
                </button>
              </form>
            )}

            {/* Enrolled Students Table */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold text-slate-700">
                  Enrolled Students ({rosterModal.data?.students?.length || 0})
                </span>
              </div>

              {rosterModal.loading ? (
                <SkeletonLoader count={2} />
              ) : rosterModal.data?.students?.length > 0 ? (
                <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3">Student Code</th>
                        <th className="py-2 px-3">Face Enrolment</th>
                        <th className="py-2 px-3">Status</th>
                        {!rosterModal.data?.roster_frozen && <th className="py-2 px-3 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rosterModal.data.students.map(st => (
                        <tr key={st.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            <div>{st.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{st.email}</div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">{st.student_code || '—'}</td>
                          <td className="py-2 px-3">
                            {st.biometric_enrolled ? (
                              <Badge variant="live">ENROLLED (5/5)</Badge>
                            ) : st.biometric_samples > 0 ? (
                              <Badge variant="review">{st.biometric_samples}/5 SAMPLES</Badge>
                            ) : (
                              <Badge variant="neutral">NOT ENROLLED</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant={st.status === 'approved' ? 'live' : 'expired'}>
                              {st.status?.toUpperCase()}
                            </Badge>
                          </td>
                          {!rosterModal.data?.roster_frozen && (
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveStudentFromRoster(st.id, st.name)}
                                className="text-xs text-rose-700 hover:text-rose-900 font-semibold"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                  No students are enrolled in this section yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn secondary text-xs py-2 px-4"
                onClick={() => setRosterModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
