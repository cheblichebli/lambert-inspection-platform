import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formsAPI } from '../api';
import { Plus, Edit, Trash2, EyeOff } from 'lucide-react';

const FormList = ({ user }) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      // Pass null to get ALL forms (active + inactive)
      const data = await formsAPI.getAll(null, null);
      setForms(data);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this form template?')) return;

    try {
      await formsAPI.delete(id);
      loadForms();
    } catch (error) {
      alert('Failed to delete form');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const activeForms = forms.filter(f => f.is_active);
  const inactiveForms = forms.filter(f => !f.is_active);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Form Templates</h1>
        {user.role === 'admin' && (
          <Link to="/forms/new" className="btn btn-primary">
            <Plus size={20} /> New Form
          </Link>
        )}
      </div>

      {/* Active Forms */}
      <div className="forms-grid">
        {activeForms.map(form => (
          <div key={form.id} className="form-card">
            <h3>{form.title}</h3>
            <span className="badge badge-info">{form.category}</span>
            <p className="text-muted">{form.description}</p>
            {user.role === 'admin' && (
              <div className="card-actions">
                <Link to={`/forms/${form.id}/edit`} className="btn btn-secondary btn-sm">
                  <Edit size={16} /> Edit
                </Link>
                <button onClick={() => handleDelete(form.id)} className="btn btn-error btn-sm">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Inactive Forms — greyed out, shown below active ones */}
      {inactiveForms.length > 0 && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '32px 0 16px 0',
            color: '#94a3b8'
          }}>
            <EyeOff size={16} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Inactive Forms ({inactiveForms.length})
            </span>
          </div>

          <div className="forms-grid">
            {inactiveForms.map(form => (
              <div key={form.id} className="form-card" style={{
                opacity: 0.5,
                filter: 'grayscale(40%)',
                borderLeft: '4px solid #cbd5e1'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ color: '#94a3b8' }}>{form.title}</h3>
                  <span style={{
                    fontSize: '0.7rem',
                    background: '#f1f5f9',
                    color: '#94a3b8',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600
                  }}>INACTIVE</span>
                </div>
                <span className="badge badge-info">{form.category}</span>
                <p className="text-muted">{form.description}</p>
                {user.role === 'admin' && (
                  <div className="card-actions">
                    <Link to={`/forms/${form.id}/edit`} className="btn btn-secondary btn-sm">
                      <Edit size={16} /> Edit
                    </Link>
                    <button onClick={() => handleDelete(form.id)} className="btn btn-error btn-sm">
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {forms.length === 0 && (
        <div className="empty-state">
          <p>No form templates yet.</p>
          {user.role === 'admin' && (
            <Link to="/forms/new" className="btn btn-primary" style={{ marginTop: '12px' }}>
              <Plus size={20} /> Create your first form
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default FormList;
