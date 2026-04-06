import { initDB, db } from './db/index.js';
import * as repo from './modules/services/repository.js';
import * as checkerRepo from './modules/checkers/repository.js';

console.log('[Seed] Initializing database schema...');
initDB();

try {
  console.log('[Seed] Seeding example data...');
  
  const s = repo.createService({
    id: 'sv-123',
    name: 'Example Web App',
    description: 'Main landing page',
    groupName: 'Frontend',
    host: 'google.com',
    baseUrl: 'https://google.com',
    environment: 'production',
    checkIntervalSeconds: 30,
    timeoutSeconds: 10,
    isActive: true
  });
  
  checkerRepo.createChecker({
    id: 'chk-1',
    serviceId: s.id,
    type: 'http',
    name: 'Google HTTP Check',
    configJson: JSON.stringify({ expectedStatus: 200 }),
    isActive: true
  });
  
  checkerRepo.createChecker({
    id: 'chk-2',
    serviceId: s.id,
    type: 'ping',
    name: 'Google Ping Check',
    configJson: JSON.stringify({ host: 'google.com' }),
    isActive: true
  });
  
  console.log('[Seed] Seeding complete.');
} catch (error) {
  console.error('[Seed] Failed to seed', error);
}

// Exit for seed script
process.exit(0);
