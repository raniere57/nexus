# Nexus Backend

This is the backend for the Nexus TV Monitoring dashboard.

## Tech Stack
- **Runtime**: Bun 1.x
- **Framework**: ElysiaJS
- **Database**: SQLite (built-in bun:sqlite) with WAL mode
- **WebSocket**: Native Bun WebSocket via Elysia
- **Checkers**: `ping` (ICMP/System) and `fetch` (HTTP)

## How to Run Locally

### Requirements
- Node.js environment is optional, **Bun is required!**
- Ensure that ping is accessible in the environment.

1. Install dependencies:
   ```bash
   bun install
   ```
2. (Optional) Seed the database with initial examples:
   ```bash
   bun run seed
   ```
3. Run the development server (with watch mode):
   ```bash
   bun run dev
   ```

## How to Run in Docker

To boot the complete application with the frontend:
```bash
docker-compose up -d --build
```
> **Note about Ping**: The backend Docker container (`oven/bun:1`) installs `iputils-ping` automatically at build time, assuring ICMP checks will run successfully in Alpine/Debian base images.

## Features & Endpoints

The API is fully standardized (`{ success: true, data: [...] }`).
A Swagger interface is available at `/docs`.

### REST Endpoints
- `GET /api/status`: Raw merged list of snapshots for all services.
- `GET /api/status/tv`: Enriched, lightweight dashboard payload combining status, ok/problem counts, and lists of problematic checkers.
- `GET /api/results`: Provides filterable history of executions: `?serviceId=X&limit=50`.

### Realtime WebSocket
- `ws://localhost:3000/ws/status`: Connects the dashboard for realtime UI. 
  - **Event `initial_state`**: Broadcasted immediately upon connection. Contains a snapshot of everything.
  - **Event `status_update`**: Emitted seamlessly whenever services toggle status dynamically.

## Environment Variables
- `PORT` (Default: 3000): Listen port.
- `DB_PATH` (Default: `nexus.db`): Path to SQLite.

## Tests
To run the minimal integrity tests (engine aggregation, logic validation):
```bash
bun test
```

## Scheduling & Retention
- **Scheduler**: A native background engine checks active services automatically based on their individual `checkIntervalSeconds`.
- **Data Retention**: The scheduler also runs a garbage collection periodic job every hour, deleting all `checker_results` older than **7 days** to prevent SQLite bloat.
