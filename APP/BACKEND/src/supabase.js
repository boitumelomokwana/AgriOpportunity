'use strict';

const { createClient } = require('@supabase/supabase-js');

const url = (process.env.SUPABASE_URL ?? '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

const isConfigured = Boolean(
  url.startsWith('http') && serviceRoleKey.length > 20,
);

const supabase = isConfigured
  ? createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { 'x-application-name': 'agriopportunities-api' },
      },
    })
  : null;

function getClient() {
  if (!supabase) {
    const error = new Error(
      'Supabase is not configured on the server. Set SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY in APP/BACKEND/.env.',
    );
    error.statusCode = 503;
    error.code = 'server_not_configured';
    throw error;
  }
  return supabase;
}

/** Normalises a Supabase/PostgREST failure into an HTTP-friendly error. */
function asHttpError(error, fallbackMessage = 'The database request failed.') {
  const wrapped = new Error(error?.message || fallbackMessage);
  wrapped.statusCode = 500;
  wrapped.code = error?.code || 'database_error';
  wrapped.details = error?.details;
  return wrapped;
}

module.exports = { supabase, getClient, isConfigured, asHttpError, supabaseUrl: url };
