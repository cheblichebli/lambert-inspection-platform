import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formsAPI } from '../api';
import { Plus, Edit, Trash2 } from 'lucide-react';

const FormList = ({ user }) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const data = await formsAPI.getAll();
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

      <div className="forms-grid">
        {forms.map(form => (
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
    </div>
  );
};

export default FormList;
