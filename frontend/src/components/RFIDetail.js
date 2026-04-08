import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rfiAPI, usersAPI } from '../api';
import { ArrowLeft, Upload, X } from 'lucide-react';

const STATUS_META = {
  draft:                          { label: 'Draft',                       color: '#64748b', bg: '#f1f5f9' },
  submitted:                      { label: 'Submitted',                   color: '#3b82f6', bg: '#eff6ff' },
  in_review:                      { label: 'In Review',                   color: '#8b5cf6', bg: '#f5f3ff' },
  approved:                       { label: 'Approved',                    color: '#10b981', bg: '#f0fdf4' },
  approved_commented_resubmit:    { label: 'Approved — Resubmit Required',color: '#f59e0b', bg: '#fffbeb' },
  approved_commented_no_resubmit: { label: 'Approved with Comments',      color: '#0ea5e9', bg: '#f0f9ff' },
  rejected:                       { label: 'Rejected',                    color: '#dc2626', bg: '#fef2f2' },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const Row = ({ label, value }) => value ? (
  <div style={{ display: 'flex', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
    <strong style={{ minWidth: '180px', color: '#374151', fontSize: '0.875rem' }}>{label}:</strong>
    <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>{value}</span>
  </div>
) : null;

const Section = ({ title, children }) => (
  <div className="detail-section">
    <h2>{title}</h2>
    {children}
  </div>
);

const RFIDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rfi, setRfi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  // QC processing state
  const [qcStatus, setQcStatus] = useState('');
  const [qcComments, setQcComments] = useState('');
  const [qcAttachments, setQcAttachments] = useState([]);
  const [submittingQC, setSubmittingQC] = useState(false);

  // Resubmit state (for initiator)
  const [submittingResubmit, setSubmittingResubmit] = useState(false);

  const isSupervisor = ['admin', 'supervisor'].includes(user?.role);
  const isInitiator  = rfi && parseInt(rfi.initiated_by) === parseInt(user?.id);

  useEffect(() => {
    load();
    if (isSupervisor) usersAPI.getAll().then(setAllUsers).catch(() => {});
  }, [id]);

  const load = async () => {
    try {
      const data = await rfiAPI.getById(id);
      setRfi(data);
      setQcComments(data.qc_comments || '');
      setQcAttachments(Array.isArray(data.qc_attachments) ? data.qc_attachments : []);
    } catch (err) {
      console.error('Failed to load RFI:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQCAttachment = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setQcAttachments(prev => [...prev, {
        filename: file.name,
        data: reader.result,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.full_name || 'QC Engineer',
      }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeQCAttachment = (idx) => {
    setQcAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitReview = async () => {
    if (!qcStatus) { alert('Please select a review decision.'); return; }
    setSubmittingQC(true);
    try {
      await rfiAPI.update(id, {
        status: qcStatus,
        qc_comments: qcComments,
        qc_attachments: qcAttachments,
      });
      await load();
    } catch (err) {
      alert('Failed to submit review. Please try again.');
    } finally {
      setSubmittingQC(false);
    }
  };

  const handleMarkInReview = async () => {
    try {
      await rfiAPI.update(id, { status: 'in_review' });
      await load();
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleResubmit = async () => {
    if (!window.confirm('Resubmit this RFI for QC review? The cycle count will increment.')) return;
    setSubmittingResubmit(true);
    try {
      await rfiAPI.update(id, {
        status: 'submitted',
        cycle: rfi.cycle + 1,
      });
      await load();
    } catch (err) {
      alert('Failed to resubmit.');
    } finally {
      setSubmittingResubmit(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (!rfi) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>RFI not found.</div>;

  const meta = STATUS_META[rfi.status] || STATUS_META.draft;
  const typeColor = rfi.type === 'Mechanical' ? '#0ea5e9' : '#f59e0b';

  // Determine what panels to show
  const canQCProcess = isSupervisor && ['submitted', 'in_review'].includes(rfi.status);
  const canResubmit  = isInitiator && rfi.status === 'approved_commented_resubmit';
  const canEdit      = (isInitiator && rfi.status === 'draft') || (isSupervisor && ['submitted', 'in_review'].includes(rfi.status));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <button onClick={() => navigate('/rfi')} className="btn btn-secondary">
          <ArrowLeft size={20} /> Back to RFIs
        </button>
        {canEdit && rfi.status === 'draft' && (
          <button onClick={() => navigate(`/rfi/${id}/edit`)} className="btn btn-secondary">
            Edit Draft
          </button>
        )}
      </div>

      <div className="inspection-detail">
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: typeColor + '20', color: typeColor, border: `1px solid ${typeColor}40` }}>
              {rfi.type}
            </span>
            <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 700, background: meta.color, color: 'white' }}>
              {meta.label}
            </span>
            {rfi.cycle > 1 && (
              <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                Cycle {rfi.cycle}
              </span>
            )}
            {rfi.ncr_triggered && (
              <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                ⚠ NCR Issued
              </span>
            )}
          </div>
          <h1 style={{ margin: '0 0 4px' }}>{rfi.rfi_number || `RFI #${rfi.id}`}</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>{rfi.project}</p>
        </div>

        {/* RFI Details */}
        <Section title="RFI Details">
          <Row label="Type"         value={rfi.type} />
          <Row label="Stage"        value={rfi.stage} />
          <Row label="System"       value={rfi.system} />
          <Row label="Sub-System"   value={rfi.sub_system} />
          <Row label="Location"     value={rfi.location} />
          <Row label="Coordinates"  value={rfi.coordinates} />
          <Row label="Initiated by" value={rfi.initiated_by_name} />
          <Row label="QC Engineer"  value={rfi.assigned_to_name} />
          <Row label="Submitted"    value={fmtDateTime(rfi.submitted_at)} />
          <Row label="Reviewed"     value={rfi.reviewed_at ? `${fmtDateTime(rfi.reviewed_at)} by ${rfi.reviewed_by_name}` : null} />
        </Section>

        {/* Description */}
        {rfi.description && (
          <Section title="Description">
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{rfi.description}</p>
          </Section>
        )}

        {/* Test Results */}
        {rfi.test_results && (
          <Section title="Test Results / Supporting Data">
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{rfi.test_results}</p>
          </Section>
        )}

        {/* Drawing */}
        {rfi.drawing_data && (
          <Section title="Drawing Attachment">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📎</span>
              <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>{rfi.drawing_filename || 'Drawing'}</p>
              <a
                href={rfi.drawing_data}
                download={rfi.drawing_filename || 'drawing'}
                style={{ marginLeft: 'auto', color: '#4a9d5f', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
              >
                Download
              </a>
            </div>
            {rfi.drawing_data.startsWith('data:image') && (
              <img src={rfi.drawing_data} alt="Drawing" style={{ marginTop: '12px', maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
            )}
          </Section>
        )}

        {/* QC Results — show when reviewed */}
        {rfi.qc_comments && (
          <Section title="QC Review Comments">
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{rfi.qc_comments}</p>
          </Section>
        )}

        {/* QC Attachments */}
        {qcAttachments.length > 0 && !canQCProcess && (
          <Section title={`QC Attachments (${qcAttachments.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {qcAttachments.map((att, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{att.filename}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>by {att.uploaded_by} · {fmtDate(att.uploaded_at)}</p>
                  </div>
                  <a href={att.data} download={att.filename} style={{ color: '#4a9d5f', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>Download</a>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* NCR/CAPA notice */}
        {rfi.ncr_triggered && (
          <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '4px solid #ef4444', borderRadius: '8px', marginTop: '16px' }}>
            <p style={{ fontWeight: 700, color: '#dc2626', margin: '0 0 4px' }}>⚠ Non-Conformity Report (NCR) Issued</p>
            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>
              A CAPA has been automatically created from this rejection. View it in the CAPA module.
            </p>
          </div>
        )}

        {/* ── Resubmit panel (for initiator) ─────────────────────────────── */}
        {canResubmit && (
          <div className="review-section" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '20px' }}>
            <h2 style={{ color: '#92400e', margin: '0 0 8px' }}>Resubmission Required</h2>
            <p style={{ fontSize: '0.875rem', color: '#78350f', margin: '0 0 16px' }}>
              The QC engineer has approved this RFI with comments and requested a resubmission. Please review the comments above, make the necessary adjustments, and resubmit.
            </p>
            {rfi.qc_comments && (
              <div style={{ background: 'white', border: '1px solid #fcd34d', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', margin: '0 0 4px' }}>QC Comments</p>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0 }}>{rfi.qc_comments}</p>
              </div>
            )}
            <button
              onClick={handleResubmit}
              disabled={submittingResubmit}
              style={{ padding: '10px 24px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
            >
              {submittingResubmit ? 'Resubmitting...' : '↻ Resubmit for QC Review'}
            </button>
          </div>
        )}

        {/* ── QC Processing Panel (for supervisor/admin) ──────────────────── */}
        {canQCProcess && (
          <div className="review-section">
            <h2>QC Processing</h2>

            {/* Mark in review */}
            {rfi.status === 'submitted' && (
              <div style={{ marginBottom: '16px' }}>
                <button onClick={handleMarkInReview} style={{ padding: '8px 18px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                  Mark as In Review
                </button>
              </div>
            )}

            {/* QC Comments */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                QC Comments / Remarks
              </label>
              <textarea
                value={qcComments}
                onChange={e => setQcComments(e.target.value)}
                className="form-control"
                rows={4}
                placeholder="Enter QC review comments, findings, conditions for approval..."
              />
            </div>

            {/* QC Attachments */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Attach QC Documents ({qcAttachments.length})
              </label>
              {qcAttachments.map((att, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1rem' }}>📄</span>
                  <span style={{ flex: 1, fontSize: '0.875rem', color: '#374151' }}>{att.filename}</span>
                  <button onClick={() => removeQCAttachment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <X size={16} />
                  </button>
                </div>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', marginTop: qcAttachments.length > 0 ? '8px' : 0 }}>
                <Upload size={18} style={{ color: '#4a9d5f' }} />
                <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Attach check sheet, commissioning record, or photo</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleQCAttachment} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Decision buttons */}
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
                Review Decision
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'approved',                        label: '✓ Approved',                              color: '#10b981', desc: 'Installation meets all QC requirements.' },
                  { key: 'approved_commented_no_resubmit',  label: '✓ Approved with Comments (No Resubmit)',  color: '#0ea5e9', desc: 'Approved with minor comments. No resubmission needed.' },
                  { key: 'approved_commented_resubmit',     label: '↻ Approved with Comments (Resubmit)',     color: '#f59e0b', desc: 'Approved conditionally. Initiator must resubmit after addressing comments.' },
                  { key: 'rejected',                        label: '✗ Rejected — Issue NCR',                  color: '#dc2626', desc: 'Non-conformity detected. A CAPA will be auto-created.' },
                ].map(opt => (
                  <div
                    key={opt.key}
                    onClick={() => setQcStatus(opt.key)}
                    style={{
                      padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                      border: `2px solid ${qcStatus === opt.key ? opt.color : '#e2e8f0'}`,
                      background: qcStatus === opt.key ? opt.color + '10' : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${qcStatus === opt.key ? opt.color : '#cbd5e1'}`, background: qcStatus === opt.key ? opt.color : 'white', flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: qcStatus === opt.key ? opt.color : '#1e293b', fontSize: '0.9rem' }}>{opt.label}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{opt.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSubmitReview}
                disabled={!qcStatus || submittingQC}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {submittingQC ? 'Submitting...' : 'Submit QC Review'}
              </button>
            </div>
            {qcStatus === 'rejected' && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '8px', textAlign: 'center' }}>
                ⚠ Submitting as Rejected will automatically create a CAPA/NCR in the system.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RFIDetail;
