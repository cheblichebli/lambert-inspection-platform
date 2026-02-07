const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get all form templates
router.get('/', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { category, isActive } = req.query;
  
  try {
    let query = `
      SELECT ft.*, u.full_name as creator_name
      FROM form_templates ft
      LEFT JOIN users u ON ft.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND ft.category = $${params.length}`;
    }
    
    if (isActive !== undefined) {
      params.push(isActive === 'true');
      query += ` AND ft.is_active = $${params.length}`;
    }
    
    query += ' ORDER BY ft.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get form templates error:', error);
    res.status(500).json({ error: 'Failed to fetch form templates' });
  }
});

// Get single form template
router.get('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT ft.*, u.full_name as creator_name
       FROM form_templates ft
       LEFT JOIN users u ON ft.created_by = u.id
       WHERE ft.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get form template error:', error);
    res.status(500).json({ error: 'Failed to fetch form template' });
  }
});

// Create form template (Admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { title, category, description, fields } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO form_templates (title, category, description, fields, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, category, description, JSON.stringify(fields), req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create form template error:', error);
    res.status(500).json({ error: 'Failed to create form template' });
  }
});

// Update form template (Admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { title, category, description, fields, isActive } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE form_templates
       SET title = $1, category = $2, description = $3, fields = $4, 
           is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, category, description, JSON.stringify(fields), isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update form template error:', error);
    res.status(500).json({ error: 'Failed to update form template' });
  }
});

// Delete form template (Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM form_templates WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form template not found' });
    }

    res.json({ message: 'Form template deleted successfully' });
  } catch (error) {
    console.error('Delete form template error:', error);
    res.status(500).json({ error: 'Failed to delete form template' });
  }
});

module.exports = router;
