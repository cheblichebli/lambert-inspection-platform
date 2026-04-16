import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI } from '../api';
import { ArrowLeft } from 'lucide-react';

const ProjectForm = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    ref_code: '',
    client: '',
    main_contractor: '',
    mep_subcontractor: 'Lambert Electromec',
    project_manager: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit) {
      projectsAPI.getById(id).then(data => {
        setForm({
          name: data.name || '',
          ref_code: data.ref_code || '',
          client: data.client || '',
          main_contractor: data.main_contractor || '',
          mep_subcontractor: data.mep_subcontractor || 'Lambert Electromec',
          project_manager: data.project_manager || '',
          is_active: data.is_active !== false,
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id, isEdit]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Project name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        await projectsAPI.update(id, form);
      } else {
        await projectsAPI.create(form);
      }
      navigate('/rfi/projects');
    } catch (err) {
      alert('Failed to save project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const reqStar = <span style={{ color: '#ef4444' }}>*</span>;
  const errStyle = { fontSize: '0.75rem', color: '#dc2626', marginTop: '3px' };
  const sectionHeader = (title) => (
    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a9d5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0' }}>
      {title}
    </p>
  );

  return (
    <div className="page-container" style={{ maxWidth: '680px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/rfi/projects')} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0 }}>{isEdit ? 'Edit Project' : 'New Project'}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '2px 0 0' }}>
            {isEdit ? 'Update project details' : 'Add a new project to the inspection platform'}
          </p>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Project Identity */}
        <div>
          {sectionHeader('Project Identity')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Project Name {reqStar}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="form-control"
                placeholder="e.g. 10 Queens Drive, Quantum Luxury Tower..."
                style={{ borderColor: errors.name ? '#ef4444' : undefined }}
              />
              {errors.name && <p style={errStyle}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Reference Code</label>
              <input
                type="text"
                value={form.ref_code}
                onChange={e => set('ref_code', e.target.value)}
                className="form-control"
                placeholder="e.g. 10QD, QLT..."
              />
            </div>
            <div>
              <label style={labelStyle}>Client</label>
              <input
                type="text"
                value={form.client}
                onChange={e => set('client', e.target.value)}
                className="form-control"
                placeholder="e.g. Private Client, Cappa & D'Alberto..."
              />
            </div>
          </div>
        </div>

        {/* Contractors */}
        <div>
          {sectionHeader('Contractors')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Main Contractor</label>
              <input
                type="text"
                value={form.main_contractor}
                onChange={e => set('main_contractor', e.target.value)}
                className="form-control"
                placeholder="e.g. Cappa & D'Alberto..."
              />
            </div>
            <div>
              <label style={labelStyle}>MEP Sub-Contractor</label>
              <input
                type="text"
                value={form.mep_subcontractor}
                onChange={e => set('mep_subcontractor', e.target.value)}
                className="form-control"
                placeholder="e.g. Lambert Electromec"
              />
            </div>
          </div>
        </div>

        {/* Team */}
        <div>
          {sectionHeader('Project Team')}
          <div>
            <label style={labelStyle}>Project Manager</label>
            <input
              type="text"
              value={form.project_manager}
              onChange={e => set('project_manager', e.target.value)}
              className="form-control"
              placeholder="e.g. Ramzi El Souki"
            />
          </div>
        </div>

        {/* Status (edit only) */}
        {isEdit && (
          <div>
            {sectionHeader('Status')}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#4a9d5f' }}
              />
              <label htmlFor="is_active" style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                Project is active (appears in RFI form dropdown)
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={() => navigate('/rfi/projects')} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectForm;
