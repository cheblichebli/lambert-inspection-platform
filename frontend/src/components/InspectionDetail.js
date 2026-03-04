import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionsAPI } from '../api';
import { CheckCircle, XCircle, ArrowLeft, MapPin, PenTool, Camera } from 'lucide-react';

const InspectionDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  useEffect(() => {
    loadInspection();
  }, [id]);

  const loadInspection = async () => {
    try {
      const data = await inspectionsAPI.getById(id);
      setInspection(data);
    } catch (error) {
      console.error('Error loading inspection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewStatus) {
      alert('Please select approved or rejected');
      return;
    }
    setSubmitting(true);
    try {
      await inspectionsAPI.review(id, reviewStatus, reviewComments);
      alert('Review submitted');
      loadInspection();
    } catch (error) {
      alert('Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!inspection) {
    return <div>Inspection not found</div>;
  }

  const formData = typeof inspection.data === 'string'
    ? JSON.parse(inspection.data)
    : (inspection.data || {});

  const templateFields = (() => {
    try {
      const raw = inspection.template_fields;
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      return [];
    }
  })();

  const fieldMap = {};
  templateFields.forEach(function(field) {
    fieldMap[field.id] = field;
  });

  const renderFieldValue = (field, value) => {
    if (value === null || value === undefined || value === '') return null;
    if (field && field.type === 'photo') return null;
    if (field && field.type === 'table') return null;
    if ((field && field.type === 'checkbox') || typeof value === 'boolean') {
      const isTrue = value === true || value === 'true';
      return (
        <span style={{ color: isTrue ? '#10b981' : '#ef4444', fontWeight: 500 }}>
          {isTrue ? '\u2713 Yes' : '\u2717 No'}
        </span>
      );
    }
    if (Array.isArray(value)) return <span>{value.join(', ')}</span>;
    return <span>{value.toString()}</span>;
  };

  const renderTableField = (field, rows) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
    const columns = field.columns || [];
    if (columns.length === 0) return null;
    const getColGroup = (col) => col.includes(' > ') ? col.split(' > ')[0].trim() : null;
    const getColCore = (col) => col.includes(' > ') ? col.split(' > ')[1].trim() : col;
    const getColType = (col) => { const c = getColCore(col); return c.startsWith('check:') ? 'check' : c.startsWith('date:') ? 'date' : 'text'; };
    const getColLabel = (col) => getColCore(col).replace(/^(text:|check:|date:)/, '');

    const hasGroups = columns.some(col => getColGroup(col) !== null);
    const groupHeaders = [];
    if (hasGroups) {
      let gi = 0;
      while (gi < columns.length) {
        const grp = getColGroup(columns[gi]);
        let span = 1;
        while (gi + span < columns.length && getColGroup(columns[gi + span]) === grp) span++;
        groupHeaders.push({ label: grp || '', span });
        gi += span;
      }
    }

    return (
      <div style={{ overflowX: 'auto', marginTop: '8px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem', minWidth: '400px' }}>
          <thead>
            {hasGroups && (
              <tr>
                {groupHeaders.map((gh, ghi) => (
                  <th key={ghi} colSpan={gh.span} style={{
                    border: '1px solid #e2e8f0', padding: '6px 12px',
                    background: '#e2e8f0', color: '#1e293b', fontWeight: 700,
                    textAlign: 'center', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    {gh.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {columns.map((col, ci) => (
                <th key={ci} style={{
                  border: '1px solid #e2e8f0', padding: '8px 12px',
                  background: '#f1f5f9', color: '#374151', fontWeight: 600,
                  whiteSpace: 'nowrap', textAlign: getColType(col) === 'check' ? 'center' : 'left'
                }}>
                  {getColLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#f8fafc' }}>
                {columns.map((col, ci) => {
                  const colType = getColType(col);
                  const cellVal = row[ci];
                  return (
                    <td key={ci} style={{
                      border: '1px solid #e2e8f0', padding: '8px 12px',
                      textAlign: colType === 'check' ? 'center' : 'left', color: '#4b5563'
                    }}>
                      {colType === 'check'
                        ? (cellVal === true || cellVal === 'true'
                            ? <span style={{ color: '#10b981', fontSize: '1.1rem' }}>\u2713</span>
                            : <span style={{ color: '#cbd5e1' }}>\u2014</span>)
                        : (cellVal || <span style={{ color: '#cbd5e1' }}>\u2014</span>)
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const hasGPS = inspection.gps_latitude && inspection.gps_longitude;
  const gpsString = hasGPS
    ? parseFloat(inspection.gps_latitude).toFixed(6) + ', ' + parseFloat(inspection.gps_longitude).toFixed(6) + (inspection.gps_accuracy ? ' (±' + Math.round(inspection.gps_accuracy) + 'm)' : '')
    : null;

  const statusColors = {
    draft: '#64748b',
    submitted: '#3b82f6',
    approved: '#10b981',
    rejected: '#ef4444'
  };

  return (
    <div className="page-container">

      <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ marginBottom: '16px' }}>
        <ArrowLeft size={20} /> Back
      </button>

      <div className="inspection-detail">

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '8px' }}>{inspection.template_title}</h1>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '12px',
            background: statusColors[inspection.status] || '#64748b',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 600,
            textTransform: 'capitalize'
          }}>
            {inspection.status}
          </span>
        </div>

        <div className="detail-section">
          <h2>Information</h2>
          <p><strong>Inspector:</strong> {inspection.inspector_name || 'Unknown'}</p>
          <p><strong>Location:</strong> {inspection.location || 'N/A'}</p>
          <p><strong>Equipment ID:</strong> {inspection.equipment_id || 'N/A'}</p>
          {inspection.created_at && (
            <p><strong>Created:</strong> {new Date(inspection.created_at).toLocaleString()}</p>
          )}
          {inspection.submitted_at && (
            <p><strong>Submitted:</strong> {new Date(inspection.submitted_at).toLocaleString()}</p>
          )}
          {inspection.reviewed_at && (
            <p><strong>Reviewed:</strong> {new Date(inspection.reviewed_at).toLocaleString()} by {inspection.reviewer_name}</p>
          )}
          {inspection.review_comments && (
            <p><strong>Review Comments:</strong> {inspection.review_comments}</p>
          )}
        </div>

        <div className="detail-section">
          <h2>Form Data</h2>
          {Object.entries(formData).map(function(entry) {
            var key = entry[0];
            var value = entry[1];
            var field = fieldMap[key];
            if (field && field.type === 'photo') return null;
            if (value === null || value === undefined || value === '') return null;
            var label = (field && field.label) ? field.label : key;

            // Table fields get full-width rendering
            if (field && field.type === 'table') {
              return (
                <div key={key} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <strong style={{ color: '#374151', display: 'block', marginBottom: '8px' }}>{label}:</strong>
                  {renderTableField(field, value)}
                </div>
              );
            }

            var rendered = renderFieldValue(field, value);
            if (rendered === null) return null;
            return (
              <div key={key} style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 0',
                borderBottom: '1px solid #f1f5f9',
                alignItems: 'flex-start'
              }}>
                <strong style={{ minWidth: '180px', color: '#374151' }}>{label}:</strong>
                <span style={{ color: '#4b5563' }}>{rendered}</span>
              </div>
            );
          })}
        </div>

        {hasGPS && (
          <div className="detail-section">
            <h2>GPS Location</h2>
            <p style={{ marginBottom: '8px' }}>{gpsString}</p>
            <a
              href={'https://www.google.com/maps?q=' + inspection.gps_latitude + ',' + inspection.gps_longitude}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b82f6', fontSize: '0.875rem' }}
            >
              View on Google Maps
            </a>
          </div>
        )}

        {inspection.inspector_signature && (
          <div className="detail-section">
            <h2>Inspector Signature</h2>
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              background: '#f8fafc',
              display: 'inline-block'
            }}>
              <img
                src={inspection.inspector_signature}
                alt="Inspector Signature"
                style={{ maxWidth: '300px', maxHeight: '120px', display: 'block' }}
              />
            </div>
            {inspection.signature_timestamp && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Signed: {new Date(inspection.signature_timestamp).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {inspection.supervisor_signature && (
          <div className="detail-section">
            <h2>Supervisor Signature</h2>
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              background: '#f8fafc',
              display: 'inline-block'
            }}>
              <img
                src={inspection.supervisor_signature}
                alt="Supervisor Signature"
                style={{ maxWidth: '300px', maxHeight: '120px', display: 'block' }}
              />
            </div>
          </div>
        )}

        {inspection.photos && inspection.photos.length > 0 && (
          <div className="detail-section">
            <h2>Photos ({inspection.photos.length})</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '12px'
            }}>
              {inspection.photos.map(function(photo, idx) {
                return (
                  <div key={idx}>
                    <img
                      src={photo.photo_data}
                      alt={photo.caption || ('Photo ' + (idx + 1))}
                      onClick={() => setExpandedPhoto(photo)}
                      style={{
                        width: '100%',
                        height: '160px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: '1px solid #e2e8f0',
                        display: 'block'
                      }}
                    />
                    {photo.caption && (
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                        {photo.caption}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {inspection.notes && (
          <div className="detail-section">
            <h2>Additional Notes</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: '#4b5563' }}>{inspection.notes}</p>
          </div>
        )}

        {inspection.status === 'submitted' && user && ['supervisor', 'admin'].includes(user.role) && (
          <div className="review-section">
            <h2>Review</h2>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setReviewStatus('approved')}
                className="btn btn-success"
                style={{
                  outline: reviewStatus === 'approved' ? '3px solid #065f46' : 'none',
                  opacity: reviewStatus && reviewStatus !== 'approved' ? 0.5 : 1
                }}
              >
                <CheckCircle size={20} /> Approve
              </button>
              <button
                onClick={() => setReviewStatus('rejected')}
                className="btn btn-error"
                style={{
                  outline: reviewStatus === 'rejected' ? '3px solid #7f1d1d' : 'none',
                  opacity: reviewStatus && reviewStatus !== 'rejected' ? 0.5 : 1
                }}
              >
                <XCircle size={20} /> Reject
              </button>
            </div>
            <textarea
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Comments..."
              className="form-control"
              style={{ marginBottom: '12px', minHeight: '80px' }}
            />
            <button
              onClick={handleReview}
              disabled={!reviewStatus || submitting}
              className="btn btn-primary"
            >
              Submit Review
            </button>
          </div>
        )}

      </div>

      {expandedPhoto && (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <img
              src={expandedPhoto.photo_data}
              alt={expandedPhoto.caption || 'Photo'}
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            {expandedPhoto.caption && (
              <p style={{ color: 'white', textAlign: 'center', marginTop: '8px', fontSize: '14px' }}>
                {expandedPhoto.caption}
              </p>
            )}
            <button
              onClick={() => setExpandedPhoto(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#374151'
              }}
            >
              X
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default InspectionDetail;
