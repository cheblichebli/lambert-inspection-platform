import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rfiAPI, usersAPI } from '../api';
import { ArrowLeft, Upload, X } from 'lucide-react';

const STAGES = ['1st Fix', '2nd Fix', 'Final Finishing'];
const TYPES  = ['Mechanical', 'Electrical'];

const RFIForm = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    type: '',
    stage: '',
    system: '',
    sub_system: '',
    location: '',
    coordinates: '',
    test_results: '',
    description: '',
    drawing_data: '',
    drawing_filename: '',
    assigned_to: '',
    project: '10 Queens Drive',
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    usersAPI.getAll()
      .then(all => setUsers(all.filter(u => u.is_active)))
      .catch(() => {});

    if (isEdit) {
      rfiAPI.getById(id).then(data => {
        setForm({
          type:              data.type || '',
          stage:             data.stage || '',
          system:            data.system || '',
          sub_system:        data.sub_system || '',
          location:          data.location || '',
          coordinates:       data.coordinates || '',
          test_results:      data.test_results || '',
          description:       data.description || '',
          drawing_data:      data.drawing_data || '',
          drawing_filename:  data.drawing_filename || '',
          assigned_to:       data.assigned_to || '',
          project:           data.project || '10 Queens Drive',
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id, isEdit]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleDrawing = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      set('drawing_data', reader.result);
      set('drawing_filename', file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const validate = () => {
    const e = {};
    if (!form.type)  e.type  = 'Type is required';
    if (!form.stage) e.stage = 'Stage is required';
    if (!form.description) e.description = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (submitAfter = false) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to || null,
      };
      let saved;
      if (isEdit) {
        saved = await rfiAPI.update(id, payload);
      } else {
        saved = await rfiAPI.create(payload);
      }
      if (submitAfter) {
        await rfiAPI.update(saved.id, { status: 'submitted' });
      }
      navigate(`/rfi/${saved.id}`);
    } catch (err) {
      alert('Failed to save RFI. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const qcEngineers = users.filter(u => ['admin', 'supervisor'].includes(u.role));
  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const reqStar = <span style={{ color: '#ef4444' }}>*</span>;
  const errStyle = { fontSize: '0.75rem', color: '#dc2626', marginTop: '3px' };

  return (
    <div className="page-container" style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0 }}>{isEdit ? 'Edit RFI' : 'New Request for Inspection'}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '2px 0 0' }}>Project: {form.project}</p>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Section: RFI Classification */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
            RFI Classification
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Type {reqStar}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="form-control" style={{ borderColor: errors.type ? '#ef4444' : undefined }}>
                <option value="">Select type...</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.type && <p style={errStyle}>{errors.type}</p>}
            </div>
            <div>
              <label style={labelStyle}>Stage {reqStar}</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)} className="form-control" style={{ borderColor: errors.stage ? '#ef4444' : undefined }}>
                <option value="">Select stage...</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.stage && <p style={errStyle}>{errors.stage}</p>}
            </div>
            <div>
              <label style={labelStyle}>System</label>
              <input type="text" value={form.system} onChange={e => set('system', e.target.value)} className="form-control" placeholder="e.g. HVAC, Plumbing, LV..." />
            </div>
            <div>
              <label style={labelStyle}>Sub-System</label>
              <input type="text" value={form.sub_system} onChange={e => set('sub_system', e.target.value)} className="form-control" placeholder="e.g. Condensate Drain, DB-01..." />
            </div>
          </div>
        </div>

        {/* Section: Location */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
            Location & Site Details
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Location</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className="form-control" placeholder="e.g. Floor 3, Zone B..." />
            </div>
            <div>
              <label style={labelStyle}>Coordinates / Grid Ref</label>
              <input type="text" value={form.coordinates} onChange={e => set('coordinates', e.target.value)} className="form-control" placeholder="e.g. G3-H7, Axis 4-6..." />
            </div>
          </div>
        </div>

        {/* Section: Description */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
            Inspection Details
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Description — What is ready for inspection {reqStar}</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="form-control"
                rows={4}
                placeholder="Describe the installation or NDT test that is ready for QC inspection..."
                style={{ borderColor: errors.description ? '#ef4444' : undefined }}
              />
              {errors.description && <p style={errStyle}>{errors.description}</p>}
            </div>
            <div>
              <label style={labelStyle}>Test Results / Supporting Data</label>
              <textarea
                value={form.test_results}
                onChange={e => set('test_results', e.target.value)}
                className="form-control"
                rows={3}
                placeholder="Include any test results, measurements, or commissioning data..."
              />
            </div>
          </div>
        </div>

        {/* Section: Drawing */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
            Drawing Attachment
          </p>
          {form.drawing_data ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📎</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '0.875rem' }}>{form.drawing_filename || 'Drawing attached'}</p>
                <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '0.75rem' }}>Tap to replace</p>
              </div>
              <button
                onClick={() => { set('drawing_data', ''); set('drawing_filename', ''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>
              <Upload size={20} style={{ color: '#4a9d5f', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>Upload Drawing</p>
                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>PDF or image — highlights the inspection items</p>
              </div>
              <input type="file" accept="image/*,application/pdf" onChange={handleDrawing} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Section: Assignment */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
            Assignment
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Assign QC Engineer</label>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="form-control">
                <option value="">Select QC Engineer...</option>
                {qcEngineers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project</label>
              <input type="text" value={form.project} onChange={e => set('project', e.target.value)} className="form-control" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>
            Cancel
          </button>
          <button onClick={() => handleSave(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Save & Submit to QC'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RFIForm;
