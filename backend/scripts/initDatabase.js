const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'supervisor', 'inspector')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Form templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_templates (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL CHECK (category IN ('QA/QC', 'QHSE', 'Equipment Installation', 'Maintenance')),
        description TEXT,
        fields JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inspections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        template_id INTEGER REFERENCES form_templates(id),
        inspector_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
        data JSONB NOT NULL,
        location VARCHAR(255),
        equipment_id VARCHAR(100),
        notes TEXT,
        submitted_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        review_comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sync_id UUID UNIQUE,
        offline_created BOOLEAN DEFAULT false
      )
    `);

    // Photos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_photos (
        id SERIAL PRIMARY KEY,
        inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
        photo_data TEXT NOT NULL,
        caption VARCHAR(255),
        sequence_order INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sync_id UUID UNIQUE
      )
    `);

    // Sync log table for tracking offline syncs
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        sync_type VARCHAR(50) NOT NULL,
        records_synced INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
      CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id);
      CREATE INDEX IF NOT EXISTS idx_inspections_template ON inspections(template_id);
      CREATE INDEX IF NOT EXISTS idx_inspections_sync_id ON inspections(sync_id);
      CREATE INDEX IF NOT EXISTS idx_photos_inspection ON inspection_photos(inspection_id);
    `);

    // Create default admin user (password: Admin@123)
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('admin@lambertelectromec.com', $1, 'System Administrator', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully!');
    console.log('📧 Default admin: admin@lambertelectromec.com');
    console.log('🔑 Default password: Admin@123');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initDatabase().catch(console.error);
