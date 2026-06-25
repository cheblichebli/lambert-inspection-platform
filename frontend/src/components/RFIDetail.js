import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rfiAPI, usersAPI, uploadAPI } from '../api';
import { ArrowLeft, Upload, X, FileText, ExternalLink } from 'lucide-react';

const STATUS_META = {
  draft:                          { label: 'Draft',                        color: '#64748b', bg: '#f1f5f9' },
  submitted:                      { label: 'Submitted',                    color: '#3b82f6', bg: '#eff6ff' },
  in_review:                      { label: 'In Review',                    color: '#8b5cf6', bg: '#f5f3ff' },
  approved:                       { label: 'Approved',                     color: '#10b981', bg: '#f0fdf4' },
  approved_commented_resubmit:    { label: 'Approved — Resubmit Required', color: '#f59e0b', bg: '#fffbeb' },
  approved_commented_no_resubmit: { label: 'Approved with Comments',       color: '#0ea5e9', bg: '#f0f9ff' },
  rejected:                       { label: 'Rejected',                     color: '#dc2626', bg: '#fef2f2' },
};

const DOC_TYPES = [
  { key: 'check_sheet',    label: 'Digital Check Sheet',          icon: '📋' },
  { key: 'commissioning',  label: 'Commissioning / Test Record',  icon: '🔧' },
  { key: 'site_photo',     label: 'Site Photo',                   icon: '📷' },
  { key: 'attachment',     label: 'Supporting Attachment',        icon: '📎' },
];

// Shared accepted file types: PDF, JPEG, PNG, Word, Excel
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const Row = ({ label, value }) => value !== undefined && value !== null && value !== '' ? (
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

// Read-only list of files (array of { filename, url })
const FileList = ({ files }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {files.map((f, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <FileText size={18} style={{ color: '#4a9d5f', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</p>
        </div>
        <a href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a9d5f', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
          View <ExternalLink size={14} />
        </a>
      </div>
    ))}
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
  const [replyDate, setReplyDate] = useState('');
  const [submittingQC, setSubmittingQC] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null);

  const [submittingResubmit, setSubmittingResubmit] = useState(false);

  const isSupervisor = ['admin', 'supervisor'].includes(user?.role);
  const isInitiator  = rfi && parseInt(rfi.initiated_by) === parseInt(user?.id);

  const load = useCallback(async () => {
    try {
      const data = await rfiAPI.getById(id);
      setRfi(data);
      setQcComments(data.qc_comments || '');
      setQcAttachments(Array.isArray(data.qc_attachments) ? data.qc_attachments : []);
      setReplyDate(data.reply_date ? data.reply_date.split('T')[0] : '');
    } catch (err) {
      console.error('Failed to load RFI:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    if (isSupervisor) usersAPI.getAll().then(setAllUsers).catch(() => {});
  }, [load]);

  const handleQCAttachment = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setUploadingDoc(docType.key);
    try {
      const uploaded = await uploadAPI.upload(file, 'rfi-qc-docs');
      setQcAttachments(prev => [...prev, {
        filename: file.name,
        url: uploaded.url,
        key: uploaded.key,
        doc_type: docType.key,
        doc_type_label: docType.label,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.full_name || 'QC Engineer',
        size: file.size,
      }]);
    } catch (err) {
      alert('Upload failed. Please try again.');
    } finally {
      setUploadingDoc(null);
    }
  };

  const removeQCAttachment = async (idx) => {
    const att = qcAttachments[idx];
    if (att.key) {
      try { await uploadAPI.delete(att.key); } catch (_) {}
    }
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
        reply_date: replyDate || new Date().toISOString(),
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
      await rfiAPI.update(id, { status: 'submitted', cycle: rfi.cycle + 1 });
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

  const canQCProcess = isSupervisor && ['submitted', 'in_review'].includes(rfi.status);
  const canResubmit  = isInitiator && rfi.status === 'approved_commented_resubmit';
  const canEdit      = (isInitiator && rfi.status === 'draft') || (isSupervisor && ['submitted', 'in_review'].includes(rfi.status));

  // Build display arrays with backward-compat for legacy single-file / text records
  let drawingFilesDisplay = Array.isArray(rfi.drawing_files) ? rfi.drawing_files : [];
  if (drawingFilesDisplay.length === 0 && rfi.drawing_data) {
    drawingFilesDisplay = [{ filename: rfi.drawing_filename || 'Drawing', url: rfi.drawing_data }];
  }
  const testResultFilesDisplay = Array.isArray(rfi.test_result_files) ? rfi.test_result_files : [];

  // Group QC attachments by doc type
  const attByType = DOC_TYPES.reduce((acc, dt) => {
    acc[dt.key] = qcAttachments.filter(a => a.doc_type === dt.key || (!a.doc_type && dt.key === 'attachment'));
    return acc;
  }, {});

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <button onClick={() => navigate('/rfi')} className="btn btn-secondary">
          <ArrowLeft size={20} /> Back to RFIs
        </button>
        {canEdit && rfi.status === 'draft' && (
          <button onClick={() => navigate(`/rfi/${id}/edit`)} className="btn btn-secondary">Edit Draft</button>
        )}
      </div>

      <div className="inspection-detail">
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: typeColor + '20', color: typeColor, border: `1px solid ${typeColor}40` }}>
              {rfi.type}
            </span>
            <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
              {meta.label}
            </span>
            {rfi.cycle > 1 && (
              <span style={{ padding: '3px 9px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                Cycle {rfi.cycle}
              </span>
            )}
            {rfi.ncr_triggered && (
              <span style={{ padding: '3px 9px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                NCR Issued
              </span>
            )}
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', color: '#1e293b' }}>
            {rfi.rfi_number || `RFI #${rfi.id}`}
          </h1>
          {rfi.description && (
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>{rfi.description}</p>
          )}
        </div>

        {/* RFI Details */}
        <Section title="RFI Details">
          <Row label="RFI Number"      value={rfi.rfi_number} />
          <Row label="Project"         value={rfi.project_name || rfi.project} />
          <Row label="Type"            value={rfi.type} />
          <Row label="Phase of Work"   value={rfi.phase_of_work} />
          <Row label="T&C Level"       value={rfi.tc_level} />
          <Row label="System"          value={rfi.system} />
          <Row label="Sub-System"      value={rfi.sub_system} />
          <Row label="Drawing No."     value={rfi.drawing_no} />
          <Row label="As-Built"        value={rfi.as_built ? 'Yes' : 'No'} />
          <Row label="Floor"           value={rfi.floor} />
          <Row label="Location"        value={rfi.location} />
          <Row label="Grid Reference"  value={rfi.coordinates} />
          <Row label="Initiated By"    value={rfi.initiated_by_name} />
          <Row label="QC Engineer"     value={rfi.assigned_to_name} />
          <Row label="Submission Date" value={fmtDateTime(rfi.submitted_at)} />
          <Row label="Reviewed By"     value={rfi.reviewed_by_name} />
          <Row label="Review Date"     value={fmtDateTime(rfi.reviewed_at)} />
          <Row label="Reply Date"      value={fmtDate(rfi.reply_date)} />
        </Section>

        {/* Description */}
        {rfi.description && (
          <Section title="Description of Works">
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{rfi.description}</p>
          </Section>
        )}

        {/* Test Results / Supporting Data — files (with legacy text fallback) */}
        {testResultFilesDisplay.length > 0 && (
          <Section title={`Test Results / Supporting Data (${testResultFilesDisplay.length})`}>
            <FileList files={testResultFilesDisplay} />
          </Section>
        )}
        {testResultFilesDisplay.length === 0 && rfi.test_results && (
          <Section title="Test Results / Supporting Data">
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{rfi.test_results}</p>
          </Section>
        )}

        {/* Drawings — files */}
        {drawingFilesDisplay.length > 0 && (
          <Section title={`Drawing Attachments (${drawingFilesDisplay.length})`}>
            <FileList files={drawingFilesDisplay} />
          </Section>
        )}

        {/* QC Review Comments (read-only view) */}
        {rfi.qc_comments && !canQCProcess && (
          <Section title="QC Review Comments">
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{rfi.qc_comments}</p>
          </Section>
        )}

        {/* QC Attachments (read-only view) */}
        {qcAttachments.length > 0 && !canQCProcess && (
          <Section title={`QC Documents (${qcAttachments.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {qcAttachments.map((att, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{DOC_TYPES.find(d => d.key === att.doc_type)?.icon || '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{att.filename}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{att.doc_type_label || att.doc_type} · {att.uploaded_by} · {fmtDate(att.uploaded_at)}</p>
                  </div>
                  <a href={att.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a9d5f', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
                    View <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* NCR notice */}
        {rfi.ncr_triggered && (
          <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '4px solid #ef4444', borderRadius: '8px', marginTop: '16px' }}>
            <p style={{ fontWeight: 700, color: '#dc2626', margin: '0 0 4px' }}>⚠ Non-Conformity Report (NCR) Issued</p>
            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>A CAPA has been automatically created. View it in the CAPA module.</p>
          </div>
        )}

        {/* Resubmit panel */}
        {canResubmit && (
          <div className="review-section" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '20px' }}>
            <h2 style={{ color: '#92400e', margin: '0 0 8px' }}>Resubmission Required</h2>
            <p style={{ fontSize: '0.875rem', color: '#78350f', margin: '0 0 16px' }}>
              The QC engineer has approved this RFI with comments and requested a resubmission. Review the comments above, make adjustments, and resubmit.
            </p>
            {rfi.qc_comments && (
              <div style={{ background: 'white', border: '1px solid #fcd34d', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', margin: '0 0 4px' }}>QC Comments</p>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0 }}>{rfi.qc_comments}</p>
              </div>
            )}
            <button onClick={handleResubmit} disabled={submittingResubmit}
              style={{ padding: '10px 24px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
              {submittingResubmit ? 'Resubmitting...' : '↻ Resubmit for QC Review'}
            </button>
          </div>
        )}

        {/* QC Processing Panel */}
        {canQCProcess && (
          <div className="review-section">
            <h2>QC Uploading Window</h2>

            {rfi.status === 'submitted' && (
              <div style={{ marginBottom: '16px' }}>
                <button onClick={handleMarkInReview}
                  style={{ padding: '8px 18px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                  Mark as In Review
                </button>
              </div>
            )}

            {/* QC Comments */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                QC Comments / Remarks
              </label>
              <textarea value={qcComments} onChange={e => setQcComments(e.target.value)}
                className="form-control" rows={4}
                placeholder="Enter QC review comments, findings, conditions for approval..." />
            </div>

            {/* Reply Date */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Reply Date
              </label>
              <input type="date" value={replyDate} onChange={e => setReplyDate(e.target.value)}
                className="form-control" style={{ maxWidth: '200px' }} />
            </div>

            {/* Document Upload — structured by type */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                QC Documents
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {DOC_TYPES.map(dt => (
                  <div key={dt.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: attByType[dt.key]?.length > 0 ? '10px' : 0 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{dt.icon} {dt.label}</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#4a9d5f', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        {uploadingDoc === dt.key ? 'Uploading...' : <><Upload size={13} /> Add</>}
                        <input type="file" accept={ACCEPTED_TYPES} onChange={e => handleQCAttachment(e, dt)} style={{ display: 'none' }} disabled={uploadingDoc !== null} />
                      </label>
                    </div>
                    {attByType[dt.key]?.map((att, i) => {
                      const globalIdx = qcAttachments.indexOf(att);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '1px solid #e2e8f0' }}>
                          <FileText size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.8rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</p>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{att.uploaded_by} · {fmtDate(att.uploaded_at)}</p>
                          </div>
                          <a href={att.url} target="_blank" rel="noreferrer" style={{ color: '#4a9d5f', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>View</a>
                          <button onClick={() => removeQCAttachment(globalIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                            <X size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Decision */}
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
                Review Decision
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'approved',                       label: '✓ Approved',                             color: '#10b981', desc: 'Installation meets all QC requirements.' },
                  { key: 'approved_commented_no_resubmit', label: '✓ Approved with Comments (No Resubmit)', color: '#0ea5e9', desc: 'Approved with minor comments. No resubmission needed.' },
                  { key: 'approved_commented_resubmit',    label: '↻ Approved with Comments (Resubmit)',    color: '#f59e0b', desc: 'Approved conditionally. Initiator must resubmit.' },
                  { key: 'rejected',                       label: '✗ Rejected — Issue NCR',                 color: '#dc2626', desc: 'Non-conformity detected. A CAPA will be auto-created.' },
                ].map(opt => (
                  <div key={opt.key} onClick={() => setQcStatus(opt.key)}
                    style={{ padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', border: `2px solid ${qcStatus === opt.key ? opt.color : '#e2e8f0'}`, background: qcStatus === opt.key ? opt.color + '10' : 'white', transition: 'all 0.15s' }}>
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
              <button onClick={handleSubmitReview} disabled={!qcStatus || submittingQC} className="btn btn-primary" style={{ flex: 1 }}>
                {submittingQC ? 'Submitting...' : 'Submit QC Review'}
              </button>
            </div>
            {qcStatus === 'rejected' && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '8px', textAlign: 'center' }}>
                ⚠ Submitting as Rejected will automatically create a CAPA/NCR.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RFIDetail;
