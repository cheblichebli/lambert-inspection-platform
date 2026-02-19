1const express = require('express');
2const { authenticateToken, authorizeRoles } = require('../middleware/auth');
3const router = express.Router();
4
5// HARD RESET - Delete everything except main admin
6// Only the main admin (ID 1 or specific email) can execute this
7router.post('/hard-reset', authenticateToken, authorizeRoles('admin'), async (req, res) => {
8  const pool = req.app.get('db');
9  const { confirmationCode } = req.body;
10
11  try {
12    // Get admin email to verify this is the main admin
13    const adminCheck = await pool.query(
14      'SELECT id, email FROM users WHERE id = $1',
15      [req.user.id]
16    );
17
18    const adminEmail = adminCheck.rows[0]?.email;
19
20    // Only allow hard reset from main admin account
21    // Change this email to your actual admin email
22    const MAIN_ADMIN_EMAIL = 'admin@lambertelectromec.com';
23    
24    if (adminEmail !== MAIN_ADMIN_EMAIL) {
25      return res.status(403).json({ 
26        error: 'Only the main administrator can perform a hard reset' 
27      });
28    }
29
30    // Require confirmation code
31    if (confirmationCode !== 'RESET_EVERYTHING') {
32      return res.status(400).json({ 
33        error: 'Invalid confirmation code. Type exactly: RESET_EVERYTHING' 
34      });
35    }
36
37    // Get count of data before deletion (for confirmation)
38    const counts = await pool.query(`
39      SELECT 
40        (SELECT COUNT(*) FROM users) as users,
41        (SELECT COUNT(*) FROM form_templates) as forms,
42        (SELECT COUNT(*) FROM inspections) as inspections,
43        (SELECT COUNT(*) FROM inspection_photos) as photos
44    `);
45
46    const beforeCounts = counts.rows[0];
47
48    // BEGIN TRANSACTION
49    await pool.query('BEGIN');
50
51    try {
52      // Delete all data in correct order (respect foreign keys)
53      await pool.query('DELETE FROM inspection_photos');
54      await pool.query('DELETE FROM inspections');
55      await pool.query('DELETE FROM form_templates');
56      await pool.query('DELETE FROM sync_logs');
57      
58      // Delete all users EXCEPT the main admin
59      await pool.query(
60        'DELETE FROM users WHERE email != $1',
61        [MAIN_ADMIN_EMAIL]
62      );
63
64      // Reset all sequences
65      await pool.query('ALTER SEQUENCE inspection_photos_id_seq RESTART WITH 1');
66      await pool.query('ALTER SEQUENCE inspections_id_seq RESTART WITH 1');
67      await pool.query('ALTER SEQUENCE form_templates_id_seq RESTART WITH 1');
68      await pool.query('ALTER SEQUENCE sync_logs_id_seq RESTART WITH 1');
69      await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 2'); // Start at 2 since admin is 1
70
71      // Get counts after deletion
72      const afterCountsResult = await pool.query(`
73        SELECT 
74          (SELECT COUNT(*) FROM users) as users,
75          (SELECT COUNT(*) FROM form_templates) as forms,
76          (SELECT COUNT(*) FROM inspections) as inspections,
77          (SELECT COUNT(*) FROM inspection_photos) as photos
78      `);
79
80      const afterCounts = afterCountsResult.rows[0];
81
82      // COMMIT TRANSACTION
83      await pool.query('COMMIT');
84
85      res.json({
86        message: 'HARD RESET COMPLETE - Platform reset to factory settings',
87        before: {
88          users: parseInt(beforeCounts.users),
89          forms: parseInt(beforeCounts.forms),
90          inspections: parseInt(beforeCounts.inspections),
91          photos: parseInt(beforeCounts.photos)
92        },
93        after: {
94          users: parseInt(afterCounts.users),
95          forms: parseInt(afterCounts.forms),
96          inspections: parseInt(afterCounts.inspections),
97          photos: parseInt(afterCounts.photos)
98        },
99        deleted: {
100          users: parseInt(beforeCounts.users) - parseInt(afterCounts.users),
101          forms: parseInt(beforeCounts.forms),
102          inspections: parseInt(beforeCounts.inspections),
103          photos: parseInt(beforeCounts.photos)
104        },
105        remaining: {
106          adminAccount: adminEmail
107        }
108      });
109
110    } catch (error) {
111      // ROLLBACK on error
112      await pool.query('ROLLBACK');
113      throw error;
114    }
115
116  } catch (error) {
117    console.error('Hard reset error:', error);
118    res.status(500).json({ error: 'Failed to execute hard reset' });
119  }
120});
121
122// Get system stats (for dashboard)
123router.get('/stats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
124  const pool = req.app.get('db');
125
126  try {
127    const stats = await pool.query(`
128      SELECT 
129        (SELECT COUNT(*) FROM users) as total_users,
130        (SELECT COUNT(*) FROM users WHERE role = 'admin') as admins,
131        (SELECT COUNT(*) FROM users WHERE role = 'inspector') as inspectors,
132        (SELECT COUNT(*) FROM users WHERE role = 'supervisor') as supervisors,
133        (SELECT COUNT(*) FROM form_templates) as forms,
134        (SELECT COUNT(*) FROM form_templates WHERE is_active = true) as active_forms,
135        (SELECT COUNT(*) FROM inspections) as inspections,
136        (SELECT COUNT(*) FROM inspections WHERE status = 'submitted') as submitted_inspections,
137        (SELECT COUNT(*) FROM inspection_photos) as photos,
138        (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size
139    `);
140
141    res.json(stats.rows[0]);
142  } catch (error) {
143    console.error('Get stats error:', error);
144    res.status(500).json({ error: 'Failed to get stats' });
145  }
146});
147
148module.exports = router;
149
