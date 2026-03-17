const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/capa — list all (admin/supervisor) or assigned-to-me (inspector)
router.get('/', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const { status, assignedTo, inspectionId } = req.query;
  const user = req.user;

  let where = [];
  let vals = [];
  let i = 1;

  if (user.role === 'inspector') {
    where.push(`ca.assigned_to = $${i++}`);
    vals.push(user.id);
  } else {
    if (assignedTo) { where.push(`ca.assigned_to = $${i++}`); vals.push(assignedTo); }
  }
  if (status) { where.push(`ca.status = $${i++}`); vals.push(status); }
  if (inspectionId) { where.push(`ca.inspection_id = $${i++}`); vals.push(inspectionId); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const result = await db.query(`
      SELECT ca.*,
        u_a.full_name AS assigned_to_name,
        u_c.full_name AS created_by_name,
        u_cl.full_name AS closed_by_name,
        ins.equipment_id, ins.location
      FROM corrective_actions ca
      LEFT JOIN users u_a ON ca.assigned_to = u_a.id
      LEFT JOIN users u_c ON ca.created_by = u_c.id
      LEFT JOIN users u_cl ON ca.closed_by = u_cl.id
      LEFT JOIN inspections ins ON ca.inspection_id = ins.id
      ${clause}
      ORDER BY
        CASE ca.priority WHEN 'critical' THEN 1 WHEN 'major' THEN 2 ELSE 3 END,
        ca.due_date ASC NULLS LAST,
        ca.created_at DESC
    `, vals);
    res.json(result.rows);
  } catch (err) {
    console.error('CAPA GET error:', err);
    res.status(500).json({ error: 'Failed to fetch corrective actions' });
  }
});

// GET /api/capa/stats — summary counts
router.get('/stats', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='open') AS open,
        COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status='closed') AS closed,
        COUNT(*) FILTER (WHERE status!='closed' AND due_date < NOW()) AS overdue,
        COUNT(*) FILTER (WHERE recurrence_count > 0) AS recurring
      FROM corrective_actions
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('CAPA stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/capa — supervisor creates a corrective action
router.post('/', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const db = req.app.get('db');
  const { inspection_id, flag_index, title, description, priority, assigned_to, due_date } = req.body;

  try {
    // Check for recurrence on same equipment in last 90 days
    const ins = await db.query('SELECT equipment_id FROM inspections WHERE id=$1', [inspection_id]);
    const equipmentId = ins.rows[0]?.equipment_id;
    let recurrence = 0;
    if (equipmentId) {
      const rec = await db.query(`
        SELECT COUNT(*) FROM corrective_actions ca
        JOIN inspections i ON ca.inspection_id = i.id
        WHERE i.equipment_id = $1 AND ca.title ILIKE $2 AND ca.created_at > NOW() - INTERVAL '90 days'
      `, [equipmentId, `%${title}%`]);
      recurrence = parseInt(rec.rows[0].count);
    }

    const result = await db.query(`
      INSERT INTO corrective_actions
        (inspection_id, flag_index, title, description, priority, assigned_to, due_date, created_by, recurrence_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [inspection_id, flag_index, title, description, priority || 'minor', assigned_to, due_date || null, req.user.id, recurrence]);

    res.status(201).json({ ...result.rows[0], recurrence_detected: recurrence > 0 });
  } catch (err) {
    console.error('CAPA POST error:', err);
    res.status(500).json({ error: 'Failed to create corrective action' });
  }
});

// PUT /api/capa/:id — update (supervisor edits, or inspector submits evidence)
router.put('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const user = req.user;
  const { evidence_photo, evidence_note, status, assigned_to, due_date, priority } = req.body;

  try {
    const existing = await db.query('SELECT * FROM corrective_actions WHERE id=$1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const ca = existing.rows[0];

    // Inspectors can only update actions assigned to them
    if (user.role === 'inspector' && ca.assigned_to !== user.id) {
      return res.status(403).json({ error: 'Not assigned to you' });
    }

    const updates = [];
    const vals = [];
    let i = 1;

    if (evidence_photo !== undefined) { updates.push(`evidence_photo=$${i++}`); vals.push(evidence_photo); }
    if (evidence_note !== undefined)  { updates.push(`evidence_note=$${i++}`); vals.push(evidence_note); }
    if (status !== undefined)         { updates.push(`status=$${i++}`); vals.push(status); }
    if (assigned_to !== undefined)    { updates.push(`assigned_to=$${i++}`); vals.push(assigned_to); }
    if (due_date !== undefined)       { updates.push(`due_date=$${i++}`); vals.push(due_date); }
    if (priority !== undefined)       { updates.push(`priority=$${i++}`); vals.push(priority); }

    if (status === 'closed') {
      updates.push(`closed_by=$${i++}`); vals.push(user.id);
      updates.push(`closed_at=$${i++}`); vals.push(new Date().toISOString());
    }

    updates.push(`updated_at=$${i++}`); vals.push(new Date().toISOString());
    vals.push(id);

    const result = await db.query(
      `UPDATE corrective_actions SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      vals
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('CAPA PUT error:', err);
    res.status(500).json({ error: 'Failed to update corrective action' });
  }
});

// DELETE /api/capa/:id — admin only
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('DELETE FROM corrective_actions WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('CAPA DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete corrective action' });
  }
});

module.exports = router;
