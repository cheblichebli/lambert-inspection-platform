const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const { sendPasswordReset } = require('../utils/email');

// ─── Helpers ────────────────────────────────────────────────────────────────

const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;

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

// Log an audit event
async function logAudit(pool, { userId, userEmail, userName, action, entityType, entityId, details, req }) {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    const ua = req.headers['user-agent'] || '';
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, user_name, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, userEmail, userName, action, entityType, entityId, JSON.stringify(details), ip, ua]
    );
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

// Hash a JWT token for safe storage in DB
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const pool = req.app.get('db');
  const { email, password } = req.body;
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const ua = req.headers['user-agent'] || '';

  try {
    // Fetch user (active or not — we need to check lockout regardless)
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);

    if (result.rows.length === 0) {
      // Log failed attempt for unknown email
      await logAudit(pool, {
        userId: null, userEmail: email, userName: 'Unknown',
        action: 'auth.login_failed', entityType: 'user', entityId: null,
        details: { reason: 'User not found', email },
        req
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      await logAudit(pool, {
        userId: user.id, userEmail: user.email, userName: user.full_name,
        action: 'auth.login_blocked', entityType: 'user', entityId: user.id,
        details: { reason: 'Account locked', locked_until: user.locked_until },
        req
      });
      return res.status(423).json({
        error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`
      });
    }

    // Check active status
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive. Contact your administrator.' });
    }

    // Validate password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      // Increment failed attempts
      const newAttempts = (user.failed_attempts || 0) + 1;
      let lockUntil = null;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }

      await pool.query(
        'UPDATE users SET failed_attempts=$1, last_failed_at=NOW(), locked_until=$2 WHERE id=$3',
        [newAttempts, lockUntil, user.id]
      );

      await logAudit(pool, {
        userId: user.id, userEmail: user.email, userName: user.full_name,
        action: 'auth.login_failed', entityType: 'user', entityId: user.id,
        details: { reason: 'Wrong password', attempt: newAttempts, locked: !!lockUntil },
        req
      });

      if (lockUntil) {
        return res.status(423).json({
          error: `Too many failed attempts. Account locked for 30 minutes.`
        });
      }

      const attemptsLeft = MAX_FAILED_ATTEMPTS - newAttempts;
      return res.status(401).json({
        error: `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.`
      });
    }

    // ✅ Successful login — reset failed attempts
    await pool.query(
      'UPDATE users SET failed_attempts=0, locked_until=NULL, last_failed_at=NULL WHERE id=$1',
      [user.id]
    );

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Register session in DB
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [user.id, tokenHash, ip, ua, expiresAt]
    );

    // Log successful login
    await logAudit(pool, {
      userId: user.id, userEmail: user.email, userName: user.full_name,
      action: 'auth.login_success', entityType: 'user', entityId: user.id,
      details: { role: user.role },
      req
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const pool = req.app.get('db');
  const authHeader = req.headers.authorization;

  try {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const tokenHash = hashToken(token);
      await pool.query(
        'UPDATE sessions SET revoked=TRUE, revoked_at=NOW() WHERE token_hash=$1',
        [tokenHash]
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ message: 'Logged out' }); // Always succeed from client perspective
  }
});

// ─── POST /api/auth/change-password ─────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  const pool = req.app.get('db');
  const { email, currentPassword, newPassword } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    // Enforce password policy
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) return res.status(400).json({ error: policyError });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
      [hashed, user.id]
    );

    await logAudit(pool, {
      userId: user.id, userEmail: user.email, userName: user.full_name,
      action: 'auth.password_changed', entityType: 'user', entityId: user.id,
      details: { method: 'self_service' },
      req
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const pool = req.app.get('db');
  const { email } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE email=$1 AND is_active=TRUE',
      [email]
    );
    if (result.rows.length === 0)
      return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1 AND used=FALSE',
      [user.id]
    );
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expiresAt]
    );

    sendPasswordReset({ toEmail: user.email, fullName: user.full_name, resetToken: token });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const pool = req.app.get('db');
  const { token, newPassword } = req.body;
  try {
    if (!token || !newPassword)
      return res.status(400).json({ error: 'Token and new password are required' });

    // Enforce password policy
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) return res.status(400).json({ error: policyError });

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

    await pool.query(
      'UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
      [hashed, tokenRow.user_id]
    );
    await pool.query('UPDATE password_reset_tokens SET used=TRUE WHERE id=$1', [tokenRow.id]);

    await logAudit(pool, {
      userId: tokenRow.user_id, userEmail: tokenRow.email, userName: '',
      action: 'auth.password_reset', entityType: 'user', entityId: tokenRow.user_id,
      details: { method: 'reset_link' },
      req
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
