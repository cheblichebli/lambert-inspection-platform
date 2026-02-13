const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get all users (Admin and Supervisor only)
router.get('/', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const pool = req.app.get('db');
  
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), async (req, res) => {
  const { id } = req.params;
  const pool = req.app.get('db');
  
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (Admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { email, password, fullName, role } = req.body;
  const pool = req.app.get('db');

  try {
    // Validate input
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email, hashedPassword, fullName, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (Admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { fullName, role, isActive } = req.body;
  const pool = req.app.get('db');

  try {
    // Validate input
    if (!fullName || !role || isActive === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Update user
    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, role = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, full_name, role, is_active, updated_at`,
      [fullName, role, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const pool = req.app.get('db');

  try {
    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user info before deleting
    const userCheck = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = userCheck.rows[0];

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ 
      message: 'User deleted successfully', 
      user: deletedUser
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Change user password (Admin only)
router.put('/:id/password', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const pool = req.app.get('db');

  try {
    // Validate password
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, full_name`,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Password updated successfully',
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  const pool = req.app.get('db');
  
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
