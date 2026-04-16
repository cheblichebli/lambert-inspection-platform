const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/projects
router.get('/', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM projects ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Projects GET error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id
router.get('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Projects GET/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects
router.post('/', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const db = req.app.get('db');
  const { name, client, main_contractor, mep_subcontractor, project_manager, ref_code } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  try {
    const result = await db.query(
      `INSERT INTO projects (name, client, main_contractor, mep_subcontractor, project_manager, ref_code)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, client || null, main_contractor || null, mep_subcontractor || 'Lambert Electromec', project_manager || null, ref_code || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Projects POST error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const db = req.app.get('db');
  const { name, client, main_contractor, mep_subcontractor, project_manager, ref_code, is_active } = req.body;
  try {
    const result = await db.query(
      `UPDATE projects SET
        name=$1, client=$2, main_contractor=$3, mep_subcontractor=$4,
        project_manager=$5, ref_code=$6, is_active=$7
       WHERE id=$8 RETURNING *`,
      [name, client || null, main_contractor || null, mep_subcontractor || 'Lambert Electromec',
       project_manager || null, ref_code || null, is_active !== undefined ? is_active : true, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Projects PUT error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Projects DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
