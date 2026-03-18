const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const {
  sendInspectionSubmitted,
  sendInspectionApproved,
  sendInspectionRejected,
} = require('../utils/email');

// ─── Audit helper ─────────────────────────────────────────────────────────────
async function logAudit(pool, userId, action, entityType, entityId, details, req) {
  try {
    let userEmail = null;
    let userName = null;
    if (userId) {
      const userResult = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        userEmail = userResult.rows[0].email;
        userName = userResult.rows[0].full_name;
      }
    }
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, user_name, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, userEmail, userName, action, entityType, entityId,
        details ? JSON.stringify(details) : null,
        req.ip || req.connection?.remoteAddress || 'unknown',
        req.headers['user-agent'] || 'unknown']
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// Get all inspections
router.get('/', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { status, templateId, inspectorId } = req.query;
  try {
    let query = `
      SELECT i.*,
             ft.title as template_title,
             u1.full_name as inspector_name,
             u2.full_name as reviewer_name,
             (SELECT COUNT(*) FROM inspection_photos WHERE inspection_id = i.id) as photo_count
      FROM inspections i
      LEFT JOIN form_templates ft ON i.template_id = ft.id
      LEFT JOIN users u1 ON i.inspector_id = u1.id
      LEFT JOIN users u2 ON i.reviewed_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role === 'inspector') {
      params.push(req.user.id);
      query += ` AND i.inspector_id = $${params.length}`;
    } else if (inspectorId) {
      params.push(inspectorId);
      query += ` AND i.inspector_id = $${params.length}`;
    }
    if (status) { params.push(status); query += ` AND i.status = $${params.length}`; }
    if (templateId) { params.push(templateId); query += ` AND i.template_id = $${params.length}`; }
    query += ' ORDER BY i.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get inspections error:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// Get single inspection with photos
router.get('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  try {
    const inspectionResult = await pool.query(
      `SELECT i.*,
              ft.title as template_title,
              ft.fields as template_fields,
              u1.full_name as inspector_name,
              u2.full_name as reviewer_name
       FROM inspections i
       LEFT JOIN form_templates ft ON i.template_id = ft.id
       LEFT JOIN users u1 ON i.inspector_id = u1.id
       LEFT JOIN users u2 ON i.reviewed_by = u2.id
       WHERE i.id = $1`, [id]
    );
    if (inspectionResult.rows.length === 0) return res.status(404).json({ error: 'Inspection not found' });
    const inspection = inspectionResult.rows[0];
    if (req.user.role === 'inspector' && inspection.inspector_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const photosResult = await pool.query(
      `SELECT id, caption, sequence_order, photo_data, created_at FROM inspection_photos WHERE inspection_id = $1 ORDER BY sequence_order`, [id]
    );
    inspection.photos = photosResult.rows;
    res.json(inspection);
  } catch (error) {
    console.error('Get inspection error:', error);
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

// Create inspection
router.post('/', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { templateId, data, location, equipmentId, notes, photos,
    status = 'draft', gpsLatitude, gpsLongitude, gpsAccuracy,
    inspectorSignature, scannedCodes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const syncId = uuidv4();
    const inspectionResult = await client.query(
      `INSERT INTO inspections
       (template_id, inspector_id, status, data, location, equipment_id, notes, sync_id,
        submitted_at, offline_created, gps_latitude, gps_longitude, gps_accuracy, gps_timestamp,
        inspector_signature, signature_timestamp, scanned_codes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [templateId, req.user.id, status, JSON.stringify(data), location, equipmentId, notes, syncId,
        status === 'submitted' ? new Date() : null, false,
        gpsLatitude || null, gpsLongitude || null, gpsAccuracy || null,
        (gpsLatitude && gpsLongitude) ? new Date() : null,
        inspectorSignature || null, inspectorSignature ? new Date() : null,
        JSON.stringify(scannedCodes || [])]
    );
    const inspection = inspectionResult.rows[0];
    if (photos && photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        await client.query(
          `INSERT INTO inspection_photos (inspection_id, photo_data, caption, sequence_order, sync_id) VALUES ($1,$2,$3,$4,$5)`,
          [inspection.id, photo.data, photo.caption || '', i, uuidv4()]
        );
      }
    }
    await client.query('COMMIT');

    const tmpl = await pool.query('SELECT title FROM form_templates WHERE id = $1', [templateId]);
    const templateTitle = tmpl.rows[0]?.title || `Template #${templateId}`;

    if (status === 'submitted') {
      await logAudit(pool, req.user.id, 'inspections.submitted', 'inspection', inspection.id,
        { templateTitle, location, equipmentId }, req);
      // ── Email: notify all supervisors + admins ──────────────────────────
      const supervisors = await pool.query(
        `SELECT email FROM users WHERE role IN ('supervisor','admin') AND is_active = TRUE`
      );
      const inspectorRow = await pool.query('SELECT full_name FROM users WHERE id=$1', [req.user.id]);
      sendInspectionSubmitted({
        toEmails: supervisors.rows.map(r => r.email),
        inspectorName: inspectorRow.rows[0]?.full_name || 'Inspector',
        templateTitle,
        location,
        equipmentId,
        inspectionId: inspection.id,
      });
    } else {
      await logAudit(pool, req.user.id, 'inspections.created', 'inspection', inspection.id,
        { templateTitle, location, equipmentId, status }, req);
    }
    if (inspectorSignature)
      await logAudit(pool, req.user.id, 'inspections.signed', 'inspection', inspection.id,
        { templateTitle, signatureType: 'inspector' }, req);
    if (photos && photos.length > 0)
      await logAudit(pool, req.user.id, 'inspections.photos_uploaded', 'inspection', inspection.id,
        { templateTitle, photoCount: photos.length }, req);

    res.status(201).json(inspection);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create inspection error:', error);
    res.status(500).json({ error: error.message || 'Failed to create inspection' });
  } finally {
    client.release();
  }
});

// Update inspection
router.put('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { data, location, equipmentId, notes, status,
    gpsLatitude, gpsLongitude, gpsAccuracy, inspectorSignature, scannedCodes } = req.body;
  try {
    const checkResult = await pool.query('SELECT inspector_id, status, template_id FROM inspections WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Inspection not found' });
    const existing = checkResult.rows[0];
    if (req.user.role === 'inspector' &&
      (existing.inspector_id !== req.user.id || existing.status !== 'draft'))
      return res.status(403).json({ error: 'Cannot edit this inspection' });

    const result = await pool.query(
      `UPDATE inspections SET data=$1, location=$2, equipment_id=$3, notes=$4,
       status=$5, updated_at=CURRENT_TIMESTAMP,
       submitted_at=CASE WHEN $5='submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
       gps_latitude=COALESCE($7,gps_latitude), gps_longitude=COALESCE($8,gps_longitude),
       gps_accuracy=COALESCE($9,gps_accuracy),
       gps_timestamp=CASE WHEN $7 IS NOT NULL AND $8 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE gps_timestamp END,
       inspector_signature=COALESCE($10,inspector_signature),
       signature_timestamp=CASE WHEN $10 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE signature_timestamp END,
       scanned_codes=COALESCE($11,scanned_codes)
       WHERE id=$6 RETURNING *`,
      [JSON.stringify(data), location, equipmentId, notes, status || existing.status, id,
        gpsLatitude, gpsLongitude, gpsAccuracy, inspectorSignature,
        scannedCodes ? JSON.stringify(scannedCodes) : null]
    );

    const tmpl = await pool.query('SELECT title FROM form_templates WHERE id=$1', [existing.template_id]);
    const templateTitle = tmpl.rows[0]?.title || `Template #${existing.template_id}`;
    const newStatus = status || existing.status;

    if (newStatus === 'submitted' && existing.status !== 'submitted') {
      await logAudit(pool, req.user.id, 'inspections.submitted', 'inspection', id,
        { templateTitle, location, equipmentId }, req);
      // ── Email: notify all supervisors + admins ──────────────────────────
      const supervisors = await pool.query(
        `SELECT email FROM users WHERE role IN ('supervisor','admin') AND is_active = TRUE`
      );
      const inspectorRow = await pool.query('SELECT full_name FROM users WHERE id=$1', [req.user.id]);
      sendInspectionSubmitted({
        toEmails: supervisors.rows.map(r => r.email),
        inspectorName: inspectorRow.rows[0]?.full_name || 'Inspector',
        templateTitle,
        location,
        equipmentId,
        inspectionId: id,
      });
    } else {
      await logAudit(pool, req.user.id, 'inspections.updated', 'inspection', id,
        { templateTitle, location }, req);
    }
    if (inspectorSignature)
      await logAudit(pool, req.user.id, 'inspections.signed', 'inspection', id,
        { templateTitle, signatureType: 'inspector' }, req);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// Review inspection
router.post('/:id/review', authenticateToken, authorizeRoles('supervisor', 'admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { status, comments, supervisorSignature } = req.body;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  try {
    const result = await pool.query(
      `UPDATE inspections SET status=$1, review_comments=$2, reviewed_by=$3,
       reviewed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP, supervisor_signature=$5
       WHERE id=$4 AND status='submitted'
       RETURNING *, (SELECT title FROM form_templates WHERE id=template_id) as template_title`,
      [status, comments, req.user.id, id, supervisorSignature || null]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Inspection not found or not submitted' });
    const inspection = result.rows[0];

    await logAudit(pool, req.user.id, `inspections.${status}`, 'inspection', id,
      { templateTitle: inspection.template_title, reviewComments: comments || null }, req);
    if (supervisorSignature)
      await logAudit(pool, req.user.id, 'inspections.signed', 'inspection', id,
        { templateTitle: inspection.template_title, signatureType: 'supervisor' }, req);

    // ── Email: notify inspector ─────────────────────────────────────────
    if (inspection.inspector_id) {
      const inspectorRow = await pool.query(
        'SELECT email, full_name FROM users WHERE id=$1', [inspection.inspector_id]
      );
      const reviewerRow = await pool.query(
        'SELECT full_name FROM users WHERE id=$1', [req.user.id]
      );
      const inspector = inspectorRow.rows[0];
      const reviewer = reviewerRow.rows[0];
      if (inspector) {
        const emailFn = status === 'approved' ? sendInspectionApproved : sendInspectionRejected;
        emailFn({
          toEmail: inspector.email,
          inspectorName: inspector.full_name,
          templateTitle: inspection.template_title,
          location: inspection.location,
          reviewerName: reviewer?.full_name || 'Supervisor',
          comments,
          inspectionId: id,
        });
      }
    }

    res.json(inspection);
  } catch (error) {
    console.error('Review inspection error:', error);
    res.status(500).json({ error: 'Failed to review inspection' });
  }
});

// Delete inspection
router.delete('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  try {
    const details = await pool.query(
      `SELECT i.equipment_id, i.location, ft.title as template_title
       FROM inspections i LEFT JOIN form_templates ft ON i.template_id=ft.id WHERE i.id=$1`, [id]
    );
    let query = 'DELETE FROM inspections WHERE id=$1';
    const params = [id];
    if (req.user.role === 'inspector') {
      query += ' AND inspector_id=$2 AND status=$3';
      params.push(req.user.id, 'draft');
    }
    query += ' RETURNING id';
    const result = await pool.query(query, params);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Inspection not found or cannot be deleted' });
    const d = details.rows[0] || {};
    await logAudit(pool, req.user.id, 'inspections.deleted', 'inspection', id,
      { templateTitle: d.template_title, location: d.location, equipmentId: d.equipment_id }, req);
    res.json({ message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ error: 'Failed to delete inspection' });
  }
});

// Stats
router.get('/stats/summary', authenticateToken, authorizeRoles('supervisor', 'admin'), async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='draft') as draft_count,
        COUNT(*) FILTER (WHERE status='submitted') as submitted_count,
        COUNT(*) FILTER (WHERE status='approved') as approved_count,
        COUNT(*) FILTER (WHERE status='rejected') as rejected_count,
        COUNT(*) as total_count
      FROM inspections
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
