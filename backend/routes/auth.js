const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const { sendPasswordReset } = require('../utils/email');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const pool = req.app.get('db');
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Login failed' }); }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const pool = req.app.get('db');
  const { email, currentPassword, newPassword } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [hashed, user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) { console.error('Change password error:', error); res.status(500).json({ error: 'Failed to change password' }); }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const pool = req.app.get('db');
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id, full_name, email FROM users WHERE email=$1 AND is_active=TRUE', [email]);
    // Always return success to prevent email enumeration
    if (result.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const user = result.rows[0];

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await pool.query('UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1 AND used=FALSE', [user.id]);

    // Insert new token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expiresAt]
    );

    // Send email (fire and forget)
    sendPasswordReset({ toEmail: user.email, fullName: user.full_name, resetToken: token });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) { console.error('Forgot password error:', error); res.status(500).json({ error: 'Failed to process request' }); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const pool = req.app.get('db');
  const { token, newPassword } = req.body;
  try {
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const result = await pool.query(
      `SELECT prt.*, u.email FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token=$1 AND prt.used=FALSE AND prt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const tokenRow = result.rows[0];
    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [hashed, tokenRow.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used=TRUE WHERE id=$1', [tokenRow.id]);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) { console.error('Reset password error:', error); res.status(500).json({ error: 'Failed to reset password' }); }
});

module.exports = router;
