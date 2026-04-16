import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../api';
import { Plus, Edit2, ToggleLeft, ToggleRight, Building2 } from 'lucide-react';

const ProjectList = ({ user }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await projectsAPI.getAll();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (project) => {
    try {
      await projectsAPI.update(project.id, { ...project, is_active: !project.is_active });
      load();
    } catch (err) {
      alert('Failed to update project status.');
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Projects</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0' }}>
            Manage projects that RFIs are submitted against.
          </p>
        </div>
        {['admin', 'supervisor'].includes(user?.role) && (
          <button
            onClick={() => navigate('/rfi/projects/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            <Plus size={18} /> New Project
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <Building2 size={40} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
          <p style={{ fontWeight: 600, color: '#64748b', margin: '0 0 16px' }}>No projects yet</p>
          <button
            onClick={() => navigate('/rfi/projects/new')}
            style={{ padding: '8px 20px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Project Name', 'Ref Code', 'Client', 'Main Contractor', 'MEP Sub-Contractor', 'Project Manager', 'Created', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={16} style={{ color: '#4a9d5f', flexShrink: 0 }} />
                      {p.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>{p.ref_code || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: '#374151' }}>{p.client || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: '#374151' }}>{p.main_contractor || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: '#374151' }}>{p.mep_subcontractor || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: '#374151' }}>{p.project_manager || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600,
                      background: p.is_active ? '#f0fdf4' : '#f1f5f9',
                      color: p.is_active ? '#10b981' : '#94a3b8',
                      border: `1px solid ${p.is_active ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {['admin', 'supervisor'].includes(user?.role) && (
                        <>
                          <button
                            onClick={() => navigate(`/rfi/projects/${p.id}/edit`)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <button
                            onClick={() => toggleActive(p)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: p.is_active ? '#fef2f2' : '#f0fdf4', border: `1px solid ${p.is_active ? '#fca5a5' : '#bbf7d0'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: p.is_active ? '#dc2626' : '#10b981' }}
                          >
                            {p.is_active ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                            {p.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
