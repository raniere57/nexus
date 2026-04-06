import { db } from '../../db/index.js';
import type { Service, ServiceSnapshot } from '../../shared/types.js';

export function getAllServices(): Service[] {
  return db.query(`SELECT * FROM services`).all() as Service[];
}

export function getServiceById(id: string): Service | null {
  const s = db.query(`SELECT * FROM services WHERE id = ?`).get(id) as Service;
  return s || null;
}

export function createService(service: Omit<Service, 'createdAt' | 'updatedAt'>): Service {
  db.query(`
    INSERT INTO services (id, name, description, groupName, host, baseUrl, environment, checkIntervalSeconds, timeoutSeconds, isActive)
    VALUES ($id, $name, $description, $groupName, $host, $baseUrl, $environment, $checkIntervalSeconds, $timeoutSeconds, $isActive)
  `).run({
    $id: service.id,
    $name: service.name,
    $description: service.description,
    $groupName: service.groupName,
    $host: service.host || null,
    $baseUrl: service.baseUrl || null,
    $environment: service.environment,
    $checkIntervalSeconds: service.checkIntervalSeconds,
    $timeoutSeconds: service.timeoutSeconds,
    $isActive: service.isActive ? 1 : 0
  });
  
  createOrUpdateSnapshot(service.id, {
      serviceId: service.id,
      overallStatus: 'unknown',
      lastCheckedAt: null,
      lastOkAt: null,
      lastFailureAt: null,
      checkerSummaryJson: '{}'
  });

  return getServiceById(service.id)!;
}

export function updateService(id: string, updates: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>): Service | null {
  const existing = getServiceById(id);
  if (!existing) return null;

  const toUpdate = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  
  db.query(`
    UPDATE services SET
      name = $name,
      description = $description,
      groupName = $groupName,
      host = $host,
      baseUrl = $baseUrl,
      environment = $environment,
      checkIntervalSeconds = $checkIntervalSeconds,
      timeoutSeconds = $timeoutSeconds,
      isActive = $isActive,
      updatedAt = $updatedAt
    WHERE id = $id
  `).run({
    $id: id,
    $name: toUpdate.name,
    $description: toUpdate.description,
    $groupName: toUpdate.groupName,
    $host: toUpdate.host || null,
    $baseUrl: toUpdate.baseUrl || null,
    $environment: toUpdate.environment,
    $checkIntervalSeconds: toUpdate.checkIntervalSeconds,
    $timeoutSeconds: toUpdate.timeoutSeconds,
    $isActive: toUpdate.isActive ? 1 : 0,
    $updatedAt: toUpdate.updatedAt
  });

  return getServiceById(id);
}

export function deleteService(id: string): boolean {
  const info = db.query(`DELETE FROM services WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function getServiceSnapshots(): ServiceSnapshot[] {
  return db.query(`SELECT * FROM service_snapshots`).all() as ServiceSnapshot[];
}

export function getServiceSnapshotById(serviceId: string): ServiceSnapshot | null {
  const r = db.query(`SELECT * FROM service_snapshots WHERE serviceId = ?`).get(serviceId) as ServiceSnapshot;
  return r || null;
}

export function createOrUpdateSnapshot(serviceId: string, snapshot: ServiceSnapshot) {
  db.query(`
    INSERT INTO service_snapshots 
      (serviceId, overallStatus, lastCheckedAt, lastOkAt, lastFailureAt, checkerSummaryJson)
    VALUES ($serviceId, $overallStatus, $lastCheckedAt, $lastOkAt, $lastFailureAt, $checkerSummaryJson)
    ON CONFLICT(serviceId) DO UPDATE SET
      overallStatus = excluded.overallStatus,
      lastCheckedAt = excluded.lastCheckedAt,
      lastOkAt = excluded.lastOkAt,
      lastFailureAt = excluded.lastFailureAt,
      checkerSummaryJson = excluded.checkerSummaryJson
  `).run({
    $serviceId: snapshot.serviceId,
    $overallStatus: snapshot.overallStatus,
    $lastCheckedAt: snapshot.lastCheckedAt,
    $lastOkAt: snapshot.lastOkAt,
    $lastFailureAt: snapshot.lastFailureAt,
    $checkerSummaryJson: snapshot.checkerSummaryJson
  });
}
