const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Sync offline inspections
router.post('/inspections', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  const { inspections } = req.body;
  
  if (!Array.isArray(inspections) || inspections.length === 0) {
    return res.status(400).json({ error: 'Invalid sync data' });
  }

  const client = await pool.connect();
  const syncResults = {
    success: [],
    failed: [],
    totalSynced: 0
  };

  try {
    await client.query('BEGIN');

    for (const inspection of inspections) {
      try {
        // Check if inspection already exists by sync_id
        const existingResult = await client.query(
          'SELECT id FROM inspections WHERE sync_id = $1',
          [inspection.syncId]
        );

        let inspectionId;

        if (existingResult.rows.length > 0) {
          // Update existing inspection
          inspectionId = existingResult.rows[0].id;
          await client.query(
            `UPDATE inspections
             SET data = $1, location = $2, equipment_id = $3, notes = $4,
                 status = $5, updated_at = CURRENT_TIMESTAMP,
                 submitted_at = $6
             WHERE id = $7`,
            [
              JSON.stringify(inspection.data),
              inspection.location,
              inspection.equipmentId,
              inspection.notes,
              inspection.status,
              inspection.submittedAt,
              inspectionId
            ]
          );
        } else {
          // Create new inspection
          const inspectionResult = await client.query(
            `INSERT INTO inspections
             (template_id, inspector_id, status, data, location, equipment_id, notes,
              sync_id, submitted_at, offline_created)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
              inspection.templateId,
              req.user.id,
              inspection.status,
              JSON.stringify(inspection.data),
              inspection.location,
              inspection.equipmentId,
              inspection.notes,
              inspection.syncId || uuidv4(),
              inspection.submittedAt,
              true
            ]
          );
          inspectionId = inspectionResult.rows[0].id;
        }

        // Sync photos
        if (inspection.photos && inspection.photos.length > 0) {
          // Delete existing photos for this inspection
          await client.query(
            'DELETE FROM inspection_photos WHERE inspection_id = $1',
            [inspectionId]
          );

          // Add new photos
          for (let i = 0; i < inspection.photos.length; i++) {
            const photo = inspection.photos[i];
            await client.query(
              `INSERT INTO inspection_photos
               (inspection_id, photo_data, caption, sequence_order, sync_id)
               VALUES ($1, $2, $3, $4, $5)`,
              [inspectionId, photo.data, photo.caption || '', i, photo.syncId || uuidv4()]
            );
          }
        }

        syncResults.success.push({
          syncId: inspection.syncId,
          serverId: inspectionId
        });
        syncResults.totalSynced++;

      } catch (itemError) {
        console.error('Sync item error:', itemError);
        syncResults.failed.push({
          syncId: inspection.syncId,
          error: itemError.message
        });
      }
    }

    // Log sync activity
    await client.query(
      `INSERT INTO sync_logs (user_id, sync_type, records_synced, status)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'inspection', syncResults.totalSynced, 
       syncResults.failed.length === 0 ? 'success' : 'partial']
    );

    await client.query('COMMIT');
    res.json(syncResults);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync error:', error);
    
    await client.query(
      `INSERT INTO sync_logs (user_id, sync_type, status, error_message)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'inspection', 'failed', error.message]
    );
    
    res.status(500).json({ error: 'Sync failed', details: error.message });
  } finally {
    client.release();
  }
});

// Get data for offline use (forms and user info)
router.get('/download', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  
  try {
    // Get active form templates
    const formsResult = await pool.query(
      `SELECT id, title, category, description, fields
       FROM form_templates
       WHERE is_active = true
       ORDER BY created_at DESC`
    );

    // Get user's pending inspections
    const inspectionsResult = await pool.query(
      `SELECT i.*, ft.title as template_title, ft.fields as template_fields
       FROM inspections i
       LEFT JOIN form_templates ft ON i.template_id = ft.id
       WHERE i.inspector_id = $1 AND i.status IN ('draft', 'submitted')
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );

    // Get photos for those inspections
    const inspectionIds = inspectionsResult.rows.map(i => i.id);
    let photos = [];
    
    if (inspectionIds.length > 0) {
      const photosResult = await pool.query(
        `SELECT inspection_id, photo_data, caption, sequence_order
         FROM inspection_photos
         WHERE inspection_id = ANY($1)
         ORDER BY inspection_id, sequence_order`,
        [inspectionIds]
      );
      photos = photosResult.rows;
    }

    res.json({
      forms: formsResult.rows,
      inspections: inspectionsResult.rows,
      photos: photos,
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Download data error:', error);
    res.status(500).json({ error: 'Failed to download data' });
  }
});

// Get sync history
router.get('/history', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  
  try {
    const result = await pool.query(
      `SELECT * FROM sync_logs
       WHERE user_id = $1
       ORDER BY synced_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

module.exports = router;
