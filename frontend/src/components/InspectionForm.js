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
  const [error, setError] = useState('');
  const [gpsLocation, setGpsLocation] = useState(null);
  const [inspectorSignature, setInspectorSignature] = useState(null);
  const [scannedCodes, setScannedCodes] = useState([]);

  // Native camera input refs — one for main photos, one per inline field
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

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
      const fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields;
      const initialData = {};
      fields.forEach(field => {
        if (field.type === 'checkbox') {
          initialData[field.id] = false;
        } else if (field.type === 'table') {
          // Seed with defaultRows if present, otherwise one blank row
          initialData[field.id] = (field.defaultRows && field.defaultRows.length > 0)
            ? field.defaultRows.map(function(dr) {
                // defaultRows are objects keyed by column index or label — normalise to index-keyed
                return Object.assign({}, dr);
              })
            : [{}];
        } else {
          initialData[field.id] = '';
        }
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

  // ── Native camera/upload for main photos section ──────────────────────────

  const readFileAsDataURL = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  };

  const handleCameraCapture = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const data = await readFileAsDataURL(file);
      setPhotos(prev => [...prev, { data, caption: '' }]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const data = await readFileAsDataURL(file);
      setPhotos(prev => [...prev, { data, caption: '' }]);
    }
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // ── Inline photo field handlers ───────────────────────────────────────────

  const handleInlineCameraCapture = async (e, fieldId) => {
    const files = Array.from(e.target.files);
    const currentPhotos = formData[fieldId] || [];
    const newPhotos = [...currentPhotos];
    for (const file of files) {
      const data = await readFileAsDataURL(file);
      newPhotos.push({ data, caption: '' });
    }
    handleFieldChange(fieldId, newPhotos);
    e.target.value = '';
  };

  const handleInlineFileUpload = async (e, fieldId) => {
    const files = Array.from(e.target.files);
    const currentPhotos = formData[fieldId] || [];
    const newPhotos = [...currentPhotos];
    for (const file of files) {
      const data = await readFileAsDataURL(file);
      newPhotos.push({ data, caption: '' });
    }
    handleFieldChange(fieldId, newPhotos);
    e.target.value = '';
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
    if (!validateForm()) return;
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
      alert(status === 'submitted' ? 'Inspection submitted successfully!' : 'Inspection saved as draft');
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
              <option key={idx} value={option}>{option}</option>
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

      case 'photo':
        return (
          <div className="inline-photo-field">
            <div className="photo-controls">

              {/* Take Photo — opens native camera on iOS/Android */}
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <Camera size={20} />
                Take Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleInlineCameraCapture(e, field.id)}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Upload Photo — opens photo library */}
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={20} />
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleInlineFileUpload(e, field.id)}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div className="inline-photos-grid">
              {(formData[field.id] || []).map((photo, photoIndex) => (
                <div key={photoIndex} className="photo-item">
                  <img src={photo.data} alt={`Photo ${photoIndex + 1}`} />
                  <button
                    type="button"
                    onClick={() => {
                      const currentPhotos = formData[field.id] || [];
                      handleFieldChange(field.id, currentPhotos.filter((_, i) => i !== photoIndex));
                    }}
                    className="remove-photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {(formData[field.id] || []).length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '10px' }}>
                No photos added yet. Click "Take Photo" or "Upload Photo" above.
              </p>
            )}
          </div>
        );

      case 'table':
        var columns = field.columns || [];
        // Column format: "type:Label" or "GroupName > type:Label"
        var getColGroup = function(col) {
          return col.includes(' > ') ? col.split(' > ')[0].trim() : null;
        };
        var getColCore = function(col) {
          return col.includes(' > ') ? col.split(' > ')[1].trim() : col;
        };
        var getColType = function(col) {
          var core = getColCore(col);
          return core.startsWith('check:') ? 'check' : core.startsWith('date:') ? 'date' : 'text';
        };
        var getColLabel = function(col) {
          return getColCore(col).replace(/^(text:|check:|date:)/, '');
        };

        // Build group header row if any columns have groups
        var hasGroups = columns.some(function(col) { return getColGroup(col) !== null; });
        var groupHeaders = [];
        if (hasGroups) {
          var gi = 0;
          while (gi < columns.length) {
            var grp = getColGroup(columns[gi]);
            var span = 1;
            while (gi + span < columns.length && getColGroup(columns[gi + span]) === grp) span++;
            groupHeaders.push({ label: grp || '', span: span });
            gi += span;
          }
        }

        var rows = (Array.isArray(formData[field.id]) && formData[field.id].length > 0) ? formData[field.id] : [{}];

        var updateCell = function(rowIdx, colIdx, val) {
          var current = Array.isArray(formData[field.id]) ? formData[field.id] : [{}];
          var newRows = current.map(function(r) { return Object.assign({}, r); });
          if (!newRows[rowIdx]) newRows[rowIdx] = {};
          newRows[rowIdx][colIdx] = val;
          handleFieldChange(field.id, newRows);
        };

        var addRow = function() {
          var current = Array.isArray(formData[field.id]) ? formData[field.id] : [{}];
          handleFieldChange(field.id, [...current, {}]);
        };

        var removeRow = function(rowIdx) {
          var current = Array.isArray(formData[field.id]) ? formData[field.id] : [{}];
          if (current.length <= 1) return;
          handleFieldChange(field.id, current.filter(function(_, i) { return i !== rowIdx; }));
        };

        return (
          <div style={{ overflowX: 'auto', marginTop: '8px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem', tableLayout: 'fixed' }}>
              <thead>
                {hasGroups && (
                  <tr>
                    {groupHeaders.map(function(gh, ghi) {
                      return (
                        <th key={ghi} colSpan={gh.span} style={{
                          border: '1px solid #e2e8f0', padding: '6px 10px',
                          background: '#e2e8f0', color: '#1e293b', fontWeight: 700,
                          textAlign: 'center', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>
                          {gh.label}
                        </th>
                      );
                    })}
                    <th style={{ border: '1px solid #e2e8f0', background: '#e2e8f0', width: '36px' }}></th>
                  </tr>
                )}
                <tr>
                  {columns.map(function(col, ci) {
                    return (
                      <th key={ci} style={{
                        border: '1px solid #e2e8f0',
                        padding: '6px 8px',
                        background: '#f1f5f9',
                        color: '#374151',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        width: getColType(col) === 'check'
                          ? '48px'
                          : (ci === 0 ? '42px' : undefined),
                        textAlign: getColType(col) === 'check' ? 'center' : 'left',
                        wordBreak: 'break-word'
                      }}>
                        {getColLabel(col)}
                      </th>
                    );
                  })}
                  <th style={{ border: '1px solid #e2e8f0', padding: '8px', background: '#f1f5f9', width: '36px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(function(row, ri) {
                  return (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                      {columns.map(function(col, ci) {
                        var colType = getColType(col);
                        var cellVal = row[ci];
                        return (
                          <td key={ci} style={{ border: '1px solid #e2e8f0', padding: colType === 'check' ? '4px 2px' : '4px 6px', textAlign: colType === 'check' ? 'center' : 'left', width: colType === 'check' ? '48px' : (ci === 0 ? '42px' : undefined), overflow: 'hidden', wordBreak: 'break-word' }}>
                            {colType === 'check' && (
                              <input
                                type="checkbox"
                                checked={cellVal === true || cellVal === 'true'}
                                onChange={function(e) { updateCell(ri, ci, e.target.checked); }}
                                style={{ width: '16px', height: '16px', accentColor: '#4a9d5f', cursor: 'pointer' }}
                              />
                            )}
                            {colType === 'date' && (
                              <input
                                type="date"
                                value={cellVal || ''}
                                onChange={function(e) { updateCell(ri, ci, e.target.value); }}
                                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', width: '120px' }}
                              />
                            )}
                            {colType === 'text' && (
                              <input
                                type="text"
                                value={cellVal || ''}
                                onChange={function(e) { updateCell(ri, ci, e.target.value); }}
                                style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', padding: '2px 4px', minWidth: 0 }}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={function() { removeRow(ri); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              onClick={addRow}
              style={{
                marginTop: '8px', padding: '6px 14px', border: '1px dashed #4a9d5f',
                borderRadius: '6px', background: 'white', cursor: 'pointer',
                fontSize: '0.8rem', color: '#4a9d5f', fontWeight: 600
              }}
            >
              + Add Row
            </button>
          </div>
        );

      case 'note':
        return (
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d',
            borderLeft: '4px solid #f59e0b', borderRadius: '6px',
            padding: '12px 16px', margin: '4px 0'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>📌</span>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {field.placeholder || field.label}
              </p>
            </div>
          </div>
        );

      case 'signatories': {
        var roles = field.options && field.options.length > 0 ? field.options : ['Signatory'];
        var sigData = formData[field.id] || roles.map(function(r) { return { role: r, name: '', signature: '', date: '' }; });

        var updateSig = function(rowIdx, key, val) {
          var newSigs = sigData.map(function(s) { return Object.assign({}, s); });
          newSigs[rowIdx][key] = val;
          handleFieldChange(field.id, newSigs);
        };

        return (
          <div style={{ overflowX: 'auto', marginTop: '8px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Signature', 'Date'].map(function(h) {
                    return (
                      <th key={h} style={{
                        border: '1px solid #e2e8f0', padding: '8px 12px',
                        background: '#f1f5f9', color: '#374151', fontWeight: 600, textAlign: 'left'
                      }}>{h}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {roles.map(function(role, ri) {
                  var row = sigData[ri] || { role: role, name: '', signature: '', date: '' };
                  return (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px 6px' }}>
                        <input type="text" value={row.name || ''} onChange={function(e) { updateSig(ri, 'name', e.target.value); }}
                          style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', padding: '2px 4px' }}
                          placeholder="Full name" />
                      </td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', color: '#374151', fontWeight: 500 }}>
                        {role}
                      </td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px 6px' }}>
                        <input type="text" value={row.signature || ''} onChange={function(e) { updateSig(ri, 'signature', e.target.value); }}
                          style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', padding: '2px 4px', fontFamily: 'cursive' }}
                          placeholder="Signature" />
                      </td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px 6px' }}>
                        <input type="date" value={row.date || ''} onChange={function(e) { updateSig(ri, 'date', e.target.value); }}
                          style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', width: '130px' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

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

            {/* Main Photos Section */}
            <div className="form-section">
              <h2>
                Photos ({photos.length}){' '}
                <span style={{ fontSize: '14px', color: '#4a9d5f', fontWeight: 'normal' }}>✨ Unlimited</span>
              </h2>
              <div className="photo-controls">

                {/* Take Photo — native camera on iOS/Android */}
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <Camera size={20} />
                  Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Upload from library */}
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <Upload size={20} />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div className="photos-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-item">
                    <img src={photo.data} alt={`Photo ${index + 1}`} />
                    <button onClick={() => removePhoto(index)} className="btn-remove">
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

            <div className="form-section">
              <GPSLocation onLocationCapture={setGpsLocation} disabled={loading} />
            </div>

            <div className="form-section">
              <BarcodeScanner onScan={setScannedCodes} disabled={loading} />
            </div>

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
