import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formsAPI } from '../api';
import { Plus, Trash2, Save } from 'lucide-react';

const FormBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('QA/QC');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadForm();
    }
  }, [id]);

  const loadForm = async () => {
    try {
      const form = await formsAPI.getById(id);
      setTitle(form.title);
      setCategory(form.category);
      setDescription(form.description || '');
      setFields(typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields);
    } catch (error) {
      alert('Failed to load form');
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        id: `field_${Date.now()}`,
        type: 'text',
        label: '',
        required: false,
        placeholder: '',
        options: []
      }
    ]);
  };

  const updateField = (index, updates) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || fields.length === 0) {
      alert('Please provide title and at least one field');
      return;
    }

    setLoading(true);
    try {
      const formData = { title, category, description, fields };
      if (id) {
        await formsAPI.update(id, formData);
      } else {
        await formsAPI.create(formData);
      }
      alert('Form saved successfully');
      navigate('/forms');
    } catch (error) {
      alert('Failed to save form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1>{id ? 'Edit' : 'Create'} Form Template</h1>

      <div className="form-section">
        <div className="form-group">
          <label>Form Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-control"
            placeholder="e.g., Equipment Safety Inspection"
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="form-control"
          >
            <option value="QA/QC">QA/QC</option>
            <option value="QHSE">QHSE</option>
            <option value="Equipment Installation">Equipment Installation</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-control"
            rows={3}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h2>Form Fields</h2>
          <button onClick={addField} className="btn btn-secondary">
            <Plus size={20} /> Add Field
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="field-builder">
            <div className="form-grid">
              <input
                type="text"
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Field Label"
                className="form-control"
              />

              <select
                value={field.type}
                onChange={(e) => updateField(index, { type: e.target.value })}
                className="form-control"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="textarea">Textarea</option>
                <option value="select">Dropdown</option>
                <option value="checkbox">Checkbox</option>
                <option value="radio">Radio</option>
                <option value="date">Date</option>
              </select>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                />
                <span>Required</span>
              </label>

              <button
                onClick={() => removeField(index)}
                className="btn btn-error"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {['select', 'radio'].includes(field.type) && (
              <input
                type="text"
                value={field.options?.join(', ') || ''}
                onChange={(e) => updateField(index, {
                  options: e.target.value.split(',').map(o => o.trim())
                })}
                placeholder="Options (comma-separated)"
                className="form-control"
              />
            )}
          </div>
        ))}
      </div>

      <div className="form-actions">
        <button onClick={() => navigate('/forms')} className="btn btn-secondary">
          Cancel
        </button>
        <button onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
          <Save size={20} />
          {loading ? 'Saving...' : 'Save Form'}
        </button>
      </div>
    </div>
  );
};

export default FormBuilder;
