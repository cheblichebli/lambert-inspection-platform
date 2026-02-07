const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

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
    
    // Inspectors can only see their own inspections
    if (req.user.role === 'inspector') {
      params.push(req.user.id);
      query += ` AND i.inspector_id = $${params.length}`;
    } else if (inspectorId) {
      params.push(inspectorId);
      query += ` AND i.inspector_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }
    
    if (templateId) {
      params.push(templateId);
      query += ` AND i.template_id = $${params.length}`;
    }
    
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
    // Get inspection
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
       WHERE i.id = $1`,
      [id]
    );

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Check permissions
    const inspection = inspectionResult.rows[0];
    if (req.user.role === 'inspector' && inspection.inspector_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get photos
    const photosResult = await pool.query(
      `SELECT id, caption, sequence_order, photo_data, created_at
       FROM inspection_photos
       WHERE inspection_id = $1
       ORDER BY sequence_order`,
      [id]
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
  const { templateId, data, location, equipmentId, notes, photos, status = 'draft' } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Validate photo limit
    if (photos && photos.length > 5) {
      throw new Error('Maximum 5 photos allowed per inspection');
    }

    const syncId = uuidv4();
    
    // Create inspection
    const inspectionResult = await client.query(
      `INSERT INTO inspections 
       (template_id, inspector_id, status, data, location, equipment_id, notes, sync_id, 
        submitted_at, offline_created)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        templateId, 
        req.user.id, 
        status, 
        JSON.stringify(data), 
        location, 
        equipmentId, 
        notes, 
        syncId,
        status === 'submitted' ? new Date() : null,
        false
      ]
    );

    const inspection = inspectionResult.rows[0];

    // Add photos if provided
    if (photos && photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        await client.query(
          `INSERT INTO inspection_photos 
           (inspection_id, photo_data, caption, sequence_order, sync_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [inspection.id, photo.data, photo.caption || '', i, uuidv4()]
        );
      }
    }

    await client.query('COMMIT');
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
  const { data, location, equipmentId, notes, status } = req.body;
  
  try {
    // Check if inspection exists and user has permission
    const checkResult = await pool.query(
      'SELECT inspector_id, status FROM inspections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const inspection = checkResult.rows[0];
    
    // Only inspector can edit their own draft inspections
    if (req.user.role === 'inspector' && 
        (inspection.inspector_id !== req.user.id || inspection.status !== 'draft')) {
      return res.status(403).json({ error: 'Cannot edit this inspection' });
    }

    const result = await pool.query(
      `UPDATE inspections
       SET data = $1, location = $2, equipment_id = $3, notes = $4, 
           status = $5, updated_at = CURRENT_TIMESTAMP,
           submitted_at = CASE WHEN $5 = 'submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END
       WHERE id = $6
       RETURNING *`,
      [JSON.stringify(data), location, equipmentId, notes, status || inspection.status, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// Review inspection (Supervisor/Admin only)
router.post('/:id/review', authenticateToken, authorizeRoles('supervisor', 'admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { status, comments } = req.body;
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  try {
    const result = await pool.query(
      `UPDATE inspections
       SET status = $1, review_comments = $2, reviewed_by = $3, 
           reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND status = 'submitted'
       RETURNING *`,
      [status, comments, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or not submitted' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Review inspection error:', error);
    res.status(500).json({ error: 'Failed to review inspection' });
  }
});

// Delete inspection (own draft only, or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  
  try {
    let query = 'DELETE FROM inspections WHERE id = $1';
    const params = [id];
    
    // Inspectors can only delete their own drafts
    if (req.user.role === 'inspector') {
      query += ' AND inspector_id = $2 AND status = $3';
      params.push(req.user.id, 'draft');
    }
    
    query += ' RETURNING id';
    
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or cannot be deleted' });
    }

    res.json({ message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ error: 'Failed to delete inspection' });
  }
});

// Get inspection statistics
router.get('/stats/summary', authenticateToken, authorizeRoles('supervisor', 'admin'), async (req, res) => {
  const pool = req.app.get('db');
  
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
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
