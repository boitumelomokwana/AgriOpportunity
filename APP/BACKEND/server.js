'use strict';

require('dotenv').config();

const { createApp } = require('./src/app');
const { isConfigured } = require('./src/supabase');

const port = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;
const app = createApp();

const server = app.listen(port, () => {
  console.log(`AgriOpportunities API listening on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Readiness:    http://localhost:${port}/ready`);
});

// Optional in-process scheduler. Set DISCOVERY_SCHEDULER_ENABLED=true to let
// this service collect from enabled sources. The standalone worker
// (`npm run discovery:worker`) is the recommended deployment for production.
let scheduler = null;
if (String(process.env.DISCOVERY_SCHEDULER_ENABLED ?? '').toLowerCase() === 'true') {
  if (!isConfigured) {
    console.warn(
      'Discovery scheduler not started: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  } else {
    const { startDiscoveryScheduler } = require('./src/discovery/scheduler');
    scheduler = startDiscoveryScheduler();
  }
}

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`);
  scheduler?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
