import { app } from './app.js';
import { initDB } from './db/index.js';
import { startScheduler } from './modules/monitoring/scheduler.js';

const PORT = process.env.PORT || 3000;

// Initialize Database Schema
initDB();


// Start the scheduler engine
startScheduler();

app.listen(PORT, () => {
  console.log(`🦊 Nexus Backend is running at http://localhost:${PORT}`);
});
