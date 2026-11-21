require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

let pool = null;

function getPool() {
  if (!pool) {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is not defined in environment variables! Please add DATABASE_URL in Vercel settings.');
    }
    pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

// Execute a query and return all rows
async function queryAll(sql, params = []) {
  const pgSql = toPgPlaceholders(sql);
  const { rows } = await getPool().query(pgSql, params);
  return rows;
}

// Execute a query and return the first row (or null)
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Execute a statement (INSERT / UPDATE / DELETE)
async function run(sql, params = []) {
  const pgSql = toPgPlaceholders(sql);
  await getPool().query(pgSql, params);
}

// Run multiple statements inside a single transaction
async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Provide scoped helpers that use the same client
    const clientQueryAll = async (sql, params = []) => {
      const { rows } = await client.query(toPgPlaceholders(sql), params);
      return rows;
    };
    const clientQueryOne = async (sql, params = []) => {
      const rows = await clientQueryAll(sql, params);
      return rows.length > 0 ? rows[0] : null;
    };
    const clientRun = async (sql, params = []) => {
      await client.query(toPgPlaceholders(sql), params);
    };
    const result = await fn({ queryAll: clientQueryAll, queryOne: clientQueryOne, run: clientRun });
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, … placeholders
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function initDb() {
  const p = getPool();
  // Create all tables
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'worker')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      month_label TEXT NOT NULL,
      filename TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      total_facilities INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      serial_no INTEGER NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      center TEXT NOT NULL,
      facility_code TEXT NOT NULL,
      target_date TEXT DEFAULT '',
      plan_notes TEXT DEFAULT '',
      activity_type TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'completed')),
      reserved_by_id TEXT,
      reserved_by_name TEXT,
      reserved_at TEXT,
      completed_by_id TEXT,
      completed_by_name TEXT,
      completed_at TEXT,
      visit_outcome TEXT DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      samples_json TEXT NOT NULL,
      notes TEXT DEFAULT '',
      gps_lat REAL,
      gps_lng REAL,
      gps_accuracy REAL,
      signature_base64 TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      visit_outcome TEXT NOT NULL DEFAULT 'inspected',
      compliance_json TEXT DEFAULT '{}',
      violation_level TEXT NOT NULL DEFAULT 'none',
      representative_name TEXT DEFAULT '',
      representative_phone TEXT DEFAULT '',
      followup_required INTEGER NOT NULL DEFAULT 0,
      followup_date TEXT DEFAULT '',
      client_id TEXT DEFAULT '',
      record_status TEXT NOT NULL DEFAULT 'valid',
      FOREIGN KEY (facility_id) REFERENCES facilities(id)
    );

    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      facility_id TEXT,
      facility_name TEXT NOT NULL,
      center TEXT DEFAULT '',
      worker_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('reserved','released','expired','completed','unlocked','plan_uploaded')),
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Indexes
  await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_insp_client ON inspections(client_id) WHERE client_id <> ''`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_fac_plan ON facilities(plan_id, status)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_insp_plan ON inspections(plan_id, facility_id)`);

  // Seed default users if table is empty
  const { rows } = await p.query('SELECT COUNT(*) AS cnt FROM users');
  if (parseInt(rows[0].cnt, 10) === 0) {
    const now = new Date().toISOString();
    const seedUsers = [
      { id: uuidv4(), name: 'مدير النظام (الأدمن)', code: 'ADMIN-2026', role: 'admin' },
      { id: uuidv4(), name: 'أحمد علي',   code: 'W101', role: 'worker' },
      { id: uuidv4(), name: 'محمد حسن',   code: 'W102', role: 'worker' },
      { id: uuidv4(), name: 'كريم محمود', code: 'W103', role: 'worker' },
    ];
    for (const u of seedUsers) {
      await p.query(
        'INSERT INTO users (id, name, code, role, active, created_at) VALUES ($1, $2, $3, $4, 1, $5)',
        [u.id, u.name, u.code, u.role, now]
      );
    }
    console.log('✅ Seeded default users (admin + 3 workers)');
  }

  return p;
}

module.exports = { initDb, queryAll, queryOne, run, transaction, getPool };
