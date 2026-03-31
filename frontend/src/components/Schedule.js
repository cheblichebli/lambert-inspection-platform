import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { schedulesAPI, formsAPI, usersAPI } from '../api';
import { useNavigate } from 'react-router-dom';
import { X, PlayCircle } from 'lucide-react';

const localizer = momentLocalizer(moment);

const COLOURS = [
  { bg: '#4a9d5f', border: '#357a47' },
  { bg: '#3b82f6', border: '#1d4ed8' },
  { bg: '#d97706', border: '#b45309' },
  { bg: '#7c3aed', border: '#5b21b6' },
  { bg: '#dc2626', border: '#991b1b' },
  { bg: '#0891b2', border: '#0e7490' },
];

const getColour = (id) => COLOURS[id % COLOURS.length];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const buildEvents = (schedules) => {
  const events = [];
  schedules.forEach((s) => {
    const colour = getColour(s.id);
    if (s.frequency === 'once') {
      const d = new Date(s.start_date);
      events.push({ id: `${s.id}-once`, scheduleId: s.id, title: s.title, start: d, end: d, allDay: true, colour, schedule: s });
    } else if (s.frequency === 'daily' && s.end_date) {
      const start = new Date(s.start_date);
      const end = new Date(s.end_date);
      const cur = new Date(start);
      while (cur <= end) {
        events.push({ id: `${s.id}-${cur.toISOString()}`, scheduleId: s.id, title: s.title, start: new Date(cur), end: new Date(cur), allDay: true, colour, schedule: s });
        cur.setDate(cur.getDate() + 1);
      }
    }
  });
  return events;
};

const eventStyleGetter = (event) => ({
  style: {
    backgroundColor: event.colour.bg,
    borderLeft: `4px solid ${event.colour.border}`,
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.75rem',
    padding: '2px 6px',
    cursor: 'pointer',
  },
});

const Schedule = ({ user }) => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [forms, setForms] = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null); // tracks which schedule is being started
  const [calendarView, setCalendarView] = useState(Views.MONTH);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', form_template_id: '', assigned_to: '', frequency: 'once',
    start_date: '', end_date: '', location: '', equipment_id: '', notes: '',
  });

  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const isSupervisor = user && ['admin', 'supervisor'].includes(user.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const schedulesData = await schedulesAPI.getAll();
      setSchedules(schedulesData);
      if (isSupervisor) {
        const [formsData, usersData] = await Promise.all([formsAPI.getAll(null, true), usersAPI.getAll()]);
        setForms(formsData);
        setInspectors(usersData.filter(u => u.is_active));
      }
    } catch (err) {
      console.error('Failed to load schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupervisor]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Start Inspection ─────────────────────────────────────────────────────
  const handleStartInspection = async (schedule, e) => {
    e.stopPropagation();
    if (!schedule.form_template_id) {
      alert('This schedule has no form template assigned. Please ask your supervisor to assign a form template before starting.');
      return;
    }
    setStartingId(schedule.id);
    try {
      const result = await schedulesAPI.start(schedule.id);
      // Navigate to InspectionForm with pre-populated query params
      navigate(`/inspections/new?scheduleId=${result.scheduleId}&inspectionId=${result.inspectionId}&templateId=${result.templateId}${result.location ? `&location=${encodeURIComponent(result.location)}` : ''}${result.equipmentId ? `&equipmentId=${encodeURIComponent(result.equipmentId)}` : ''}${result.notes ? `&notes=${encodeURIComponent(result.notes)}` : ''}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start inspection. Please try again.');
    } finally {
      setStartingId(null);
    }
  };

  // ── Check if current user can start a schedule ───────────────────────────
  const canStart = (schedule) => {
    if (schedule.status === 'completed') return false;
    if (user?.role !== 'inspector') return false;
    return schedule.assigned_to === user?.id;
  };

  const openCreateModal = () => {
    setEditingSchedule(null);
    setForm({ title: '', form_template_id: '', assigned_to: '', frequency: 'once', start_date: '', end_date: '', location: '', equipment_id: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (schedule) => {
    setEditingSchedule(schedule);
    setForm({
      title: schedule.title || '', form_template_id: schedule.form_template_id || '',
      assigned_to: schedule.assigned_to || '', frequency: schedule.frequency || 'once',
      start_date: schedule.start_date ? schedule.start_date.split('T')[0] : '',
      end_date: schedule.end_date ? schedule.end_date.split('T')[0] : '',
      location: schedule.location || '', equipment_id: schedule.equipment_id || '', notes: schedule.notes || '',
    });
    setSelectedSchedule(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Title is required.'); return; }
    if (!form.start_date) { alert('Start date is required.'); return; }
    if (!form.frequency) { alert('Frequency is required.'); return; }
    if (form.frequency === 'daily' && !form.end_date) { alert('End date is required for daily schedules.'); return; }
    if (form.frequency === 'daily' && form.end_date < form.start_date) { alert('End date must be after start date.'); return; }
    setModalSaving(true);
    try {
      const payload = {
        title: form.title.trim(), form_template_id: form.form_template_id || null,
        assigned_to: form.assigned_to || null, frequency: form.frequency,
        start_date: form.start_date, end_date: form.frequency === 'daily' ? form.end_date : null,
        location: form.location || null, equipment_id: form.equipment_id || null, notes: form.notes || null,
      };
      if (editingSchedule) {
        const updated = await schedulesAPI.update(editingSchedule.id, payload);
        setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await schedulesAPI.create(payload);
        setSchedules(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      alert('Failed to save schedule. Please try again.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDelete = async (schedule) => {
    if (!window.confirm(`Delete schedule "${schedule.title}"? This cannot be undone.`)) return;
    try {
      await schedulesAPI.delete(schedule.id);
      setSchedules(prev => prev.filter(s => s.id !== schedule.id));
      setSelectedSchedule(null);
    } catch (err) {
      alert('Failed to delete schedule.');
    }
  };

  const handleEventClick = (event) => setSelectedSchedule(event.schedule);
  const events = buildEvents(schedules);

  // ── Status badge helper ──────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const styles = {
      pending:     { bg: '#f1f5f9', color: '#64748b', label: 'Pending' },
      in_progress: { bg: '#eff6ff', color: '#1d4ed8', label: 'In Progress' },
      completed:   { bg: '#f0fdf4', color: '#15803d', label: 'Completed' },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{ padding: '2px 8px', background: s.bg, color: s.color, borderRadius: '10px', fontWeight: 600, fontSize: '0.7rem' }}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Inspection Schedule</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>
            {isSupervisor
              ? 'Create and manage inspection schedules. Assigned inspectors can start their inspections directly from here.'
              : 'View your assigned inspection schedule and start your inspections directly.'}
          </p>
        </div>
        {isSupervisor && (
          <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 2px 6px rgba(74,157,95,0.3)', whiteSpace: 'nowrap' }}>
            + New Schedule
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : (
        <>
          {/* Calendar */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <style>{`
              .rbc-calendar { font-family: inherit; }
              .rbc-header { padding: 8px 4px; font-size: 0.8rem; font-weight: 600; color: #374151; }
              .rbc-today { background-color: #f0fdf4 !important; }
              .rbc-off-range-bg { background-color: #f8fafc; }
              .rbc-toolbar button { font-size: 0.85rem; padding: 6px 14px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; color: #374151; cursor: pointer; }
              .rbc-toolbar button:hover { background: #f1f5f9; }
              .rbc-toolbar button.rbc-active { background: #4a9d5f !important; color: white !important; border-color: #4a9d5f !important; }
              .rbc-toolbar-label { font-weight: 700; font-size: 1rem; color: #1e293b; }
              .rbc-event { border: none !important; }
              .rbc-event:focus { outline: none; }
              .rbc-show-more { color: #4a9d5f; font-size: 0.75rem; font-weight: 600; }
            `}</style>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 520 }}
              view={calendarView}
              onView={setCalendarView}
              date={calendarDate}
              onNavigate={setCalendarDate}
              views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={handleEventClick}
              popup
              tooltipAccessor={(e) => `${e.title}${e.schedule.assigned_to_name ? ` → ${e.schedule.assigned_to_name}` : ''}`}
            />
          </div>

          {/* Selected schedule detail panel */}
          {selectedSchedule && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px', borderLeft: `4px solid ${getColour(selectedSchedule.id).bg}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: '#1e293b' }}>{selectedSchedule.title}</h3>
                    <StatusBadge status={selectedSchedule.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#64748b' }}>
                    <span><strong>Frequency:</strong> {selectedSchedule.frequency === 'daily' ? 'Daily' : 'One-time'}</span>
                    <span><strong>Start:</strong> {fmtDate(selectedSchedule.start_date)}</span>
                    {selectedSchedule.end_date && <span><strong>End:</strong> {fmtDate(selectedSchedule.end_date)}</span>}
                    {selectedSchedule.assigned_to_name && <span><strong>Inspector:</strong> {selectedSchedule.assigned_to_name}</span>}
                    {selectedSchedule.form_title && <span><strong>Form:</strong> {selectedSchedule.form_title}</span>}
                    {selectedSchedule.location && <span><strong>Location:</strong> {selectedSchedule.location}</span>}
                    {selectedSchedule.equipment_id && <span><strong>Equipment:</strong> {selectedSchedule.equipment_id}</span>}
                  </div>
                  {selectedSchedule.notes && <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#4b5563' }}>{selectedSchedule.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  {canStart(selectedSchedule) && (
                    <button
                      onClick={(e) => handleStartInspection(selectedSchedule, e)}
                      disabled={startingId === selectedSchedule.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, boxShadow: '0 2px 6px rgba(74,157,95,0.3)' }}
                    >
                      <PlayCircle size={16} />
                      {startingId === selectedSchedule.id ? 'Starting...' : 'Start Inspection'}
                    </button>
                  )}
                  {isSupervisor && (
                    <>
                      <button onClick={() => openEditModal(selectedSchedule)} style={{ padding: '6px 14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Edit</button>
                      <button onClick={() => handleDelete(selectedSchedule)} style={{ padding: '6px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Delete</button>
                    </>
                  )}
                  <button onClick={() => setSelectedSchedule(null)} style={{ padding: '6px 10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                </div>
              </div>
            </div>
          )}

          {/* Schedule list */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>All Schedules ({schedules.length})</h2>
            </div>

            {schedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</p>
                <p style={{ fontWeight: 600, color: '#64748b' }}>No schedules yet</p>
                {isSupervisor && <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>Click <strong>+ New Schedule</strong> to create the first one.</p>}
              </div>
            ) : (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {schedules.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSchedule(s)}
                    style={{ border: '1px solid #e2e8f0', borderLeft: `4px solid ${getColour(s.id).bg}`, borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', background: selectedSchedule?.id === s.id ? '#f8fafc' : 'white', transition: 'background 0.15s' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <p style={{ fontWeight: 700, color: '#1e293b', margin: 0 }}>{s.title}</p>
                          <StatusBadge status={s.status} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                          <span style={{ padding: '1px 8px', background: s.frequency === 'daily' ? '#eff6ff' : '#f0fdf4', color: s.frequency === 'daily' ? '#1d4ed8' : '#15803d', borderRadius: '10px', fontWeight: 600, fontSize: '0.7rem' }}>
                            {s.frequency === 'daily' ? 'Daily' : 'One-time'}
                          </span>
                          <span>{fmtDate(s.start_date)}{s.end_date ? ` → ${fmtDate(s.end_date)}` : ''}</span>
                          {s.assigned_to_name && <span>👤 {s.assigned_to_name}</span>}
                          {s.form_title && <span>📋 {s.form_title}</span>}
                          {s.location && <span>📍 {s.location}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        {canStart(s) && (
                          <button
                            onClick={(e) => handleStartInspection(s, e)}
                            disabled={startingId === s.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            <PlayCircle size={13} />
                            {startingId === s.id ? 'Starting...' : 'Start'}
                          </button>
                        )}
                        {isSupervisor && (
                          <>
                            <button onClick={() => openEditModal(s)} style={{ padding: '4px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Edit</button>
                            <button onClick={() => handleDelete(s)} style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{editingSchedule ? 'Edit Schedule' : '+ New Schedule'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Daily HVAC Check" className="form-control" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Frequency <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['once', 'daily'].map(freq => (
                    <button key={freq} type="button" onClick={() => setForm(f => ({ ...f, frequency: freq, end_date: freq === 'once' ? '' : f.end_date }))}
                      style={{ flex: 1, padding: '10px', border: `2px solid ${form.frequency === freq ? '#4a9d5f' : '#e2e8f0'}`, borderRadius: '8px', background: form.frequency === freq ? '#f0fdf4' : 'white', color: form.frequency === freq ? '#15803d' : '#64748b', fontWeight: form.frequency === freq ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                      {freq === 'once' ? '📅 One-time' : '🔁 Daily'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: form.frequency === 'daily' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{form.frequency === 'daily' ? 'Start Date' : 'Date'} <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="form-control" />
                </div>
                {form.frequency === 'daily' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>End Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="form-control" />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assign To Inspector</label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="form-control">
                  <option value="">Unassigned</option>
                  {inspectors.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Form Template</label>
                <select value={form.form_template_id} onChange={e => setForm(f => ({ ...f, form_template_id: e.target.value }))} className="form-control">
                  <option value="">No template selected</option>
                  {forms.map(ft => <option key={ft.id} value={ft.id}>{ft.title} ({ft.category})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</label>
                  <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Building A" className="form-control" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Equipment ID</label>
                  <input type="text" value={form.equipment_id} onChange={e => setForm(f => ({ ...f, equipment_id: e.target.value }))} placeholder="e.g. EQ-001" className="form-control" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes / Instructions</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any instructions for the inspector..." className="form-control" rows={3} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSave} disabled={modalSaving} className="btn btn-primary" style={{ flex: 2, background: '#4a9d5f', borderColor: '#4a9d5f' }}>
                {modalSaving ? 'Saving...' : editingSchedule ? 'Save Changes' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
