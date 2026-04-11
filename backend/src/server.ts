import { app } from './app.js';
import { initDB } from './db/index.js';
import { startScheduler } from './modules/monitoring/scheduler.js';
import { startServerScheduler } from './modules/monitoring/serverScheduler.js';
import { startLogCheckerEngine } from './modules/logs/engine.js';

const PORT = process.env.PORT || 3000;

// Initialize Database Schema
initDB();


// Start the scheduler engine
startScheduler();
startServerScheduler();
startLogCheckerEngine();

app.listen({ port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`🦊 Nexus Backend is running at http://0.0.0.0:${PORT}`);
});
