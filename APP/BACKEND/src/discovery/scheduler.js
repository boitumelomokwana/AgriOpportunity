'use strict';

const { getClient, isConfigured } = require('./supabase');
const { runDueSources } = require('./runner');

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Runs due sources on a fixed interval inside the backend process. The
 * standalone `npm run discovery:worker` command uses the same function, so a
 * deployment can choose either model without changing configuration.
 */
function startDiscoveryScheduler({ intervalMs, logger = console } = {}) {
  if (!isConfigured) {
    logger.warn(
      '[discovery] Scheduler not started: Supabase is not configured on the server.',
    );
    return { stop() {}, runNow: async () => [] };
  }

  const parsed = Number(intervalMs ?? process.env.DISCOVERY_SCHEDULER_INTERVAL_SECONDS);
  const ms =
    Number.isFinite(parsed) && parsed > 0
      ? Math.max(60_000, parsed * 1000)
      : DEFAULT_INTERVAL_MS;

  let running = false;
  const tick = async () => {
    if (running) return [];
    running = true;
    try {
      const results = await runDueSources(getClient(), { logger });
      if (results.length > 0) {
        logger.log?.(`[discovery] Processed ${results.length} due source(s).`);
      }
      return results;
    } catch (error) {
      logger.error?.(`[discovery] Scheduled run failed: ${error.message}`);
      return [];
    } finally {
      running = false;
    }
  };

  const initial = setTimeout(tick, 5_000);
  initial.unref?.();
  const timer = setInterval(tick, ms);
  timer.unref?.();

  logger.log?.(`[discovery] Scheduler started (every ${Math.round(ms / 1000)}s).`);

  return {
    stop() {
      clearTimeout(initial);
      clearInterval(timer);
    },
    runNow: tick,
  };
}

module.exports = { startDiscoveryScheduler, DEFAULT_INTERVAL_MS };
