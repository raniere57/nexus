import { Database } from 'bun:sqlite';

// Initialize the database with WAL mode for better concurrency
const dbPath = process.env.DB_PATH || 'nexus.db';
const db = new Database(dbPath, { create: true });
db.exec('PRAGMA journal_mode = WAL;');
// Important PRAGMAs for performance
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA TEMP_STORE = MEMORY;');
db.exec('PRAGMA foreign_keys = ON;');

export { db };

// Initialize Schema
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      groupName TEXT DEFAULT 'default',
      host TEXT,
      baseUrl TEXT,
      environment TEXT DEFAULT 'production',
      checkIntervalSeconds INTEGER DEFAULT 60,
      timeoutSeconds INTEGER DEFAULT 10,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checkers (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      configJson TEXT DEFAULT '{}',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checker_results (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      checkerId TEXT NOT NULL,
      status TEXT NOT NULL,
      responseTimeMs INTEGER NOT NULL,
      statusCode INTEGER,
      errorMessage TEXT,
      checkedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(checkerId) REFERENCES checkers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_checker_results_checkedAt ON checker_results(checkedAt);
    CREATE INDEX IF NOT EXISTS idx_checker_results_serviceId ON checker_results(serviceId);

    CREATE TABLE IF NOT EXISTS service_snapshots (
      serviceId TEXT PRIMARY KEY,
      overallStatus TEXT NOT NULL DEFAULT 'unknown',
      lastCheckedAt TEXT,
      lastOkAt TEXT,
      lastFailureAt TEXT,
      checkerSummaryJson TEXT DEFAULT '{}',
      FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS auth_roles (
      role TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
  `);

  // Simple migrations for new columns
  try { db.exec("ALTER TABLE services ADD COLUMN groupName TEXT DEFAULT 'default';"); } catch (e) {}
  try { db.exec("ALTER TABLE services ADD COLUMN environment TEXT DEFAULT 'production';"); } catch (e) {}
  try { db.exec("ALTER TABLE services ADD COLUMN checkIntervalSeconds INTEGER DEFAULT 60;"); } catch (e) {}
  try { db.exec("ALTER TABLE services ADD COLUMN timeoutSeconds INTEGER DEFAULT 10;"); } catch (e) {}

  try {
    const checkAuth = db.query(`SELECT COUNT(*) as c FROM auth_roles`).get() as { c: number };
    if (checkAuth.c === 0) {
      db.prepare(`INSERT INTO auth_roles (role, password_hash) VALUES (?, ?)`).run('viewer', '$argon2id$v=19$m=65536,t=2,p=1$H6GuKMst0QVNTZE6kdv5Yfhq2PTm55LdXb6mPs6SQtw$y504GC3OtlUstmCxUUgG0Ji6tOwKo0pP26fSIF/5FSA');
      db.prepare(`INSERT INTO auth_roles (role, password_hash) VALUES (?, ?)`).run('admin', '$argon2id$v=19$m=65536,t=2,p=1$PoBu5QJEWxf8dkM6mBmtraYyfR/lVOVSEGwu2FPuoVg$zrLJ5LyCS7Tow1l4z6HNzwa0A6cp5jChL9MvxXEscio');
    }
  } catch (e) {
    console.error('Error initializing auth table', e);
  }

  console.log('[DB] Database schema initialized');
}
