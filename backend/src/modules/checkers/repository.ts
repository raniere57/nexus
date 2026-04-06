import { db } from '../../db/index.js';
import type { Checker, CheckerResult } from '../../shared/types.js';

export function getCheckersByServiceId(serviceId: string): Checker[] {
  return db.query(`SELECT * FROM checkers WHERE serviceId = ?`).all(serviceId) as Checker[];
}

export function getAllActiveCheckers(): Checker[] {
  return db.query(`SELECT * FROM checkers WHERE isActive = 1`).all() as Checker[];
}

export function getCheckerById(id: string): Checker | null {
  const c = db.query(`SELECT * FROM checkers WHERE id = ?`).get(id) as Checker;
  return c || null;
}

export function createChecker(checker: Omit<Checker, 'createdAt' | 'updatedAt'>): Checker {
  db.query(`
    INSERT INTO checkers (id, serviceId, type, name, configJson, isActive)
    VALUES ($id, $serviceId, $type, $name, $configJson, $isActive)
  `).run({
    $id: checker.id,
    $serviceId: checker.serviceId,
    $type: checker.type,
    $name: checker.name,
    $configJson: checker.configJson,
    $isActive: checker.isActive ? 1 : 0
  });

  return getCheckerById(checker.id)!;
}

export function updateChecker(id: string, updates: Partial<Omit<Checker, 'id' | 'createdAt' | 'updatedAt' | 'serviceId' | 'type'>>): Checker | null {
  const existing = getCheckerById(id);
  if (!existing) return null;

  const toUpdate = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  
  db.query(`
    UPDATE checkers SET
      name = $name,
      configJson = $configJson,
      isActive = $isActive,
      updatedAt = $updatedAt
    WHERE id = $id
  `).run({
    $id: id,
    $name: toUpdate.name,
    $configJson: toUpdate.configJson,
    $isActive: toUpdate.isActive ? 1 : 0,
    $updatedAt: toUpdate.updatedAt
  });

  return getCheckerById(id);
}

export function deleteChecker(id: string): boolean {
  const info = db.query(`DELETE FROM checkers WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function createCheckerResult(result: Omit<CheckerResult, 'checkedAt'>): CheckerResult {
  const checkedAt = new Date().toISOString();
  db.query(`
    INSERT INTO checker_results (id, serviceId, checkerId, status, responseTimeMs, statusCode, errorMessage, checkedAt)
    VALUES ($id, $serviceId, $checkerId, $status, $responseTimeMs, $statusCode, $errorMessage, $checkedAt)
  `).run({
    $id: result.id,
    $serviceId: result.serviceId,
    $checkerId: result.checkerId,
    $status: result.status,
    $responseTimeMs: result.responseTimeMs,
    $statusCode: result.statusCode || null,
    $errorMessage: result.errorMessage || null,
    $checkedAt: checkedAt
  });

  return { ...result, checkedAt };
}

export function getRecentResultsByService(serviceId: string, limit = 50): CheckerResult[] {
  return db.query(`
    SELECT * FROM checker_results 
    WHERE serviceId = ? 
    ORDER BY checkedAt DESC 
    LIMIT ?
  `).all(serviceId, limit) as CheckerResult[];
}

export function getResults(options: { serviceId?: string; checkerId?: string; limit?: number }): CheckerResult[] {
  let query = 'SELECT * FROM checker_results WHERE 1=1';
  const params: Record<string, string | number> = {};

  if (options.serviceId) {
    query += ' AND serviceId = $serviceId';
    params['$serviceId'] = options.serviceId;
  }
  if (options.checkerId) {
    query += ' AND checkerId = $checkerId';
    params['$checkerId'] = options.checkerId;
  }

  query += ' ORDER BY checkedAt DESC LIMIT $limit';
  params['$limit'] = options.limit || 50;

  return db.query(query).all(params) as CheckerResult[];
}
