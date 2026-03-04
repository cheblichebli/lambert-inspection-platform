import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formsAPI } from '../api';
import { Plus, Trash2, Save, FileText, Sparkles, X, GripVertical, Table, ChevronDown, ChevronUp } from 'lucide-react';

// ── AI PDF Converter Modal ────────────────────────────────────────────────────
const PDFConverterModal = ({ onClose, onFormGenerated }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef(null);

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setProgress('Reading PDF...');

    try {
      const base64Data = await readFileAsBase64(file);
      setProgress('Analyzing form structure with AI...');

      const systemPrompt = `You are a form digitization expert. Analyze the PDF form image and extract its structure into a digital form definition.

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "title": "form title",
  "category": "QA/QC",
  "description": "brief description",
  "fields": [
    {
      "id": "field_1",
      "type": "text|number|textarea|select|checkbox|radio|date|photo|table",
      "label": "field label",
      "required": false,
      "placeholder": "",
      "options": [],
      "columns": []
    }
  ]
}

Field type rules:
- Text lines → "text"
- Multi-line text areas → "textarea"  
- Dropdown lists → "select" with options array
- Single checkboxes (yes/no, tick boxes) → "checkbox"
- Multiple choice (pick one) → "radio" with options array
- Date fields → "date"
- Photo/image areas → "photo"
- Tables with repeating rows (checklists, item lists) → "table" with columns array

For "table" type, columns array should be like:
["Item No.", "Description", "OK", "BAD", "Repair", "Add", "Replace", "Assigned To", "Planned Date", "Completion Date"]

Column types within a table:
- Short text columns → prefix with "text:"
- Checkbox columns (OK, BAD, Repair, etc.) → prefix with "check:"
- Date columns → prefix with "date:"

So columns for the equipment checklist would be:
["text:Item No.", "text:Description", "check:OK", "check:BAD", "check:Repair", "check:Add", "check:Replace", "text:Assigned To", "date:Planned Date", "date:Completion Date"]

Category must be one of: "QA/QC", "QHSE", "Equipment Installation", "Maintenance"`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [{
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
            }, {
              type: 'text',
              text: 'Convert this form to a digital form definition. Return only the JSON object.'
            }]
          }]
        })
      });

      const data = await response.json();
      setProgress('Parsing form structure...');

      const text = data.content?.find(b => b.type === 'text')?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Normalize fields
      parsed.fields = parsed.fields.map((f, i) => ({
        id: `field_${Date.now()}_${i}`,
        type: f.type || 'text',
        label: f.label || '',
        required: f.required || false,
        placeholder: f.placeholder || '',
        options: f.options || [],
        columns: f.columns || []
      }));

      setProgress('Done!');
      setTimeout(() => {
        onFormGenerated(parsed);
        onClose();
      }, 500);

    } catch (err) {
      console.error(err);
      setError('Failed to convert PDF. Please try again or build the form manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '12px', padding: '32px',
        maxWidth: '520px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
              Convert PDF Form to Digital
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Upload an existing PDF form and AI will recreate it digitally
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${file ? '#4a9d5f' : '#cbd5e1'}`,
            borderRadius: '10px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: file ? '#f0fdf4' : '#f8fafc',
            transition: 'all 0.2s',
            marginBottom: '20px'
          }}
        >
          <FileText size={40} style={{ color: file ? '#4a9d5f' : '#94a3b8', margin: '0 auto 12px' }} />
          {file ? (
            <div>
              <p style={{ fontWeight: 600, color: '#4a9d5f', marginBottom: '4px' }}>{file.name}</p>
              <p style={{ color: '#64748b', fontSize: '0.8rem' }}>{(file.size / 1024).toFixed(0)} KB — Click to change</p>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Click to upload PDF</p>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Supports any Lambert form PDF</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }}
          />
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid #4a9d5f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            {progress}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontWeight: 500, color: '#64748b' }}>
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={!file || loading}
            style={{
              flex: 2, padding: '10px', border: 'none', borderRadius: '8px',
              background: !file || loading ? '#94a3b8' : '#4a9d5f',
              color: 'white', cursor: !file || loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Sparkles size={18} />
            {loading ? 'Converting...' : 'Convert with AI'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Table Column Editor ───────────────────────────────────────────────────────
const TableColumnEditor = ({ columns, onChange }) => {
  const addColumn = () => onChange([...columns, 'text:New Column']);

  const updateColumn = (idx, val) => {
    const next = [...columns];
    next[idx] = val;
    onChange(next);
  };

  const removeColumn = (idx) => onChange(columns.filter((_, i) => i !== idx));

  const getType = (col) => col.startsWith('check:') ? 'check' : col.startsWith('date:') ? 'date' : 'text';
  const getLabel = (col) => col.replace(/^(text:|check:|date:)/, '');

  return (
    <div style={{ marginTop: '12px', background: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Table Columns
      </p>
      {columns.map((col, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <select
            value={getType(col)}
            onChange={(e) => updateColumn(idx, `${e.target.value}:${getLabel(col)}`)}
            style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', background: 'white', width: '90px', flexShrink: 0 }}
          >
            <option value="text">Text</option>
            <option value="check">Checkbox</option>
            <option value="date">Date</option>
          </select>
          <input
            type="text"
            value={getLabel(col)}
            onChange={(e) => updateColumn(idx, `${getType(col)}:${e.target.value}`)}
            placeholder="Column name"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }}
          />
          <button onClick={() => removeColumn(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        onClick={addColumn}
        style={{ marginTop: '4px', padding: '6px 12px', border: '1px dashed #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <Plus size={14} /> Add Column
      </button>

      {/* Live preview */}
      {columns.length > 0 && (
        <div style={{ marginTop: '16px', overflowX: 'auto' }}>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Preview:</p>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', width: '100%' }}>
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i} style={{ border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f1f5f9', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {getLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {columns.map((col, i) => (
                  <td key={i} style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', color: '#94a3b8' }}>
                    {getType(col) === 'check' ? '☐' : getType(col) === 'date' ? 'mm/dd/yy' : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Main FormBuilder ──────────────────────────────────────────────────────────
const FormBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('QA/QC');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [expandedFields, setExpandedFields] = useState({});

  useEffect(() => {
    if (id) loadForm();
  }, [id]);

  const loadForm = async () => {
    try {
      const form = await formsAPI.getById(id);
      setTitle(form.title);
      setCategory(form.category);
      setDescription(form.description || '');
      const f = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields;
      setFields(f);
    } catch (error) {
      alert('Failed to load form');
    }
  };

  const addField = () => {
    const newId = `field_${Date.now()}`;
    setFields([...fields, {
      id: newId,
      type: 'text',
      label: '',
      required: false,
      placeholder: '',
      options: [],
      columns: []
    }]);
    setExpandedFields(prev => ({ ...prev, [newId]: true }));
  };

  const updateField = (index, updates) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const toggleExpand = (fieldId) => {
    setExpandedFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const handleFormGenerated = (parsed) => {
    setTitle(parsed.title || '');
    setCategory(parsed.category || 'QA/QC');
    setDescription(parsed.description || '');
    setFields(parsed.fields || []);
    // Expand all fields so user can review
    const expanded = {};
    (parsed.fields || []).forEach(f => { expanded[f.id] = true; });
    setExpandedFields(expanded);
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

  const getFieldTypeLabel = (type) => {
    const labels = {
      text: '📝 Text', number: '🔢 Number', textarea: '📄 Textarea',
      select: '🔽 Dropdown', checkbox: '☑️ Checkbox', radio: '🔘 Radio',
      date: '📅 Date', photo: '📷 Photo', table: '📊 Table'
    };
    return labels[type] || type;
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b' }}>
          {id ? 'Edit' : 'Create'} Form Template
        </h1>
        <button
          onClick={() => setShowConverter(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', border: 'none', borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9d5f, #3a8049)',
            color: 'white', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(74,157,95,0.35)'
          }}
        >
          <Sparkles size={18} />
          Convert PDF Form with AI
        </button>
      </div>

      {/* Form details */}
      <div className="form-section">
        <div className="form-group">
          <label>Form Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-control"
            placeholder="e.g., Equipment & Tools Inspection Checklist"
          />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-control">
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
            placeholder="Brief description of this form's purpose..."
          />
        </div>
      </div>

      {/* Fields */}
      <div className="form-section">
        <div className="section-header">
          <h2>Form Fields</h2>
          <button onClick={addField} className="btn btn-secondary">
            <Plus size={20} /> Add Field
          </button>
        </div>

        {fields.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 500 }}>No fields yet</p>
            <p style={{ fontSize: '0.875rem' }}>Add fields manually or use "Convert PDF Form with AI" above</p>
          </div>
        )}

        {fields.map((field, index) => (
          <div key={field.id} style={{
            border: '1px solid #e2e8f0', borderRadius: '10px',
            marginBottom: '12px', overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            {/* Field header row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', background: '#f8fafc',
              borderBottom: expandedFields[field.id] ? '1px solid #e2e8f0' : 'none'
            }}>
              <GripVertical size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />

              <span style={{
                fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
                background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px',
                whiteSpace: 'nowrap', flexShrink: 0
              }}>
                {getFieldTypeLabel(field.type)}
              </span>

              <span style={{ flex: 1, fontWeight: 500, color: field.label ? '#1e293b' : '#94a3b8', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {field.label || 'Untitled field'}
              </span>

              {field.required && (
                <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>REQUIRED</span>
              )}

              <button onClick={() => toggleExpand(field.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', flexShrink: 0 }}>
                {expandedFields[field.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              <button onClick={() => removeField(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', flexShrink: 0 }}>
                <Trash2 size={16} />
              </button>
            </div>

            {/* Expanded editor */}
            {expandedFields[field.id] && (
              <div style={{ padding: '16px' }}>
                <div className="form-grid" style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Field Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="e.g., Equipment Condition"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Field Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, {
                        type: e.target.value,
                        columns: e.target.value === 'table' && (!field.columns || field.columns.length === 0)
                          ? ['text:Item No.', 'text:Description', 'check:OK', 'check:BAD', 'text:Action', 'text:Assigned To', 'date:Planned Date', 'date:Completion Date']
                          : field.columns
                      })}
                      className="form-control"
                    >
                      <option value="text">📝 Text</option>
                      <option value="number">🔢 Number</option>
                      <option value="textarea">📄 Textarea</option>
                      <option value="select">🔽 Dropdown</option>
                      <option value="checkbox">☑️ Checkbox</option>
                      <option value="radio">🔘 Radio</option>
                      <option value="date">📅 Date</option>
                      <option value="photo">📷 Photo Upload</option>
                      <option value="table">📊 Inspection Table</option>
                    </select>
                  </div>
                </div>

                {field.type !== 'checkbox' && field.type !== 'table' && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem' }}>Placeholder text (optional)</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                      placeholder="Hint shown inside the field..."
                      className="form-control"
                    />
                  </div>
                )}

                {['select', 'radio'].includes(field.type) && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem' }}>Options (comma-separated)</label>
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => updateField(index, { options: e.target.value.split(',').map(o => o.trim()) })}
                      placeholder="Option 1, Option 2, Option 3"
                      className="form-control"
                    />
                  </div>
                )}

                {field.type === 'table' && (
                  <TableColumnEditor
                    columns={field.columns || []}
                    onChange={(cols) => updateField(index, { columns: cols })}
                  />
                )}

                <label className="checkbox-label" style={{ marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Required field</span>
                </label>
              </div>
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

      {showConverter && (
        <PDFConverterModal
          onClose={() => setShowConverter(false)}
          onFormGenerated={handleFormGenerated}
        />
      )}
    </div>
  );
};

export default FormBuilder;
