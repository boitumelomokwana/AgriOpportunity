'use strict';

const { supabase } = require('./supabase');

/**
 * Records one row in public.api_logs for every company API request. Logging is
 * best-effort: a logging failure must never break or delay the API response.
 */
function apiLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (!supabase) return;

    const endpoint = String(req.originalUrl || req.url || '').split('?')[0];
    const row = {
      organization_id: req.company?.organizationId ?? null,
      api_key_id: req.company?.keyId ?? null,
      request_id: req.id ?? null,
      method: req.method,
      endpoint: endpoint.slice(0, 500),
      status_code: res.statusCode,
      duration_ms: Date.now() - startedAt,
      ip_address: req.ip ? String(req.ip).slice(0, 100) : null,
      user_agent: req.get('user-agent')
        ? String(req.get('user-agent')).slice(0, 500)
        : null,
      error_message: res.locals?.errorMessage
        ? String(res.locals.errorMessage).slice(0, 1000)
        : null,
    };

    void supabase
      .from('api_logs')
      .insert(row)
      .then(({ error }) => {
        if (error) console.warn('[api-log] Could not store request log:', error.message);
      });
  });

  next();
}

module.exports = { apiLogger };
