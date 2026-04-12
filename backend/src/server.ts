import { app } from './app.ts';
import { initDB } from './db/index.ts';
import { startScheduler } from './modules/monitoring/scheduler.ts';
import { startServerScheduler } from './modules/monitoring/serverScheduler.ts';
import { startLogCheckerEngine } from './modules/logs/engine.ts';

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
