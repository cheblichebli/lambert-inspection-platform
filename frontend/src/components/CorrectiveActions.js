import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { capaAPI, usersAPI } from '../api';
import { Camera, Upload, X } from 'lucide-react';

const CorrectiveActions = ({ user }) => {
  const navigate = useNavigate();

  // ── Data state ─────────────────────────────────────────────────────────
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, closed: 0, overdue: 0, recurring: 0 });
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Filter state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('open'); // 'all' | 'open' | 'overdue' | 'closed'

  // ── Evidence submission state (inspector) ────────────────────────────────
  const [evidenceTarget, setEvidenceTarget] = useState(null); // action being closed
  const [evidenceForm, setEvidenceForm] = useState({ note: '', photo: '' });
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);

  // ── Closure state (supervisor/admin) ────────────────────────────────────
  const [closureTarget, setClosureTarget] = useState(null);
  const [closureSubmitting, setClosureSubmitting] = useState(false);

  const isSupervisor = user && ['admin', 'supervisor'].includes(user.role);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (activeTab === 'open') filters.status = 'open';
      else if (activeTab === 'overdue') filters.status = 'open'; // filter overdue client-side
      else if (activeTab === 'closed') filters.status = 'closed';
      // 'all' — no filter

      const [actionsData, statsData] = await Promise.all([
        capaAPI.getAll(filters),
        capaAPI.getStats(),
      ]);

      let filtered = actionsData;
      if (activeTab === 'overdue') {
        const now = new Date();
        filtered = actionsData.filter(a => a.due_date && new Date(a.due_date) < now && a.status !== 'closed');
      }

      setActions(filtered);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load CAPA data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
    if (isSupervisor) {
      usersAPI.getAll().then(setAllUsers).catch(() => {});
    }
  }, [loadData]);

  // ── Evidence photo handler ───────────────────────────────────────────────
  const handleEvidencePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setEvidenceForm(f => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Submit evidence (inspector marks in_progress) ────────────────────────
  const handleSubmitEvidence = async () => {
    if (!evidenceForm.note && !evidenceForm.photo) {
      alert('Please add a note or photo as evidence before submitting.');
      return;
    }
    setEvidenceSubmitting(true);
    try {
      const updated = await capaAPI.update(evidenceTarget.id, {
        status: 'in_progress',
        evidence_note: evidenceForm.note,
        evidence_photo: evidenceForm.photo || undefined,
      });
      setActions(prev => prev.map(a => a.id === updated.id ? updated : a));
      setEvidenceTarget(null);
      setEvidenceForm({ note: '', photo: '' });
      loadData();
    } catch (err) {
      alert('Failed to submit evidence. Please try again.');
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  // ── Close action (supervisor confirms fix) ───────────────────────────────
  const handleCloseAction = async (action) => {
    if (!window.confirm(`Close this corrective action?\n\n"${action.title}"\n\nThis confirms the fix has been verified.`)) return;
    setClosureTarget(action.id);
    setClosureSubmitting(true);
    try {
      const updated = await capaAPI.update(action.id, { status: 'closed' });
      setActions(prev => prev.map(a => a.id === updated.id ? updated : a));
      loadData();
    } catch (err) {
      alert('Failed to close action. Please try again.');
    } finally {
      setClosureTarget(null);
      setClosureSubmitting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const priorityColors = { critical: '#dc2626', major: '#d97706', minor: '#64748b' };
  const priorityBg = { critical: '#fef2f2', major: '#fffbeb', minor: '#f8fafc' };
  const statusColors = { open: '#3b82f6', in_progress: '#d97706', closed: '#10b981' };

  const isOverdue = (action) =>
    action.due_date && new Date(action.due_date) < new Date() && action.status !== 'closed';

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const tabs = [
    { key: 'open',    label: 'Open',    count: stats.open },
    { key: 'overdue', label: 'Overdue', count: stats.overdue },
    { key: 'closed',  label: 'Closed',  count: stats.closed },
    { key: 'all',     label: 'All',     count: parseInt(stats.open || 0) + parseInt(stats.in_progress || 0) + parseInt(stats.closed || 0) },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1>Corrective Actions</h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>
          {isSupervisor
            ? 'Assign and track corrective actions arising from flagged inspections.'
            : 'View and action the corrective actions assigned to you.'}
        </p>
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Open',      value: stats.open,        color: '#3b82f6', bg: '#eff6ff' },
          { label: 'In Progress', value: stats.in_progress, color: '#d97706', bg: '#fffbeb' },
          { label: 'Overdue',   value: stats.overdue,     color: '#dc2626', bg: '#fef2f2' },
          { label: 'Recurring', value: stats.recurring,   color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Closed',    value: stats.closed,      color: '#10b981', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.color}30`,
            borderRadius: '10px', padding: '14px 16px', textAlign: 'center'
          }}>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value ?? 0}</p>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#4a9d5f' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #4a9d5f' : '2px solid transparent',
              marginBottom: '-2px', borderRadius: '4px 4px 0 0'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                marginLeft: '6px', background: activeTab === tab.key ? '#4a9d5f' : '#e2e8f0',
                color: activeTab === tab.key ? 'white' : '#64748b',
                borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Action Cards ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : actions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</p>
          <p style={{ fontWeight: 600, color: '#64748b' }}>No actions in this category</p>
          <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>
            {activeTab === 'open' ? 'All corrective actions have been addressed.' : 'Nothing to show here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {actions.map(action => {
            const overdue = isOverdue(action);
            const isAssignedToMe = user && action.assigned_to === user.id;
            const canSubmitEvidence = isAssignedToMe && action.status === 'open';
            const canClose = isSupervisor && action.status === 'in_progress';

            return (
              <div key={action.id} style={{
                background: priorityBg[action.priority] || 'white',
                border: `1px solid ${overdue ? '#fca5a5' : '#e2e8f0'}`,
                borderLeft: `4px solid ${overdue ? '#ef4444' : priorityColors[action.priority] || '#64748b'}`,
                borderRadius: '10px', padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}>

                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                        background: priorityColors[action.priority] || '#64748b', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em'
                      }}>
                        {action.priority}
                      </span>
                      {overdue && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                          OVERDUE
                        </span>
                      )}
                      {action.recurrence_count > 0 && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                          ↻ RECURRING
                        </span>
                      )}
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600,
                        background: statusColors[action.status] + '20', color: statusColors[action.status],
                        border: `1px solid ${statusColors[action.status]}40`, textTransform: 'capitalize'
                      }}>
                        {action.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.95rem' }}>{action.title}</p>
                    {action.description && (
                      <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '4px 0 0' }}>{action.description}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {canSubmitEvidence && (
                      <button
                        onClick={() => { setEvidenceTarget(action); setEvidenceForm({ note: '', photo: '' }); }}
                        style={{ padding: '6px 14px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Submit Evidence
                      </button>
                    )}
                    {canClose && (
                      <button
                        onClick={() => handleCloseAction(action)}
                        disabled={closureSubmitting && closureTarget === action.id}
                        style={{ padding: '6px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        {closureSubmitting && closureTarget === action.id ? 'Closing...' : '✓ Close Action'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Meta */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>
                    <strong>Assigned to:</strong> {action.assigned_to_name || '—'}
                  </span>
                  <span>
                    <strong>Due:</strong>{' '}
                    <span style={{ color: overdue ? '#dc2626' : 'inherit', fontWeight: overdue ? 700 : 400 }}>
                      {fmtDate(action.due_date)}
                    </span>
                  </span>
                  {action.equipment_id && (
                    <span><strong>Equipment:</strong> {action.equipment_id}</span>
                  )}
                  {action.location && (
                    <span><strong>Location:</strong> {action.location}</span>
                  )}
                  <span>
                    <strong>Inspection:</strong>{' '}
                    <button
                      onClick={() => navigate(`/inspections/${action.inspection_id}`)}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      INS-{String(action.inspection_id).padStart(5, '0')}
                    </button>
                  </span>
                  <span><strong>Created:</strong> {fmtDate(action.created_at)}</span>
                </div>

                {/* Evidence block — shown when evidence has been submitted */}
                {action.evidence_note && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Evidence Submitted</p>
                    <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0 }}>{action.evidence_note}</p>
                    {action.evidence_photo && (
                      <img src={action.evidence_photo} alt="Evidence" style={{ marginTop: '8px', maxWidth: '200px', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block' }} />
                    )}
                  </div>
                )}

                {/* Closure info */}
                {action.status === 'closed' && action.closed_by_name && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#10b981' }}>
                    ✓ Closed by {action.closed_by_name} on {fmtDate(action.closed_at)}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ── Evidence Submission Modal ─────────────────────────────────────── */}
      {evidenceTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#1e293b' }}>Submit Evidence</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>{evidenceTarget.title}</p>
              </div>
              <button onClick={() => setEvidenceTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Description of fix <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={evidenceForm.note}
                  onChange={e => setEvidenceForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Describe what corrective action was taken..."
                  className="form-control"
                  rows={3}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Evidence Photo (optional)
                </label>
                {evidenceForm.photo ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={evidenceForm.photo} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'block' }} />
                    <button
                      onClick={() => setEvidenceForm(f => ({ ...f, photo: '' }))}
                      style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                      <Camera size={16} /> Take Photo
                      <input type="file" accept="image/*" capture="environment" onChange={handleEvidencePhoto} style={{ display: 'none' }} />
                    </label>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                      <Upload size={16} /> Upload
                      <input type="file" accept="image/*" onChange={handleEvidencePhoto} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setEvidenceTarget(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={handleSubmitEvidence}
                disabled={evidenceSubmitting || (!evidenceForm.note && !evidenceForm.photo)}
                className="btn btn-primary"
                style={{ flex: 2, background: '#d97706', borderColor: '#d97706' }}
              >
                {evidenceSubmitting ? 'Submitting...' : 'Submit Evidence'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CorrectiveActions;
