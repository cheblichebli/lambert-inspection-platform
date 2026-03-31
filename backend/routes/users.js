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

// Password policy: min 8 chars, 1 uppercase, 1 number, 1 special character
function validatePasswordPolicy(password) {
  if (!password || password.length < 8)
    return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password))
    return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password))
    return 'Password must contain at least one special character.';
  return null;
}

// Get all users — includes locked_until and failed_attempts for admin UI
router.get('/', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at, locked_until, failed_attempts
       FROM users ORDER BY created_at DESC`
    );
    await logAudit(pool, req.user.id, 'users.list_viewed', null, null, { count: result.rows.length }, req);
    res.json(result.rows);
  } catch (error) { console.error('Get users error:', error); res.status(500).json({ error: 'Failed to fetch users' }); }
});

// Get single user
router.get('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const { id } = req.params;
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at, updated_at, locked_until, failed_attempts
       FROM users WHERE id=$1`,
      [id]
    );
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

    const policyError = validatePasswordPolicy(password);
    if (policyError) return res.status(400).json({ error: policyError });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email, hashedPassword, fullName, role]
    );

    await logAudit(pool, req.user.id, 'users.created', 'user', result.rows[0].id, { email, fullName, role }, req);

    sendWelcomeEmail({ toEmail: email, fullName, role, temporaryPassword: password });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('Create user error:', error); res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user — handles standard updates and account unlock
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { fullName, role, isActive, unlockAccount } = req.body;
  const pool = req.app.get('db');
  try {
    if (!fullName || !role || isActive === undefined)
      return res.status(400).json({ error: 'All fields are required' });

    const oldResult = await pool.query('SELECT full_name, role, is_active, locked_until FROM users WHERE id=$1', [id]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const oldData = oldResult.rows[0];

    let result;
    if (unlockAccount) {
      // Admin manually unlocking a locked account
      result = await pool.query(
        `UPDATE users SET full_name=$1, role=$2, is_active=$3, failed_attempts=0, locked_until=NULL, last_failed_at=NULL, updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 RETURNING id, email, full_name, role, is_active, locked_until, failed_attempts, updated_at`,
        [fullName, role, isActive, id]
      );
      await logAudit(pool, req.user.id, 'users.account_unlocked', 'user', id,
        { targetEmail: result.rows[0].email, previousLockUntil: oldData.locked_until }, req);
    } else {
      result = await pool.query(
        `UPDATE users SET full_name=$1, role=$2, is_active=$3, updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 RETURNING id, email, full_name, role, is_active, locked_until, failed_attempts, updated_at`,
        [fullName, role, isActive, id]
      );
      await logAudit(pool, req.user.id, 'users.updated', 'user', id,
        { before: oldData, after: { fullName, role, isActive } }, req);
    }

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

// Change password (admin-initiated)
router.put('/:id/password', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const pool = req.app.get('db');
  try {
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) return res.status(400).json({ error: policyError });

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
