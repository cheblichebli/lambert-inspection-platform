const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const { sendWelcomeEmail } = require('../utils/email');

async function logAudit(pool, userId, action, entityType, entityId, details, req) {
  try {
    let userEmail = null, userName = null;
    if (userId) {
      const userResult = await pool.query('SELECT email, full_name FROM users WHERE id=$1', [userId]);
      if (userResult.rows.length > 0) { userEmail = userResult.rows[0].email; userName = userResult.rows[0].full_name; }
    }
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, user_name, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, userEmail, userName, action, entityType, entityId,
        details ? JSON.stringify(details) : null,
        req.ip || req.connection?.remoteAddress || 'unknown',
        req.headers['user-agent'] || 'unknown']
    );
  } catch (error) { console.error('Audit log error:', error); }
}

// Get all users
router.get('/', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(`SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC`);
    await logAudit(pool, req.user.id, 'users.list_viewed', null, null, { count: result.rows.length }, req);
    res.json(result.rows);
  } catch (error) { console.error('Get users error:', error); res.status(500).json({ error: 'Failed to fetch users' }); }
});

// Get single user
router.get('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const { id } = req.params;
  const pool = req.app.get('db');
  try {
    const result = await pool.query(`SELECT id, email, full_name, role, is_active, created_at, updated_at FROM users WHERE id=$1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAudit(pool, req.user.id, 'users.viewed', 'user', id, null, req);
    res.json(result.rows[0]);
  } catch (error) { console.error('Get user error:', error); res.status(500).json({ error: 'Failed to fetch user' }); }
});

// Create user
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { email, password, fullName, role } = req.body;
  const pool = req.app.get('db');
  try {
    if (!email || !password || !fullName || !role)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email, hashedPassword, fullName, role]
    );

    await logAudit(pool, req.user.id, 'users.created', 'user', result.rows[0].id, { email, fullName, role }, req);

    // ── Email: welcome email to new user ───────────────────────────────
    sendWelcomeEmail({ toEmail: email, fullName, role, temporaryPassword: password });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('Create user error:', error); res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { fullName, role, isActive } = req.body;
  const pool = req.app.get('db');
  try {
    if (!fullName || !role || isActive === undefined)
      return res.status(400).json({ error: 'All fields are required' });
    const oldResult = await pool.query('SELECT full_name, role, is_active FROM users WHERE id=$1', [id]);
    const oldData = oldResult.rows[0];
    const result = await pool.query(
      `UPDATE users SET full_name=$1, role=$2, is_active=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4
       RETURNING id, email, full_name, role, is_active, updated_at`,
      [fullName, role, isActive, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAudit(pool, req.user.id, 'users.updated', 'user', id, { before: oldData, after: { fullName, role, isActive } }, req);
    res.json(result.rows[0]);
  } catch (error) { console.error('Update user error:', error); res.status(500).json({ error: 'Failed to update user' }); }
});

// Delete user
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const pool = req.app.get('db');
  try {
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ error: 'Cannot delete your own account' });
    const userCheck = await pool.query('SELECT id, email, full_name, role FROM users WHERE id=$1', [id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const deletedUser = userCheck.rows[0];
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    await logAudit(pool, req.user.id, 'users.deleted', 'user', id,
      { deletedEmail: deletedUser.email, deletedName: deletedUser.full_name, deletedRole: deletedUser.role }, req);
    res.json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) { console.error('Delete user error:', error); res.status(500).json({ error: 'Failed to delete user' }); }
});

// Change password
router.put('/:id/password', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const pool = req.app.get('db');
  try {
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id, email, full_name`,
      [hashedPassword, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAudit(pool, req.user.id, 'users.password_changed', 'user', id, { targetEmail: result.rows[0].email }, req);
    res.json({ message: 'Password updated successfully', user: result.rows[0] });
  } catch (error) { console.error('Change password error:', error); res.status(500).json({ error: 'Failed to change password' }); }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query('SELECT id, email, full_name, role, is_active FROM users WHERE id=$1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) { console.error('Get profile error:', error); res.status(500).json({ error: 'Failed to fetch profile' }); }
});

module.exports = router;
