const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get audit logs (Admin only)
router.get('/audit-logs', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { userId, action, limit = 100, offset = 0 } = req.query;

  try {
    let query = `
      SELECT * FROM audit_logs
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    if (action) {
      paramCount++;
      query += ` AND action LIKE $${paramCount}`;
      params.push(`%${action}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;

    if (userId) {
      countParamCount++;
      countQuery += ` AND user_id = $${countParamCount}`;
      countParams.push(userId);
    }

    if (action) {
      countParamCount++;
      countQuery += ` AND action LIKE $${countParamCount}`;
      countParams.push(`%${action}%`);
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

module.exports = router;
