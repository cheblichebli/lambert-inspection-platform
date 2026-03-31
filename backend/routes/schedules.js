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

// POST /api/schedules/:id/start
// Creates a pre-populated inspection from a schedule and marks it in_progress
router.post('/:id/start', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const user = req.user;
  try {
    // Fetch the schedule
    const schedResult = await db.query(`
      SELECT s.*, ft.title AS form_title
      FROM inspection_schedules s
      LEFT JOIN form_templates ft ON s.form_template_id = ft.id
      WHERE s.id = $1 AND s.is_active = TRUE`, [req.params.id]);

    if (!schedResult.rows.length)
      return res.status(404).json({ error: 'Schedule not found' });

    const schedule = schedResult.rows[0];

    // Only the assigned inspector (or admin/supervisor) can start
    if (user.role === 'inspector' && schedule.assigned_to !== user.id)
      return res.status(403).json({ error: 'You are not assigned to this schedule' });

    // If already linked to a completed inspection, prevent duplicate
    if (schedule.linked_inspection_id && schedule.status === 'completed')
      return res.status(400).json({ error: 'This scheduled inspection has already been completed.' });

    // Create the pre-populated inspection as a draft
    const inspResult = await db.query(`
      INSERT INTO inspections
        (template_id, inspector_id, location, equipment_id, notes, status, data)
      VALUES ($1, $2, $3, $4, $5, 'draft', '{}')
      RETURNING id`,
      [
        schedule.form_template_id || null,
        user.id,
        schedule.location || '',
        schedule.equipment_id || '',
        schedule.notes || '',
      ]
    );

    const inspectionId = inspResult.rows[0].id;

    // Link inspection back to schedule and mark in_progress
    await db.query(`
      UPDATE inspection_schedules
      SET linked_inspection_id = $1, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`,
      [inspectionId, schedule.id]
    );

    res.status(201).json({
      inspectionId,
      scheduleId: schedule.id,
      templateId: schedule.form_template_id,
      location: schedule.location,
      equipmentId: schedule.equipment_id,
      notes: schedule.notes,
    });
  } catch (err) {
    console.error('Schedule start error:', err);
    res.status(500).json({ error: 'Failed to start inspection' });
  }
});

// POST /api/schedules/:id/cancel
// Resets a schedule back to pending when inspector cancels a started inspection
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM inspection_schedules WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Schedule not found' });
    const schedule = result.rows[0];

    // Delete the draft inspection that was created
    if (schedule.linked_inspection_id) {
      await db.query('DELETE FROM inspections WHERE id=$1 AND status='draft'', [schedule.linked_inspection_id]);
    }

    // Reset schedule back to pending
    await db.query(
      'UPDATE inspection_schedules SET status='pending', linked_inspection_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      [req.params.id]
    );

    res.json({ message: 'Schedule reset to pending' });
  } catch (err) {
    console.error('Schedule cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel inspection' });
  }
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
  const { title, form_template_id, assigned_to, frequency, start_date, end_date, location, equipment_id, notes, is_active, status } = req.body;
  try {
    const existing = await db.query('SELECT * FROM inspection_schedules WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Schedule not found' });
    const result = await db.query(`
      UPDATE inspection_schedules SET
        title=COALESCE($1,title), form_template_id=COALESCE($2,form_template_id),
        assigned_to=COALESCE($3,assigned_to), frequency=COALESCE($4,frequency),
        start_date=COALESCE($5,start_date), end_date=$6, location=$7,
        equipment_id=$8, notes=$9, is_active=COALESCE($10,is_active),
        status=COALESCE($11,status),
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$12 RETURNING *
    `, [title||null, form_template_id||null, assigned_to||null, frequency||null, start_date||null,
        end_date||null, location||null, equipment_id||null, notes||null,
        is_active !== undefined ? is_active : null, status||null, req.params.id]);

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
