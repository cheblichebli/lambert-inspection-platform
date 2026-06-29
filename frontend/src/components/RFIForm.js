import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rfiAPI, usersAPI, projectsAPI, uploadAPI } from '../api';
import { getMainSystems, getSubSystems, getComponents } from '../mepfSystems';
import { ArrowLeft, Upload, X, FileText, ExternalLink } from 'lucide-react';

const PHASES = [
  'Builders Work', '1st Fix', '2nd Fix', '3rd Fix',
  'Pre-commissioning', 'Commissioning', 'Snagging & De-snagging', 'Final Submission'
];
const TC_LEVELS = ['L0', 'L1', 'L2a', 'L2b', 'L3a', 'L3b', 'L4', 'L5'];
const TYPES = ['Mechanical', 'Electrical'];
const OTHER = '__OTHER__';
const FLOORS = ['B3', 'B2', 'B1', 'GF', ...Array.from({ length: 40 }, (_, i) => `F${i + 1}`)];

// Shared accepted file types across all upload sections:
// PDF, JPEG, PNG, Word (.doc/.docx), Excel (.xls/.xlsx)
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACCEPTED_LABEL = 'PDF, image (JPEG/PNG), Word, or Excel — max 20MB';

// Reusable multi-file upload block.
const MultiFileUpload = ({ files, onChange, folder, title }) => {
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;
    setUploading(true);
    try {
      const uploadedAll = [];
      for (const file of selected) {
        const up = await uploadAPI.upload(file, folder);
        uploadedAll.push({
          filename: up.filename,
          url: up.url,
          key: up.key,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        });
      }
      onChange([...(files || []), ...uploadedAll]);
    } catch (err) {
      alert('One or more files failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (idx) => {
    const f = files[idx];
    if (f.key) { try { await uploadAPI.delete(f.key); } catch (_) {} }
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {(files || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <FileText size={16} style={{ color: '#4a9d5f', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</p>
                {f.size && <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.7rem' }}>{(f.size / 1024).toFixed(1)} KB</p>}
              </div>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a9d5f', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
                View <ExternalLink size={13} />
              </a>
              <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer' }}>
        <Upload size={20} style={{ color: '#4a9d5f', flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>
            {uploading ? 'Uploading...' : title}
          </p>
          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>{ACCEPTED_LABEL} · multiple allowed</p>
        </div>
        <input type="file" multiple accept={ACCEPTED_TYPES} onChange={handleSelect} style={{ display: 'none' }} disabled={uploading} />
      </label>
    </div>
  );
};

const RFIForm = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    type: '', phase_of_work: '', tc_level: '', system: '', sub_system: '', component: '',
    drawing_no: '', as_built: '', floor: '', location: '', coordinates: '',
    description: '', assigned_to: '', project_id: '',
  });
  // "Other" free-text mode flags
  const [systemOther, setSystemOther] = useState(false);
  const [subSystemOther, setSubSystemOther] = useState(false);
  const [componentOther, setComponentOther] = useState(false);
  const [floorOther, setFloorOther] = useState(false);

  const [testResultFiles, setTestResultFiles] = useState([]);
  const [drawingFiles, setDrawingFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

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
          component: data.component || '',
          drawing_no: data.drawing_no || '',
          as_built: data.as_built === true ? 'Yes' : data.as_built === false ? 'No' : '',
          floor: data.floor || '',
          location: data.location || '',
          coordinates: data.coordinates || '',
          description: data.description || '',
          assigned_to: data.assigned_to || '',
          project_id: data.project_id || '',
        });
        // Detect custom ("Other") values so they open in text mode on edit
        const sysList = getMainSystems(data.type || '');
        const sOther = !!data.system && !sysList.includes(data.system);
        const subList = sOther ? [] : getSubSystems(data.type || '', data.system || '');
        const ssOther = !!data.sub_system && (sOther || !subList.includes(data.sub_system));
        const compList = (sOther || ssOther) ? [] : getComponents(data.type || '', data.system || '', data.sub_system || '');
        const cOther = !!data.component && (sOther || ssOther || !compList.includes(data.component));
        setSystemOther(sOther);
        setSubSystemOther(ssOther);
        setComponentOther(cOther);
        setFloorOther(!!data.floor && !FLOORS.includes(data.floor));

        setTestResultFiles(Array.isArray(data.test_result_files) ? data.test_result_files : []);
        let df = Array.isArray(data.drawing_files) ? data.drawing_files : [];
        if (df.length === 0 && data.drawing_data) {
          df = [{ filename: data.drawing_filename || 'Drawing', url: data.drawing_data }];
        }
        setDrawingFiles(df);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id, isEdit]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Cascading selects — picking "Other" flips that level (and forces children) to free-text
  const onTypeChange = (val) => {
    setSystemOther(false); setSubSystemOther(false); setComponentOther(false);
    setForm(f => ({ ...f, type: val, system: '', sub_system: '', component: '' }));
  };
  const onSystemSelect = (val) => {
    if (val === OTHER) {
      setSystemOther(true); setSubSystemOther(false); setComponentOther(false);
      setForm(f => ({ ...f, system: '', sub_system: '', component: '' }));
    } else {
      setSystemOther(false); setSubSystemOther(false); setComponentOther(false);
      setForm(f => ({ ...f, system: val, sub_system: '', component: '' }));
    }
  };
  const onSubSystemSelect = (val) => {
    if (val === OTHER) {
      setSubSystemOther(true); setComponentOther(false);
      setForm(f => ({ ...f, sub_system: '', component: '' }));
    } else {
      setSubSystemOther(false); setComponentOther(false);
      setForm(f => ({ ...f, sub_system: val, component: '' }));
    }
  };
  const onComponentSelect = (val) => {
    if (val === OTHER) {
      setComponentOther(true);
      setForm(f => ({ ...f, component: '' }));
    } else {
      setComponentOther(false);
      setForm(f => ({ ...f, component: val }));
    }
  };
  const onFloorSelect = (val) => {
    if (val === OTHER) { setFloorOther(true); setForm(f => ({ ...f, floor: '' })); }
    else { setFloorOther(false); setForm(f => ({ ...f, floor: val })); }
  };

  const exitSystemOther = () => { setSystemOther(false); setForm(f => ({ ...f, system: '', sub_system: '', component: '' })); };
  const exitSubSystemOther = () => { setSubSystemOther(false); setForm(f => ({ ...f, sub_system: '', component: '' })); };
  const exitComponentOther = () => { setComponentOther(false); setForm(f => ({ ...f, component: '' })); };
  const exitFloorOther = () => { setFloorOther(false); setForm(f => ({ ...f, floor: '' })); };

  const validate = () => {
    const e = {};
    if (!form.project_id) e.project_id = 'Required';
    if (!form.type) e.type = 'Required';
    if (!form.phase_of_work) e.phase_of_work = 'Required';
    if (!form.tc_level) e.tc_level = 'Required';
    if (!form.system) e.system = 'Required';
    if (!form.sub_system) e.sub_system = 'Required';
    if (!form.component) e.component = 'Required';
    if (!form.drawing_no) e.drawing_no = 'Required';
    if (!form.as_built) e.as_built = 'Required';
    if (!form.floor) e.floor = 'Required';
    if (!form.location) e.location = 'Required';
    if (!form.coordinates) e.coordinates = 'Required';
    if (!form.description) e.description = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (submitAfter = false) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        as_built: form.as_built === 'Yes',
        test_result_files: testResultFiles,
        drawing_files: drawingFiles,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        project_id: form.project_id ? parseInt(form.project_id) : null,
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
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const qcEngineers = users.filter(u => ['admin', 'supervisor'].includes(u.role));
  const mainSystemOptions = getMainSystems(form.type);
  const subSystemOptions = getSubSystems(form.type, form.system);
  const componentOptions = getComponents(form.type, form.system, form.sub_system);

  // Effective free-text state (a parent in "Other" forces its children to text)
  const subIsOther = systemOther || subSystemOther;
  const subForcedByParent = systemOther;
  const compIsOther = systemOther || subSystemOther || componentOther;
  const compForcedByParent = systemOther || subSystemOther;

  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const reqStar = <span style={{ color: '#ef4444' }}>*</span>;
  const errStyle = { fontSize: '0.75rem', color: '#dc2626', marginTop: '3px' };
  const toggleLinkStyle = { fontSize: '0.72rem', color: '#4a9d5f', cursor: 'pointer', fontWeight: 600, marginTop: '4px', display: 'inline-block' };
  const sectionHeader = (title) => (
    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
      {title}
    </p>
  );
  const errBorder = (field) => ({ borderColor: errors[field] ? '#ef4444' : undefined });

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
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="form-control" style={errBorder('project_id')}>
              <option value="">Select project...</option>
              {projects.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              <select value={form.type} onChange={e => onTypeChange(e.target.value)} className="form-control" style={errBorder('type')}>
                <option value="">Select type...</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.type && <p style={errStyle}>{errors.type}</p>}
            </div>
            <div>
              <label style={labelStyle}>Phase of Work {reqStar}</label>
              <select value={form.phase_of_work} onChange={e => set('phase_of_work', e.target.value)} className="form-control" style={errBorder('phase_of_work')}>
                <option value="">Select phase...</option>
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.phase_of_work && <p style={errStyle}>{errors.phase_of_work}</p>}
            </div>
            <div>
              <label style={labelStyle}>T&C Level {reqStar}</label>
              <select value={form.tc_level} onChange={e => set('tc_level', e.target.value)} className="form-control" style={errBorder('tc_level')}>
                <option value="">Select level...</option>
                {TC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {errors.tc_level && <p style={errStyle}>{errors.tc_level}</p>}
            </div>
            <div>
              <label style={labelStyle}>As-Built {reqStar}</label>
              <select value={form.as_built} onChange={e => set('as_built', e.target.value)} className="form-control" style={errBorder('as_built')}>
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {errors.as_built && <p style={errStyle}>{errors.as_built}</p>}
            </div>
          </div>
        </div>

        {/* MEPF System Hierarchy */}
        <div>
          {sectionHeader('System Classification')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Main MEPF System */}
            <div>
              <label style={labelStyle}>Main MEPF System {reqStar}</label>
              {systemOther ? (
                <>
                  <input type="text" value={form.system} onChange={e => set('system', e.target.value)} className="form-control" style={errBorder('system')} placeholder="Enter main system..." />
                  <span onClick={exitSystemOther} style={toggleLinkStyle}>↺ Choose from list</span>
                </>
              ) : (
                <select value={form.system} onChange={e => onSystemSelect(e.target.value)} className="form-control" style={errBorder('system')} disabled={!form.type}>
                  <option value="">{form.type ? 'Select main system...' : 'Select type first'}</option>
                  {mainSystemOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  {form.type && <option value={OTHER}>Other (specify)</option>}
                </select>
              )}
              {errors.system && <p style={errStyle}>{errors.system}</p>}
            </div>

            {/* Sub-System Group */}
            <div>
              <label style={labelStyle}>Sub-System Group {reqStar}</label>
              {subIsOther ? (
                <>
                  <input type="text" value={form.sub_system} onChange={e => set('sub_system', e.target.value)} className="form-control" style={errBorder('sub_system')} placeholder="Enter sub-system group..." />
                  {!subForcedByParent && <span onClick={exitSubSystemOther} style={toggleLinkStyle}>↺ Choose from list</span>}
                </>
              ) : (
                <select value={form.sub_system} onChange={e => onSubSystemSelect(e.target.value)} className="form-control" style={errBorder('sub_system')} disabled={!form.system}>
                  <option value="">{form.system ? 'Select sub-system...' : 'Select main system first'}</option>
                  {subSystemOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  {form.system && <option value={OTHER}>Other (specify)</option>}
                </select>
              )}
              {errors.sub_system && <p style={errStyle}>{errors.sub_system}</p>}
            </div>

            {/* Specific Component */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Specific Component / Area of Inspection {reqStar}</label>
              {compIsOther ? (
                <>
                  <input type="text" value={form.component} onChange={e => set('component', e.target.value)} className="form-control" style={errBorder('component')} placeholder="Enter specific component..." />
                  {!compForcedByParent && <span onClick={exitComponentOther} style={toggleLinkStyle}>↺ Choose from list</span>}
                </>
              ) : (
                <select value={form.component} onChange={e => onComponentSelect(e.target.value)} className="form-control" style={errBorder('component')} disabled={!form.sub_system}>
                  <option value="">{form.sub_system ? 'Select component...' : 'Select sub-system first'}</option>
                  {componentOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  {form.sub_system && <option value={OTHER}>Other (specify)</option>}
                </select>
              )}
              {errors.component && <p style={errStyle}>{errors.component}</p>}
            </div>

            {/* Drawing No. — now mandatory */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Drawing No. {reqStar}</label>
              <input type="text" value={form.drawing_no} onChange={e => set('drawing_no', e.target.value)} className="form-control" style={errBorder('drawing_no')} placeholder="e.g. QLT-SVA-A-DR-20-2001" />
              {errors.drawing_no && <p style={errStyle}>{errors.drawing_no}</p>}
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          {sectionHeader('Location & Site Details')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Floor {reqStar}</label>
              {floorOther ? (
                <>
                  <input type="text" value={form.floor} onChange={e => set('floor', e.target.value)} className="form-control" style={errBorder('floor')} placeholder="Enter floor..." />
                  <span onClick={exitFloorOther} style={toggleLinkStyle}>↺ Choose from list</span>
                </>
              ) : (
                <select value={form.floor} onChange={e => onFloorSelect(e.target.value)} className="form-control" style={errBorder('floor')}>
                  <option value="">Select floor...</option>
                  {FLOORS.map(fl => <option key={fl} value={fl}>{fl}</option>)}
                  <option value={OTHER}>Other (specify)</option>
                </select>
              )}
              {errors.floor && <p style={errStyle}>{errors.floor}</p>}
            </div>
            <div>
              <label style={labelStyle}>Location {reqStar}</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className="form-control" style={errBorder('location')} placeholder="e.g. Left Wing, Zone B..." />
              {errors.location && <p style={errStyle}>{errors.location}</p>}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Grid Reference / Coordinates {reqStar}</label>
              <input type="text" value={form.coordinates} onChange={e => set('coordinates', e.target.value)} className="form-control" style={errBorder('coordinates')} placeholder="e.g. (10-14)/(L-N)" />
              {errors.coordinates && <p style={errStyle}>{errors.coordinates}</p>}
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
                style={errBorder('description')}
              />
              {errors.description && <p style={errStyle}>{errors.description}</p>}
            </div>
            <div>
              <label style={labelStyle}>Test Results / Supporting Data</label>
              <MultiFileUpload
                files={testResultFiles}
                onChange={setTestResultFiles}
                folder="rfi-test-results"
                title="Upload Test Results / Supporting Data"
              />
            </div>
          </div>
        </div>

        {/* Drawings */}
        <div>
          {sectionHeader('Drawing Attachments')}
          <MultiFileUpload
            files={drawingFiles}
            onChange={setDrawingFiles}
            folder="rfi-drawings"
            title="Upload Drawing(s)"
          />
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
