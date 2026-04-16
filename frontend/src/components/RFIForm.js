import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rfiAPI, usersAPI, projectsAPI, uploadAPI } from '../api';
import { ArrowLeft, Upload, X, FileText } from 'lucide-react';

const PHASES = [
  'Builders Work', '1st Fix', '2nd Fix', '3rd Fix',
  'Pre-commissioning', 'Commissioning', 'Snagging & De-snagging', 'Final Submission'
];
const TC_LEVELS = ['L0', 'L1', 'L2a', 'L2b', 'L3a', 'L3b', 'L4', 'L5'];
const TYPES = ['Mechanical', 'Electrical'];
const SYSTEMS = {
  Mechanical: ['HVAC', 'Plumbing', 'Fire Fighting', 'VRV System', 'Mechanical', 'Other'],
  Electrical: ['Power', 'Lighting', 'ELV', 'Lightning', 'Earthing', 'BMS', 'Other'],
};

const RFIForm = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    type: '', phase_of_work: '', tc_level: '', system: '', sub_system: '',
    drawing_no: '', as_built: false, floor: '', location: '', coordinates: '',
    description: '', test_results: '', assigned_to: '', project_id: '',
  });
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [drawingFile, setDrawingFile] = useState(null);
  const [drawingUploading, setDrawingUploading] = useState(false);
  const [existingDrawing, setExistingDrawing] = useState(null);

  useEffect(() => {
    Promise.all([
      usersAPI.getAll().then(all => setUsers(all.filter(u => u.is_active))),
      projectsAPI.getAll().then(setProjects),
    ]).catch(() => {});

    if (isEdit) {
      rfiAPI.getById(id).then(data => {
        setForm({
          type: data.type || '',
          phase_of_work: data.phase_of_work || '',
          tc_level: data.tc_level || '',
          system: data.system || '',
          sub_system: data.sub_system || '',
          drawing_no: data.drawing_no || '',
          as_built: data.as_built || false,
          floor: data.floor || '',
          location: data.location || '',
          coordinates: data.coordinates || '',
          description: data.description || '',
          test_results: data.test_results || '',
          assigned_to: data.assigned_to || '',
          project_id: data.project_id || '',
        });
        if (data.drawing_filename) {
          setExistingDrawing({ filename: data.drawing_filename, url: data.drawing_data });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id, isEdit]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.type) e.type = 'Required';
    if (!form.phase_of_work) e.phase_of_work = 'Required';
    if (!form.description) e.description = 'Required';
    if (!form.project_id) e.project_id = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDrawingSelect = (e) => {
    const file = e.target.files[0];
    if (file) setDrawingFile(file);
    e.target.value = '';
  };

  const handleSave = async (submitAfter = false) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      let drawingData = form.drawing_data;
      let drawingFilename = form.drawing_filename;

      // Upload drawing to R2 if a new file was selected
      if (drawingFile) {
        setDrawingUploading(true);
        const uploaded = await uploadAPI.upload(drawingFile, 'rfi-drawings');
        drawingData = uploaded.url;
        drawingFilename = uploaded.filename;
        setDrawingUploading(false);
      }

      const payload = {
        ...form,
        drawing_data: drawingData || null,
        drawing_filename: drawingFilename || null,
        assigned_to: form.assigned_to || null,
        project_id: form.project_id || null,
        tc_level: form.tc_level || null,
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
      setDrawingUploading(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const qcEngineers = users.filter(u => ['admin', 'supervisor'].includes(u.role));
  const systemOptions = SYSTEMS[form.type] || [];
  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const reqStar = <span style={{ color: '#ef4444' }}>*</span>;
  const errStyle = { fontSize: '0.75rem', color: '#dc2626', marginTop: '3px' };
  const sectionHeader = (title) => (
    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
      {title}
    </p>
  );

  return (
    <div className="page-container" style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0 }}>{isEdit ? 'Edit RFI' : 'New Request for Inspection'}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '2px 0 0' }}>
            {projects.find(p => p.id === parseInt(form.project_id))?.name || 'Select a project below'}
          </p>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Project */}
        <div>
          {sectionHeader('Project')}
          <div>
            <label style={labelStyle}>Project {reqStar}</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="form-control" style={{ borderColor: errors.project_id ? '#ef4444' : undefined }}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {errors.project_id && <p style={errStyle}>{errors.project_id}</p>}
          </div>
        </div>

        {/* Classification */}
        <div>
          {sectionHeader('RFI Classification')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Type {reqStar}</label>
              <select value={form.type} onChange={e => { set('type', e.target.value); set('system', ''); }} className="form-control" style={{ borderColor: errors.type ? '#ef4444' : undefined }}>
                <option value="">Select type...</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.type && <p style={errStyle}>{errors.type}</p>}
            </div>
            <div>
              <label style={labelStyle}>Phase of Work {reqStar}</label>
              <select value={form.phase_of_work} onChange={e => set('phase_of_work', e.target.value)} className="form-control" style={{ borderColor: errors.phase_of_work ? '#ef4444' : undefined }}>
                <option value="">Select phase...</option>
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.phase_of_work && <p style={errStyle}>{errors.phase_of_work}</p>}
            </div>
            <div>
              <label style={labelStyle}>T&C Level</label>
              <select value={form.tc_level} onChange={e => set('tc_level', e.target.value)} className="form-control">
                <option value="">Select level...</option>
                {TC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>System</label>
              <select value={form.system} onChange={e => set('system', e.target.value)} className="form-control" disabled={!form.type}>
                <option value="">Select system...</option>
                {systemOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sub-System</label>
              <input type="text" value={form.sub_system} onChange={e => set('sub_system', e.target.value)} className="form-control" placeholder="e.g. Condensate Drain, DB-01..." />
            </div>
            <div>
              <label style={labelStyle}>Drawing No.</label>
              <input type="text" value={form.drawing_no} onChange={e => set('drawing_no', e.target.value)} className="form-control" placeholder="e.g. QLT-SVA-A-DR-20-2001" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '24px' }}>
              <input type="checkbox" id="as_built" checked={form.as_built} onChange={e => set('as_built', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#4a9d5f' }} />
              <label htmlFor="as_built" style={{ ...labelStyle, margin: 0, textTransform: 'none', fontSize: '0.875rem' }}>As-Built</label>
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          {sectionHeader('Location & Site Details')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Floor</label>
              <input type="text" value={form.floor} onChange={e => set('floor', e.target.value)} className="form-control" placeholder="e.g. Ground Floor, 3rd Floor..." />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className="form-control" placeholder="e.g. Left Wing, Zone B..." />
            </div>
            <div>
              <label style={labelStyle}>Grid Reference / Coordinates</label>
              <input type="text" value={form.coordinates} onChange={e => set('coordinates', e.target.value)} className="form-control" placeholder="e.g. (10-14)/(L-N)" />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          {sectionHeader('Inspection Details')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Description of Works {reqStar}</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="form-control" rows={4}
                placeholder="Describe the installation or NDT test that is ready for QC inspection..."
                style={{ borderColor: errors.description ? '#ef4444' : undefined }}
              />
              {errors.description && <p style={errStyle}>{errors.description}</p>}
            </div>
            <div>
              <label style={labelStyle}>Test Results / Supporting Data</label>
              <textarea value={form.test_results} onChange={e => set('test_results', e.target.value)} className="form-control" rows={3} placeholder="Include any test results, measurements, or commissioning data..." />
            </div>
          </div>
        </div>

        {/* Drawing */}
        <div>
          {sectionHeader('Drawing Attachment')}
          {existingDrawing && !drawingFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '10px' }}>
              <FileText size={18} style={{ color: '#4a9d5f' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '0.875rem' }}>{existingDrawing.filename}</p>
                <a href={existingDrawing.url} target="_blank" rel="noreferrer" style={{ color: '#4a9d5f', fontSize: '0.75rem' }}>View current drawing</a>
              </div>
              <button onClick={() => setExistingDrawing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
          )}
          {drawingFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📎</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '0.875rem' }}>{drawingFile.name}</p>
                <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '0.75rem' }}>{(drawingFile.size / 1024).toFixed(1)} KB — will upload on save</p>
              </div>
              <button onClick={() => setDrawingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>
              <Upload size={20} style={{ color: '#4a9d5f', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>Upload Drawing</p>
                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>PDF or image — max 20MB</p>
              </div>
              <input type="file" accept="image/*,application/pdf" onChange={handleDrawingSelect} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Assignment */}
        <div>
          {sectionHeader('Assignment')}
          <div>
            <label style={labelStyle}>Assign QC Engineer</label>
            <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="form-control">
              <option value="">Select QC Engineer...</option>
              {qcEngineers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>Cancel</button>
          <button onClick={() => handleSave(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>
            {submitting && !drawingUploading ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
            {drawingUploading ? 'Uploading...' : submitting ? 'Submitting...' : 'Save & Submit to QC'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RFIForm;
