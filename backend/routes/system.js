const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get audit logs (Admin only)
router.get('/audit-logs', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  const { userId, action, role, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;

  try {
    let query = `
      SELECT a.*, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let p = 0;

    if (userId) {
      p++; query += ` AND a.user_id = $${p}`; params.push(parseInt(userId));
    }
    if (action) {
      p++; query += ` AND a.action LIKE $${p}`; params.push(`%${action}%`);
    }
    if (role) {
      p++; query += ` AND u.role = $${p}`; params.push(role);
    }
    if (dateFrom) {
      p++;
      query += ` AND a.created_at >= $${p}::timestamptz`;
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      p++;
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query += ` AND a.created_at <= $${p}::timestamptz`;
      params.push(end.toISOString());
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Count query
    let countQuery = `
      SELECT COUNT(*) FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const countParams = [];
    let cp = 0;

    if (userId)   { cp++; countQuery += ` AND a.user_id = $${cp}`;       countParams.push(parseInt(userId)); }
    if (action)   { cp++; countQuery += ` AND a.action LIKE $${cp}`;     countParams.push(`%${action}%`); }
    if (role)     { cp++; countQuery += ` AND u.role = $${cp}`;           countParams.push(role); }
    if (dateFrom) {
      cp++;
      countQuery += ` AND a.created_at >= $${cp}::timestamptz`;
      countParams.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      cp++;
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      countQuery += ` AND a.created_at <= $${cp}::timestamptz`;
      countParams.push(end.toISOString());
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

// Get list of users who appear in audit logs (for filter dropdown)
router.get('/audit-users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      `SELECT DISTINCT a.user_id, a.user_name, a.user_email, u.role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.user_id IS NOT NULL
       ORDER BY a.user_name`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit users' });
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
        (SELECT COUNT(*) FROM inspections WHERE status = 'approved') as approved_inspections,
        (SELECT COUNT(*) FROM inspections WHERE status = 'rejected') as rejected_inspections,
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
