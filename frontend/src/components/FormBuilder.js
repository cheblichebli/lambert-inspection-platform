1import React, { useState, useEffect } from 'react';
2import { useNavigate, useParams } from 'react-router-dom';
3import { formsAPI } from '../api';
4import { Plus, Trash2, Save } from 'lucide-react';
5
6const FormBuilder = () => {
7  const { id } = useParams();
8  const navigate = useNavigate();
9  const [title, setTitle] = useState('');
10  const [category, setCategory] = useState('QA/QC');
11  const [description, setDescription] = useState('');
12  const [fields, setFields] = useState([]);
13  const [loading, setLoading] = useState(false);
14
15  useEffect(() => {
16    if (id) {
17      loadForm();
18    }
19  }, [id]);
20
21  const loadForm = async () => {
22    try {
23      const form = await formsAPI.getById(id);
24      setTitle(form.title);
25      setCategory(form.category);
26      setDescription(form.description || '');
27      setFields(typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields);
28    } catch (error) {
29      alert('Failed to load form');
30    }
31  };
32
33  const addField = () => {
34    setFields([
35      ...fields,
36      {
37        id: `field_${Date.now()}`,
38        type: 'text',
39        label: '',
40        required: false,
41        placeholder: '',
42        options: []
43      }
44    ]);
45  };
46
47  const updateField = (index, updates) => {
48    const newFields = [...fields];
49    newFields[index] = { ...newFields[index], ...updates };
50    setFields(newFields);
51  };
52
53  const removeField = (index) => {
54    setFields(fields.filter((_, i) => i !== index));
55  };
56
57  const handleSubmit = async () => {
58    if (!title || fields.length === 0) {
59      alert('Please provide title and at least one field');
60      return;
61    }
62
63    setLoading(true);
64    try {
65      const formData = { title, category, description, fields };
66      if (id) {
67        await formsAPI.update(id, formData);
68      } else {
69        await formsAPI.create(formData);
70      }
71      alert('Form saved successfully');
72      navigate('/forms');
73    } catch (error) {
74      alert('Failed to save form');
75    } finally {
76      setLoading(false);
77    }
78  };
79
80  return (
81    <div className="page-container">
82      <h1>{id ? 'Edit' : 'Create'} Form Template</h1>
83
84      <div className="form-section">
85        <div className="form-group">
86          <label>Form Title</label>
87          <input
88            type="text"
89            value={title}
90            onChange={(e) => setTitle(e.target.value)}
91            className="form-control"
92            placeholder="e.g., Equipment Safety Inspection"
93          />
94        </div>
95
96        <div className="form-group">
97          <label>Category</label>
98          <select
99            value={category}
100            onChange={(e) => setCategory(e.target.value)}
101            className="form-control"
102          >
103            <option value="QA/QC">QA/QC</option>
104            <option value="QHSE">QHSE</option>
105            <option value="Equipment Installation">Equipment Installation</option>
106            <option value="Maintenance">Maintenance</option>
107          </select>
108        </div>
109
110        <div className="form-group">
111          <label>Description</label>
112          <textarea
113            value={description}
114            onChange={(e) => setDescription(e.target.value)}
115            className="form-control"
116            rows={3}
117          />
118        </div>
119      </div>
120
121      <div className="form-section">
122        <div className="section-header">
123          <h2>Form Fields</h2>
124          <button onClick={addField} className="btn btn-secondary">
125            <Plus size={20} /> Add Field
126          </button>
127        </div>
128
129        {fields.map((field, index) => (
130          <div key={field.id} className="field-builder">
131            <div className="form-grid">
132              <input
133                type="text"
134                value={field.label}
135                onChange={(e) => updateField(index, { label: e.target.value })}
136                placeholder="Field Label"
137                className="form-control"
138              />
139
140              <select
141                value={field.type}
142                onChange={(e) => updateField(index, { type: e.target.value })}
143                className="form-control"
144              >
145                <option value="text">Text</option>
146                <option value="number">Number</option>
147                <option value="textarea">Textarea</option>
148                <option value="select">Dropdown</option>
149                <option value="checkbox">Checkbox</option>
150                <option value="radio">Radio</option>
151                <option value="date">Date</option>
152                <option value="photo">📷 Photo Upload</option>
153              </select>
154
155              <label className="checkbox-label">
156                <input
157                  type="checkbox"
158                  checked={field.required}
159                  onChange={(e) => updateField(index, { required: e.target.checked })}
160                />
161                <span>Required</span>
162              </label>
163
164              <button
165                onClick={() => removeField(index)}
166                className="btn btn-error"
167              >
168                <Trash2 size={16} />
169              </button>
170            </div>
171
172            {['select', 'radio'].includes(field.type) && (
173              <input
174                type="text"
175                value={field.options?.join(', ') || ''}
176                onChange={(e) => updateField(index, {
177                  options: e.target.value.split(',').map(o => o.trim())
178                })}
179                placeholder="Options (comma-separated)"
180                className="form-control"
181              />
182            )}
183          </div>
184        ))}
185      </div>
186
187      <div className="form-actions">
188        <button onClick={() => navigate('/forms')} className="btn btn-secondary">
189          Cancel
190        </button>
191        <button onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
192          <Save size={20} />
193          {loading ? 'Saving...' : 'Save Form'}
194        </button>
195      </div>
196    </div>
197  );
198};
199
200export default FormBuilder;
201
