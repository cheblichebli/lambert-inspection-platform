import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionsAPI } from '../api';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

const InspectionDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const data = typeof inspection.data === 'string' ? JSON.parse(inspection.data) : inspection.data;

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="btn btn-secondary">
        <ArrowLeft size={20} /> Back
      </button>

      <div className="inspection-detail">
        <h1>{inspection.template_title}</h1>
        <span className={`badge badge-${inspection.status}`}>{inspection.status}</span>
        
        <div className="detail-section">
          <h2>Information</h2>
          <p><strong>Inspector:</strong> {inspection.inspector_name}</p>
          <p><strong>Location:</strong> {inspection.location || 'N/A'}</p>
          <p><strong>Equipment:</strong> {inspection.equipment_id || 'N/A'}</p>
        </div>

        <div className="detail-section">
          <h2>Form Data</h2>
          {Object.entries(data).map(([key, value]) => (
            <p key={key}><strong>{key}:</strong> {value?.toString()}</p>
          ))}
        </div>

        {inspection.photos?.length > 0 && (
          <div className="detail-section">
            <h2>Photos</h2>
            <div className="photos-grid">
              {inspection.photos.map((photo, idx) => (
                <img key={idx} src={photo.photo_data} alt={`Photo ${idx + 1}`} />
              ))}
            </div>
          </div>
        )}

        {inspection.status === 'submitted' && ['supervisor', 'admin'].includes(user.role) && (
          <div className="review-section">
            <h2>Review</h2>
            <button onClick={() => setReviewStatus('approved')} className="btn btn-success">
              <CheckCircle size={20} /> Approve
            </button>
            <button onClick={() => setReviewStatus('rejected')} className="btn btn-error">
              <XCircle size={20} /> Reject
            </button>
            <textarea
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Comments..."
              className="form-control"
            />
            <button onClick={handleReview} disabled={!reviewStatus || submitting} className="btn btn-primary">
              Submit Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectionDetail;
