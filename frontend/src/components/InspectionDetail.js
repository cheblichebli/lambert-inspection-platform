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

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (!inspection) return <div>Inspection not found</div>;

  const formData = typeof inspection.data === 'string'
    ? JSON.parse(inspection.data)
    : (inspection.data || {});

  const templateFields = (() => {
    try {
      const raw = inspection.template_fields;
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return []; }
  })();

  const fieldMap = {};
  templateFields.forEach(field => { fieldMap[field.id] = field; });

  const renderFieldValue = (field, value) => {
    if (value === null || value === undefined || value === '') return null;
    if (field?.type === 'photo') return null;
    if (field?.type === 'checkbox' || typeof value === 'boolean') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          color: value === true || value === 'true' ? '#10b981' : '#ef4444',
          fontWeight: 500
        }}>
          {value === true || value === 'true' ? '✓ Yes' : '✗ No'}
        </span>
      );
    }
    if (Array.isArray(value)) return <span>{value.join(', ')}</span>;
    return <span>{value.toString()}</span>;
  };

  const hasGPS = inspection.gps_latitude && inspection.gps_longitude;
  const gpsString = hasGPS
    ? `${parseFloat(inspection.gps_latitude).toFixed(6)}, ${parseFloat(inspection.gps_longitude).toFixed(6)}${inspection.gps_accuracy ? ` (±${Math.round(inspection.gps_accuracy)}m)` : ''}`
    : null;

  const statusColors = {
    draft: '#64748b', submitted: '#3b82f6', approved: '#10b981', rejected: '#ef4444'
  };

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ marginBottom: '16px' }}>
        <ArrowLeft size={20} /> Back
      </button>

      <div className="inspection-detail">

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '8px' }}>{inspection.template_title}</h1>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: '12px',
            background: statusColors[inspection.status] || '#64748b',
            color: 'white', fontSize: '0.875rem', fontWeight: 600, textTransform: 'capitalize'
          }}>
            {inspection.status}
          </span>
        </div>

        {/* Information */}
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

        {/* Form Data */}
        <div className="detail-section">
          <h2>Form Data</h2>
          {Object.entries(formData).map(([key, value]) => {
            const field = fieldMap[key];
            if (field?.type === 'photo') return null;
            if (value === null || value === undefined || value === '') return null;
            const label = field?.label || key;
            const rendered = renderFieldValue(field, value);
            if (rendered === null) return null;
            return (
              <div key={key} style={{
                display: 'flex', gap: '8px', padding: '8px 0',
                borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start'
              }}>
                <strong style={{ minWidth: '180px', color: '#374151' }}>{label}:</strong>
                <span style={{ color: '#4b5563' }}>{rendered}</span>
              </div>
            );
          })}
        </div>

        {/* GPS Location */}
        {hasGPS && (
          <div className="detail-section">
            <h2>
              <MapPin size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
              GPS Location
            </h2>
            <p style={{ marginBottom: '8px' }}>{gpsString}</p>
            
              href={`https://www.google.com/maps?q=${inspection.gps_latitude},${inspection.gps_longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}
            >
              View on Google Maps
            </a>
          </div>
        )}

        {/* Inspector Signature */}
        {inspection.inspector_signature && (
          <div className="detail-section">
            <h2>
              <PenTool size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
              Inspector Signature
            </h2>
            <div style={{
              border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px',
              background: '#f8fafc', display: 'inline-block'
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

        {/* Supervisor Signature */}
        {inspection.supervisor_signature && (
          <div className="detail-section">
            <h2>
              <PenTool size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
              Supervisor Signature
            </h2>
            <div style={{
              border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px',
              background: '#f8fafc', display: 'inline-block'
            }}>
              <img
                src={inspection.supervisor_signature}
                alt="Supervisor Signature"
                style={{ maxWidth: '300px', maxHeight: '120px', display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Photos */}
        {inspection.photos?.length > 0 && (
          <div className="detail-section">
            <h2>
              <Camera size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
              Photos ({inspection.photos.length})
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '12px'
            }}>
              {inspection.photos.map((photo, idx) => (
                <div key={idx}>
                  <img
                    src={photo.photo_data}
                    alt={photo.caption || `Photo ${idx + 1}`}
                    onClick={() => setExpandedPhoto(photo)}
                    style={{
                      width: '100%', height: '160px', objectFit: 'cover',
                      borderRadius: '8px', cursor: 'pointer',
                      border: '1px solid #e2e8f0', display: 'block'
                    }}
                  />
                  {photo.caption && (
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                      {photo.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {inspection.notes && (
          <div className="detail-section">
            <h2>Additional Notes</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: '#4b5563' }}>{inspection.notes}</p>
          </div>
        )}

        {/* Review Section */}
        {inspection.status === 'submitted' && ['supervisor', 'admin'].includes(user.role) && (
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

      {/* Lightbox */}
      {expandedPhoto && (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
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
                position: 'absolute', top: '-12px', right: '-12px',
                background: 'white', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer',
                fontSize: '16px', fontWeight: 'bold', color: '#374151'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default InspectionDetail;
