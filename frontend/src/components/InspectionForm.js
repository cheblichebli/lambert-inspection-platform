import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formsAPI, inspectionsAPI } from '../api';
import { Camera, X, Upload, Save, Send } from 'lucide-react';
import GPSLocation from './GPSLocation';
import SignaturePad from './SignaturePad';
import BarcodeScanner from './BarcodeScanner';

const InspectionForm = ({ user }) => {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [photos, setPhotos] = useState([]);
  const [location, setLocation] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState('');
  const [gpsLocation, setGpsLocation] = useState(null);
  const [inspectorSignature, setInspectorSignature] = useState(null);
  const [scannedCodes, setScannedCodes] = useState([]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadForms();
  }, []);

  useEffect(() => {
    if (selectedFormId) {
      loadFormTemplate();
    }
  }, [selectedFormId]);

  const loadForms = async () => {
    try {
      const data = await formsAPI.getAll(null, true);
      setForms(data);
      if (data.length > 0 && !selectedFormId) {
        setSelectedFormId(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error loading forms:', error);
      setError('Failed to load form templates');
    }
  };

  const loadFormTemplate = async () => {
    try {
      const form = await formsAPI.getById(selectedFormId);
      setSelectedForm(form);
      
      // Initialize form data
      const fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields;
      const initialData = {};
      fields.forEach(field => {
        initialData[field.id] = field.type === 'checkbox' ? false : '';
      });
      setFormData(initialData);
    } catch (error) {
      console.error('Error loading form template:', error);
      setError('Failed to load form template');
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Cannot access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    // Unlimited photos - no limit check

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setPhotos(prev => [...prev, { data: photoData, caption: '' }]);
      stopCamera();
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Unlimited photos - no limit check

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos(prev => [...prev, { data: reader.result, caption: '' }]);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (!selectedForm) {
      setError('Please select a form template');
      return false;
    }

    const fields = typeof selectedForm.fields === 'string' 
      ? JSON.parse(selectedForm.fields) 
      : selectedForm.fields;
    
    for (const field of fields) {
      if (field.required && !formData[field.id]) {
        setError(`${field.label} is required`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (status = 'draft') => {
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const inspectionData = {
        templateId: parseInt(selectedFormId),
        data: formData,
        location,
        equipmentId,
        notes,
        photos,
        status,
        gpsLatitude: gpsLocation?.latitude,
        gpsLongitude: gpsLocation?.longitude,
        gpsAccuracy: gpsLocation?.accuracy,
        inspectorSignature,
        scannedCodes
      };

      await inspectionsAPI.create(inspectionData);
      
      alert(
        status === 'submitted' 
          ? 'Inspection submitted successfully!' 
          : 'Inspection saved as draft'
      );
      navigate('/inspections');
    } catch (error) {
      console.error('Error saving inspection:', error);
      setError(error.message || 'Failed to save inspection');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field) => {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={field.required}
            className="form-control"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={field.required}
            className="form-control"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={field.required}
            rows={4}
            className="form-control"
          />
        );

      case 'select':
        return (
          <select
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="form-control"
          >
            <option value="">Select...</option>
            {field.options?.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData[field.id] || false}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              required={field.required}
            />
            <span>{field.label}</span>
          </label>
        );

      case 'radio':
        return (
          <div className="radio-group">
            {field.options?.map((option, idx) => (
              <label key={idx} className="radio-label">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={formData[field.id] === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  required={field.required}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="form-control"
          />
        );

      default:
        return <p className="text-muted">Unsupported field type</p>;
    }
  };

  return (
    <div className="inspection-form-page">
      <div className="page-header">
        <h1>New Inspection</h1>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError('')} className="btn-close">×</button>
        </div>
      )}

      <div className="form-container">
        <div className="form-section">
          <h2>Select Form Template</h2>
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="form-control"
            disabled={loading}
          >
            {forms.map(form => (
              <option key={form.id} value={form.id}>
                {form.title} ({form.category})
              </option>
            ))}
          </select>
        </div>

        {selectedForm && (
          <>
            <div className="form-section">
              <h2>Inspection Details</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Building A, Floor 3"
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label>Equipment ID</label>
                  <input
                    type="text"
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    placeholder="e.g., EQ-001"
                    className="form-control"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2>Inspection Form</h2>
              {(typeof selectedForm.fields === 'string' 
                ? JSON.parse(selectedForm.fields) 
                : selectedForm.fields
              ).map((field) => (
                <div key={field.id} className="form-group">
                  {field.type !== 'checkbox' && (
                    <label>
                      {field.label}
                      {field.required && <span className="required">*</span>}
                    </label>
                  )}
                  {renderField(field)}
                </div>
              ))}
            </div>

            <div className="form-section">
              <h2>Photos ({photos.length}) <span style={{ fontSize: '14px', color: '#4a9d5f', fontWeight: 'normal' }}>✨ Unlimited</span></h2>
              <div className="photo-controls">
                <button
                  type="button"
                  onClick={startCamera}
                  className="btn btn-secondary"
                  disabled={showCamera}
                >
                  <Camera size={20} />
                  Take Photo
                </button>

                <label className="btn btn-secondary">
                  <Upload size={20} />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {showCamera && (
                <div className="camera-container">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="camera-preview"
                  />
                  <div className="camera-controls">
                    <button onClick={capturePhoto} className="btn btn-primary">
                      Capture
                    </button>
                    <button onClick={stopCamera} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="photos-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-item">
                    <img src={photo.data} alt={`Photo ${index + 1}`} />
                    <button
                      onClick={() => removePhoto(index)}
                      className="btn-remove"
                    >
                      <X size={16} />
                    </button>
                    <input
                      type="text"
                      value={photo.caption}
                      onChange={(e) => {
                        const newPhotos = [...photos];
                        newPhotos[index].caption = e.target.value;
                        setPhotos(newPhotos);
                      }}
                      placeholder="Add caption..."
                      className="photo-caption"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* GPS Location Component */}
            <div className="form-section">
              <GPSLocation 
                onLocationCapture={setGpsLocation}
                disabled={loading}
              />
            </div>

            {/* Barcode/QR Scanner Component */}
            <div className="form-section">
              <BarcodeScanner
                onScan={setScannedCodes}
                disabled={loading}
              />
            </div>

            {/* Digital Signature Component */}
            <div className="form-section">
              <SignaturePad
                label="Inspector Signature"
                onSignatureCapture={setInspectorSignature}
                disabled={loading}
              />
            </div>

            <div className="form-section">
              <h2>Additional Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes or observations..."
                rows={4}
                className="form-control"
              />
            </div>

            <div className="form-actions">
              <button
                onClick={() => handleSubmit('draft')}
                className="btn btn-secondary"
                disabled={loading}
              >
                <Save size={20} />
                Save Draft
              </button>

              <button
                onClick={() => handleSubmit('submitted')}
                className="btn btn-primary"
                disabled={loading}
              >
                <Send size={20} />
                {loading ? 'Submitting...' : 'Submit Inspection'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InspectionForm;
