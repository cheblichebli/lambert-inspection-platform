const express = require('express');
const axios = require('axios');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get audit logs (Admin only)
router.get('/audit-logs', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { userId, action, role, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;

  try {
    let query = `
      SELECT a.*, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let p = 0;

    if (userId) {
      p++; query += ` AND a.user_id = $${p}`; params.push(parseInt(userId));
    }
    if (action) {
      p++; query += ` AND a.action LIKE $${p}`; params.push(`%${action}%`);
    }
    if (role) {
      p++; query += ` AND u.role = $${p}`; params.push(role);
    }
    if (dateFrom) {
      p++;
      query += ` AND a.created_at >= $${p}::timestamptz`;
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      p++;
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query += ` AND a.created_at <= $${p}::timestamptz`;
      params.push(end.toISOString());
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Count query
    let countQuery = `
      SELECT COUNT(*) FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const countParams = [];
    let cp = 0;

    if (userId)   { cp++; countQuery += ` AND a.user_id = $${cp}`;       countParams.push(parseInt(userId)); }
    if (action)   { cp++; countQuery += ` AND a.action LIKE $${cp}`;     countParams.push(`%${action}%`); }
    if (role)     { cp++; countQuery += ` AND u.role = $${cp}`;           countParams.push(role); }
    if (dateFrom) {
      cp++;
      countQuery += ` AND a.created_at >= $${cp}::timestamptz`;
      countParams.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      cp++;
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      countQuery += ` AND a.created_at <= $${cp}::timestamptz`;
      countParams.push(end.toISOString());
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get list of users who appear in audit logs (for filter dropdown)
router.get('/audit-users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      `SELECT DISTINCT a.user_id, a.user_name, a.user_email, u.role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.user_id IS NOT NULL
       ORDER BY a.user_name`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit users' });
  }
});

// Get system stats (Admin only)
router.get('/stats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');

  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as admins,
        (SELECT COUNT(*) FROM users WHERE role = 'inspector') as inspectors,
        (SELECT COUNT(*) FROM users WHERE role = 'supervisor') as supervisors,
        (SELECT COUNT(*) FROM form_templates) as forms,
        (SELECT COUNT(*) FROM form_templates WHERE is_active = true) as active_forms,
        (SELECT COUNT(*) FROM inspections) as inspections,
        (SELECT COUNT(*) FROM inspections WHERE status = 'submitted') as submitted_inspections,
        (SELECT COUNT(*) FROM inspections WHERE status = 'approved') as approved_inspections,
        (SELECT COUNT(*) FROM inspections WHERE status = 'rejected') as rejected_inspections,
        (SELECT COUNT(*) FROM inspection_photos) as photos,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// PDF → Digital Form converter (Admin only)
router.post('/convert-pdf-form', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { pdfBase64 } = req.body;

  if (!pdfBase64) {
    return res.status(400).json({ error: 'No PDF data provided' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured. Please add ANTHROPIC_API_KEY to Railway environment variables.' });
  }

  const systemPrompt = `You are a form digitization expert. Analyze the PDF form and extract its structure into a digital form definition.

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation, no backticks:
{
  "title": "form title",
  "category": "QA/QC",
  "description": "brief description",
  "fields": [
    {
      "id": "field_1",
      "type": "text",
      "label": "field label",
      "required": false,
      "placeholder": "",
      "options": [],
      "columns": []
    }
  ]
}

Field type rules:
- Text input lines → "text"
- Multi-line text areas → "textarea"
- Dropdown lists → "select" with options array filled
- Single tick/check boxes (yes/no) → "checkbox"
- Multiple choice pick-one → "radio" with options array filled
- Date fields → "date"
- Photo/image capture areas → "photo"
- Tables with repeating rows (checklists, item lists, inspection rows) → "table" with columns array

For "table" type, columns array uses prefixes:
- Short text entry → "text:Column Name"
- Checkbox/tick columns → "check:Column Name"
- Date columns → "date:Column Name"

Example for an equipment checklist table:
["text:Item No.", "text:Description", "check:OK", "check:BAD", "check:Repair", "check:Add", "check:Replace", "text:Assigned To", "date:Planned Date", "date:Completion Date"]

Category must be exactly one of: "QA/QC", "QHSE", "Equipment Installation", "Maintenance"

Return only the raw JSON. No markdown. No explanation.`;

  try {
    const anthropicResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: 'Convert this PDF form to a digital form definition. Return only the JSON object.'
            }
          ]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const data = anthropicResponse.data;
    const text = (data.content || []).find(b => b.type === 'text')?.text || '';

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Normalize fields — ensure all required keys exist
    parsed.fields = (parsed.fields || []).map((f, i) => ({
      id: `field_${Date.now()}_${i}`,
      type: f.type || 'text',
      label: f.label || '',
      required: f.required || false,
      placeholder: f.placeholder || '',
      options: f.options || [],
      columns: f.columns || []
    }));

    res.json(parsed);

  } catch (error) {
    console.error('PDF conversion error:', error.response?.data || error.message);
    const msg = error.response?.data?.error?.message || error.response?.data?.error || error.message;
    res.status(500).json({ error: 'Failed to convert PDF: ' + msg });
  }
});

module.exports = router;
