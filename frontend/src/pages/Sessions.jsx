import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  Heading,
  ErrorBox,
  Field,
  Empty,
  useTask,
  Badge,
  Modal,
  SearchInput,
  SkeletonLoader,
} from '../components/UI';

function localTime(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function Sessions() {
  const task = useTask();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    section_id: '',
    room: '',
    starts_at: localTime(new Date()),
    ends_at: localTime(new Date(Date.now() + 3600000)),
    require_qr: true,
  });

  function openNewSessionModal() {
    const defaultSec = sections[0];
    setForm({
      section_id: defaultSec?.id ? String(defaultSec.id) : '',
      room: defaultSec?.room || '',
      starts_at: localTime(new Date()),
      ends_at: localTime(new Date(Date.now() + 3600000)),
      require_qr: true,
    });
    setShowModal(true);
  }

  function handleSectionChange(secId) {
    const matched = sections.find(s => String(s.id) === String(secId));
    setForm(prev => ({
      ...prev,
      section_id: secId,
      room: matched?.room || prev.room,
    }));
  }

  async function load() {
    setLoading(true);
    await task.run(async () => {
      const [r, s] = await Promise.all([
        api.get('/sessions').catch(() => ({ data: [] })),
        api.get('/sections').catch(() => ({ data: [] })),
      ]);
      setRows(r.data || []);
      setSections(s.data || []);
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function field(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const now = new Date();

  const filteredSessions = rows.filter(row => {
    const isExpired = row.status === 'open' && new Date(row.ends_at) < now;
    const isLive = row.status === 'open' && !isExpired;

    if (filterSection && String(row.section_id) !== String(filterSection)) return false;
    if (filterStatus === 'live' && !isLive) return false;
    if (filterStatus === 'expired' && !isExpired) return false;
    if (filterStatus === 'closed' && row.status !== 'closed') return false;

    if (search.trim()) {
      const sec = sections.find(s => s.id === row.section_id);
      const query = search.toLowerCase();
      const matchCourse = sec?.course_code?.toLowerCase().includes(query);
      const matchName = sec?.name?.toLowerCase().includes(query);
      const matchId = String(row.id).includes(query);
      if (!matchCourse && !matchName && !matchId) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <Heading
        title="Classroom Sessions Directory"
        detail="Open, monitor, capture, and finalize attendance across your course sections."
      >
        <button
          type="button"
          onClick={openNewSessionModal}
          className="btn text-xs py-2 px-4 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          + New Session
        </button>
      </Heading>

      <ErrorBox error={task.error} retry={load} />

      {/* Filter and Search Toolbar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by course or section..."
            className="w-full sm:w-64"
          />

          <select
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
            className="w-auto text-xs py-2 px-3 rounded-xl border border-slate-300"
          >
            <option value="">All Course Sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {s.course_code} · {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-auto text-xs py-2 px-3 rounded-xl border border-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="live">Live Now</option>
            <option value="expired">Time Expired</option>
            <option value="closed">Closed / Finalized</option>
          </select>
        </div>

        <span className="text-xs font-medium text-slate-500">
          Showing {filteredSessions.length} of {rows.length} session{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Session Cards Grid */}
      {loading ? (
        <SkeletonLoader count={3} />
      ) : filteredSessions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map(row => {
            const sec = sections.find(s => s.id === row.section_id);
            const isExpired = row.status === 'open' && new Date(row.ends_at) < now;
            const isLive = row.status === 'open' && !isExpired;

            return (
              <Link
                key={row.id}
                to={`/teacher/sessions/${row.id}`}
                className={`card card-hover flex flex-col justify-between space-y-4 ${
                  isLive ? 'border-teal-300 bg-teal-50/15 ring-1 ring-teal-500/10' : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="badge badge-info font-mono font-bold">
                      {sec?.course_code || 'COURSE'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isLive && (
                        <Badge variant="live">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          LIVE NOW
                        </Badge>
                      )}
                      {isExpired && <Badge variant="expired">EXPIRED</Badge>}
                      {row.status === 'closed' && <Badge variant="closed">CLOSED</Badge>}
                      {row.is_demo && <Badge variant="demo">DEMO</Badge>}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {sec?.name || `Section #${row.section_id}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Session ID #{row.id} · Section #{row.section_id}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="space-y-1 text-slate-600">
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">Date:</span>
                      <span className="font-medium text-slate-800">
                        {new Date(row.starts_at).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">Time:</span>
                      <span className="font-medium text-slate-800">
                        {new Date(row.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(row.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">Mode:</span>
                      <span className="font-medium text-slate-800">
                        {row.require_qr ? 'QR Code + Face Check-in' : 'Photo / Video Capture'}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">Classroom:</span>
                      <span className="font-medium text-slate-800">
                        {row.room || sec?.room || '—'}
                      </span>
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between font-semibold text-teal-800 group-hover:underline">
                    <span>{isLive ? 'Open Capture Workspace' : 'Inspect Session'}</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No sessions match your filter criteria"
          children="Adjust the filters or schedule a new attendance session."
        />
      )}

      {/* New Session Creation Modal */}
      <Modal
        open={showModal}
        title="Create New Class Session"
        description="Configure class timing and verification mode."
        onClose={() => setShowModal(false)}
      >
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            task.run(async () => {
              const res = await api.post('/sessions', {
                section_id: Number(form.section_id),
                starts_at: new Date(form.starts_at).toISOString(),
                ends_at: new Date(form.ends_at).toISOString(),
                require_qr: form.require_qr,
                room: form.room ? form.room.trim() : null,
              });
              setShowModal(false);
              navigate(`/teacher/sessions/${res.data.id}`);
            });
          }}
        >
          <Field title="Assigned Course Section" required>
            <select
              required
              value={form.section_id}
              onChange={e => handleSectionChange(e.target.value)}
            >
              <option value="">Select an assigned section...</option>
              {sections.map(s => (
                <option value={s.id} key={s.id}>
                  {s.course_code} · {s.name} {s.room ? `(${s.room})` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field title="Classroom / Room" hint="Defaulted from section; override if relocating">
            <input
              type="text"
              placeholder="e.g. Room 402"
              value={form.room || ''}
              onChange={e => field('room', e.target.value)}
            />
          </Field>

          <label className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs text-teal-950 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.require_qr}
              onChange={e => field('require_qr', e.target.checked)}
            />
            <div>
              <span className="font-bold">Require Rotating QR + Face Check-in</span>
              <p className="text-slate-600 mt-0.5">
                Students scan a live 30-second rotating QR token and complete a motion liveness test.
              </p>
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field title="Starts (Local Time)" required>
              <input
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={e => field('starts_at', e.target.value)}
              />
            </Field>

            <Field title="Ends (Local Time)" required>
              <input
                type="datetime-local"
                required
                value={form.ends_at}
                onChange={e => field('ends_at', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              className="btn secondary btn-sm text-xs"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={task.busy}
              className="btn btn-sm text-xs py-2 px-5"
            >
              {task.busy ? 'Creating…' : 'Create & Open Workspace →'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
