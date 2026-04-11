import { Database } from 'bun:sqlite';

// Initialize the database with WAL mode for better concurrency
const dbPath = process.env.DB_PATH || 'nexus.db';
let db: Database;

try {
  console.log(`[DB] Opening database at ${dbPath}`);
  db = new Database(dbPath, { create: true });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA TEMP_STORE = MEMORY;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e: any) {
  console.error(`[DB] CRITICAL ERROR opening database: ${e.message}`);
  // If we can't open the DB, the app will likely crash soon, which is what we want for logs
  throw e; 
}

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

    CREATE TABLE IF NOT EXISTS log_issue_clusters (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      checkerId TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      normalizedMessage TEXT NOT NULL,
      title TEXT NOT NULL,
      sampleLog TEXT NOT NULL,
      totalCount INTEGER NOT NULL DEFAULT 0,
      firstSeenAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      sourceType TEXT NOT NULL,
      metadataJson TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(checkerId, fingerprint),
      FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(checkerId) REFERENCES checkers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS log_issue_buckets (
      clusterId TEXT NOT NULL,
      bucketStart TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(clusterId, bucketStart),
      FOREIGN KEY(clusterId) REFERENCES log_issue_clusters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monitoring_alerts (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      checkerId TEXT,
      clusterId TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      eventType TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      fingerprint TEXT,
      metadataJson TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      acknowledgedAt TEXT,
      FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(checkerId) REFERENCES checkers(id) ON DELETE SET NULL,
      FOREIGN KEY(clusterId) REFERENCES log_issue_clusters(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_checker_results_checkedAt ON checker_results(checkedAt);
    CREATE INDEX IF NOT EXISTS idx_checker_results_serviceId ON checker_results(serviceId);
    CREATE INDEX IF NOT EXISTS idx_log_issue_clusters_serviceId ON log_issue_clusters(serviceId);
    CREATE INDEX IF NOT EXISTS idx_log_issue_clusters_checkerId ON log_issue_clusters(checkerId);
    CREATE INDEX IF NOT EXISTS idx_log_issue_clusters_lastSeenAt ON log_issue_clusters(lastSeenAt);
    CREATE INDEX IF NOT EXISTS idx_log_issue_buckets_bucketStart ON log_issue_buckets(bucketStart);
    CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_createdAt ON monitoring_alerts(createdAt);
    CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_serviceId ON monitoring_alerts(serviceId);

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

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      sshPort INTEGER DEFAULT 22,
      sshUser TEXT DEFAULT 'root',
      sshPassword TEXT DEFAULT '',
      checkIntervalSeconds INTEGER DEFAULT 60,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_snapshots (
      serverId TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'unknown',
      cpuPercent REAL,
      ramPercent REAL,
      diskPercent REAL,
      uptimeSeconds INTEGER,
      lastCheckedAt TEXT,
      FOREIGN KEY(serverId) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  // Simple migrations for new columns
  try { db.exec("ALTER TABLE services ADD COLUMN groupName TEXT DEFAULT 'default';"); } catch (e) {}
  try { db.exec("ALTER TABLE services ADD COLUMN environment TEXT DEFAULT 'production';"); } catch (e) {}
  try { db.exec("ALTER TABLE services ADD COLUMN checkIntervalSeconds INTEGER DEFAULT 60;"); } catch (e) {}
  try { db.exec("ALTER TABLE services ADD COLUMN timeoutSeconds INTEGER DEFAULT 10;"); } catch (e) {}

  // Migration: rename sshKeyPath → sshPassword (SQLite doesn't support RENAME COLUMN on older versions)
  try {
    const cols = db.query("PRAGMA table_info(servers)").all() as { name: string }[];
    const hasOldCol = cols.some(c => c.name === 'sshKeyPath');
    const hasNewCol = cols.some(c => c.name === 'sshPassword');
    if (hasOldCol && !hasNewCol) {
      db.exec("ALTER TABLE servers RENAME COLUMN sshKeyPath TO sshPassword;");
    } else if (!hasOldCol && !hasNewCol) {
      db.exec("ALTER TABLE servers ADD COLUMN sshPassword TEXT DEFAULT '';");
    }
  } catch (e) {}

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
