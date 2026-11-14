'use strict';

const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { getClient, isConfigured } = require('../supabase');
const { runDueSources } = require('./runner');
const { startDiscoveryScheduler } = require('./scheduler');

async function main() {
  if (!isConfigured) {
    console.error(
      'Discovery worker cannot start: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in APP/BACKEND/.env.',
    );
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes('--once')) {
    const results = await runDueSources(getClient());
    console.log(JSON.stringify({ processed: results.length, results }, null, 2));
    return;
  }

  const scheduler = startDiscoveryScheduler();
  console.log('Discovery worker running. Press Ctrl+C to stop.');
  await scheduler.runNow();

  const shutdown = (signal) => {
    console.log(`Received ${signal}; stopping discovery worker.`);
    scheduler.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Discovery worker failed:', error.message);
  process.exitCode = 1;
});
