const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendScheduleAssigned } = require('../utils/email');

// GET /api/schedules
router.get('/', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const user = req.user;
  try {
    let query, params = [];
    if (user.role === 'inspector') {
      query = `
        SELECT s.*, u.full_name AS assigned_to_name, u.email AS assigned_to_email,
          cb.full_name AS created_by_name, ft.title AS form_title, ft.category AS form_category
        FROM inspection_schedules s
        LEFT JOIN users u ON s.assigned_to = u.id
        LEFT JOIN users cb ON s.created_by = cb.id
        LEFT JOIN form_templates ft ON s.form_template_id = ft.id
        WHERE s.is_active = TRUE AND s.assigned_to = $1
        ORDER BY s.start_date ASC`;
      params = [parseInt(user.id)];
    } else {
      query = `
        SELECT s.*, u.full_name AS assigned_to_name, u.email AS assigned_to_email,
          cb.full_name AS created_by_name, ft.title AS form_title, ft.category AS form_category
        FROM inspection_schedules s
        LEFT JOIN users u ON s.assigned_to = u.id
        LEFT JOIN users cb ON s.created_by = cb.id
        LEFT JOIN form_templates ft ON s.form_template_id = ft.id
        WHERE s.is_active = TRUE
        ORDER BY s.start_date ASC`;
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error('Schedules GET error:', err); res.status(500).json({ error: 'Failed to fetch schedules' }); }
});

// GET /api/schedules/:id
router.get('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT s.*, u.full_name AS assigned_to_name, u.email AS assigned_to_email,
        cb.full_name AS created_by_name, ft.title AS form_title, ft.category AS form_category
      FROM inspection_schedules s
      LEFT JOIN users u ON s.assigned_to = u.id
      LEFT JOIN users cb ON s.created_by = cb.id
      LEFT JOIN form_templates ft ON s.form_template_id = ft.id
      WHERE s.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error('Schedule GET single error:', err); res.status(500).json({ error: 'Failed to fetch schedule' }); }
});

// POST /api/schedules
router.post('/', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const db = req.app.get('db');
  const { title, form_template_id, assigned_to, frequency, start_date, end_date, location, equipment_id, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!start_date) return res.status(400).json({ error: 'Start date is required' });
  if (!frequency) return res.status(400).json({ error: 'Frequency is required' });
  if (frequency === 'daily' && !end_date) return res.status(400).json({ error: 'End date is required for daily schedules' });
  try {
    const result = await db.query(`
      INSERT INTO inspection_schedules
        (title, form_template_id, assigned_to, frequency, start_date, end_date, location, equipment_id, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [title, form_template_id || null, assigned_to || null, frequency, start_date,
        end_date || null, location || null, equipment_id || null, notes || null, req.user.id]);

    const full = await db.query(`
      SELECT s.*, u.full_name AS assigned_to_name, u.email AS assigned_to_email,
        cb.full_name AS created_by_name, ft.title AS form_title, ft.category AS form_category
      FROM inspection_schedules s
      LEFT JOIN users u ON s.assigned_to = u.id
      LEFT JOIN users cb ON s.created_by = cb.id
      LEFT JOIN form_templates ft ON s.form_template_id = ft.id
      WHERE s.id = $1`, [result.rows[0].id]);

    const schedule = full.rows[0];

    // ── Email: notify assigned inspector ──────────────────────────────
    if (assigned_to && schedule.assigned_to_email) {
      sendScheduleAssigned({
        toEmail: schedule.assigned_to_email,
        inspectorName: schedule.assigned_to_name || 'Inspector',
        scheduleTitle: title,
        frequency,
        startDate: start_date,
        endDate: end_date,
        location,
        equipmentId: equipment_id,
        formTitle: schedule.form_title,
        notes,
        createdByName: schedule.created_by_name || 'Supervisor',
      });
    }

    res.status(201).json(schedule);
  } catch (err) { console.error('Schedule POST error:', err); res.status(500).json({ error: 'Failed to create schedule' }); }
});

// PUT /api/schedules/:id
router.put('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const db = req.app.get('db');
  const { title, form_template_id, assigned_to, frequency, start_date, end_date, location, equipment_id, notes, is_active } = req.body;
  try {
    const existing = await db.query('SELECT * FROM inspection_schedules WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Schedule not found' });
    const result = await db.query(`
      UPDATE inspection_schedules SET
        title=COALESCE($1,title), form_template_id=COALESCE($2,form_template_id),
        assigned_to=COALESCE($3,assigned_to), frequency=COALESCE($4,frequency),
        start_date=COALESCE($5,start_date), end_date=$6, location=$7,
        equipment_id=$8, notes=$9, is_active=COALESCE($10,is_active),
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$11 RETURNING *
    `, [title||null, form_template_id||null, assigned_to||null, frequency||null, start_date||null,
        end_date||null, location||null, equipment_id||null, notes||null,
        is_active !== undefined ? is_active : null, req.params.id]);

    const full = await db.query(`
      SELECT s.*, u.full_name AS assigned_to_name, ft.title AS form_title, ft.category AS form_category
      FROM inspection_schedules s
      LEFT JOIN users u ON s.assigned_to = u.id
      LEFT JOIN form_templates ft ON s.form_template_id = ft.id
      WHERE s.id = $1`, [result.rows[0].id]);
    res.json(full.rows[0]);
  } catch (err) { console.error('Schedule PUT error:', err); res.status(500).json({ error: 'Failed to update schedule' }); }
});

// DELETE /api/schedules/:id
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const db = req.app.get('db');
  try {
    const existing = await db.query('SELECT * FROM inspection_schedules WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Schedule not found' });
    await db.query('UPDATE inspection_schedules SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=$1', [req.params.id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) { console.error('Schedule DELETE error:', err); res.status(500).json({ error: 'Failed to delete schedule' }); }
});

module.exports = router;
