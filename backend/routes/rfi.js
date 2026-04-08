const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ── GET /api/rfi ─────────────────────────────────────────────────────────────
// All roles can read; inspectors see only RFIs they initiated
router.get('/', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const user = req.user;
  const { status, type } = req.query;

  let where = [], vals = [], i = 1;

  if (user.role === 'inspector') {
    where.push(`r.initiated_by = $${i++}`);
    vals.push(parseInt(user.id));
  }
  if (status) { where.push(`r.status = $${i++}`); vals.push(status); }
  if (type)   { where.push(`r.type = $${i++}`);   vals.push(type); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const result = await db.query(`
      SELECT r.*,
        u_i.full_name AS initiated_by_name,
        u_a.full_name AS assigned_to_name,
        u_r.full_name AS reviewed_by_name
      FROM rfis r
      LEFT JOIN users u_i ON r.initiated_by = u_i.id
      LEFT JOIN users u_a ON r.assigned_to  = u_a.id
      LEFT JOIN users u_r ON r.reviewed_by  = u_r.id
      ${clause}
      ORDER BY r.created_at DESC
    `, vals);
    res.json(result.rows);
  } catch (err) {
    console.error('RFI GET error:', err);
    res.status(500).json({ error: 'Failed to fetch RFIs' });
  }
});

// ── GET /api/rfi/stats ────────────────────────────────────────────────────────
router.get('/stats', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const user = req.user;
  const userFilter = user.role === 'inspector'
    ? `WHERE initiated_by = ${parseInt(user.id)}`
    : '';
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE status = 'draft')             AS draft,
        COUNT(*) FILTER (WHERE status = 'submitted')         AS submitted,
        COUNT(*) FILTER (WHERE status = 'in_review')         AS in_review,
        COUNT(*) FILTER (WHERE status = 'approved')          AS approved,
        COUNT(*) FILTER (WHERE status = 'approved_commented_resubmit')    AS resubmit,
        COUNT(*) FILTER (WHERE status = 'approved_commented_no_resubmit') AS approved_commented,
        COUNT(*) FILTER (WHERE status = 'rejected')          AS rejected,
        COUNT(*) FILTER (WHERE type = 'Mechanical')          AS mechanical,
        COUNT(*) FILTER (WHERE type = 'Electrical')          AS electrical
      FROM rfis ${userFilter}
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('RFI stats error:', err);
    res.status(500).json({ error: 'Failed to fetch RFI stats' });
  }
});

// ── GET /api/rfi/:id ──────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT r.*,
        u_i.full_name AS initiated_by_name,
        u_i.email     AS initiated_by_email,
        u_a.full_name AS assigned_to_name,
        u_r.full_name AS reviewed_by_name
      FROM rfis r
      LEFT JOIN users u_i ON r.initiated_by = u_i.id
      LEFT JOIN users u_a ON r.assigned_to  = u_a.id
      LEFT JOIN users u_r ON r.reviewed_by  = u_r.id
      WHERE r.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'RFI not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('RFI GET/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch RFI' });
  }
});

// ── POST /api/rfi ─────────────────────────────────────────────────────────────
// Any authenticated user can initiate an RFI (creates as draft)
router.post('/', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const {
    type, stage, system, sub_system, location, coordinates,
    test_results, description, drawing_data, drawing_filename,
    assigned_to, project
  } = req.body;

  if (!type || !stage) {
    return res.status(400).json({ error: 'Type and Stage are required' });
  }

  try {
    const result = await db.query(`
      INSERT INTO rfis
        (type, stage, system, sub_system, location, coordinates,
         test_results, description, drawing_data, drawing_filename,
         initiated_by, assigned_to, project, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft')
      RETURNING *
    `, [
      type, stage, system || null, sub_system || null, location || null,
      coordinates || null, test_results || null, description || null,
      drawing_data || null, drawing_filename || null,
      parseInt(req.user.id), assigned_to || null,
      project || '10 Queens Drive'
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('RFI POST error:', err);
    res.status(500).json({ error: 'Failed to create RFI' });
  }
});

// ── PUT /api/rfi/:id ──────────────────────────────────────────────────────────
// Initiator can edit draft; QC/supervisor can update status & attach QC docs
router.put('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  const user = req.user;
  const { id } = req.params;

  try {
    const existing = await db.query('SELECT * FROM rfis WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'RFI not found' });
    const rfi = existing.rows[0];

    // Inspectors can only edit their own drafts
    if (user.role === 'inspector' &&
        (rfi.initiated_by !== parseInt(user.id) || rfi.status !== 'draft')) {
      return res.status(403).json({ error: 'Not permitted' });
    }

    const {
      type, stage, system, sub_system, location, coordinates,
      test_results, description, drawing_data, drawing_filename,
      assigned_to, status, qc_comments, qc_attachments, project
    } = req.body;

    const updates = [], vals = [];
    let i = 1;

    const field = (col, val) => { if (val !== undefined) { updates.push(`${col}=$${i++}`); vals.push(val); } };

    field('type', type);
    field('stage', stage);
    field('system', system);
    field('sub_system', sub_system);
    field('location', location);
    field('coordinates', coordinates);
    field('test_results', test_results);
    field('description', description);
    field('drawing_data', drawing_data);
    field('drawing_filename', drawing_filename);
    field('assigned_to', assigned_to);
    field('qc_comments', qc_comments);
    field('project', project);

    if (qc_attachments !== undefined) {
      updates.push(`qc_attachments=$${i++}`);
      vals.push(JSON.stringify(qc_attachments));
    }

    // Status transitions
    if (status !== undefined) {
      updates.push(`status=$${i++}`);
      vals.push(status);

      if (status === 'submitted') {
        updates.push(`submitted_at=$${i++}`);
        vals.push(new Date().toISOString());
      }

      if (['approved','approved_commented_resubmit','approved_commented_no_resubmit','rejected'].includes(status)) {
        updates.push(`reviewed_by=$${i++}`); vals.push(parseInt(user.id));
        updates.push(`reviewed_at=$${i++}`); vals.push(new Date().toISOString());
      }

      // Resubmission — increment cycle and reset to draft
      if (status === 'resubmitted') {
        updates.push(`cycle=$${i++}`); vals.push(rfi.cycle + 1);
        updates.push(`status=$${i - 1}`); // already pushed status above, fix to draft
        // Replace the last status push with 'submitted'
        vals[vals.length - (vals.length - (i - 2))] = 'submitted';
      }
    }

    updates.push(`updated_at=$${i++}`); vals.push(new Date().toISOString());
    vals.push(id);

    const result = await db.query(
      `UPDATE rfis SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      vals
    );

    // Auto-create CAPA when rejected
    if (status === 'rejected') {
      try {
        const capaResult = await db.query(`
          INSERT INTO corrective_actions
            (inspection_id, title, description, priority, assigned_to, created_by, status)
          VALUES (NULL, $1, $2, 'major', $3, $4, 'open')
          RETURNING id
        `, [
          `NCR — ${rfi.rfi_number || 'RFI'}: ${rfi.description || 'Non-conformity'}`,
          qc_comments || 'RFI rejected — corrective action required',
          rfi.initiated_by,
          parseInt(user.id)
        ]);
        await db.query(
          'UPDATE rfis SET ncr_triggered=true, ncr_capa_id=$1 WHERE id=$2',
          [capaResult.rows[0].id, id]
        );
      } catch (capaErr) {
        console.error('Auto-CAPA on rejection failed:', capaErr);
        // Non-fatal — RFI update still succeeds
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('RFI PUT error:', err);
    res.status(500).json({ error: 'Failed to update RFI' });
  }
});

// ── DELETE /api/rfi/:id ───────────────────────────────────────────────────────
// Admin only
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('DELETE FROM rfis WHERE id=$1', [req.params.id]);
    res.json({ message: 'RFI deleted' });
  } catch (err) {
    console.error('RFI DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete RFI' });
  }
});

module.exports = router;
