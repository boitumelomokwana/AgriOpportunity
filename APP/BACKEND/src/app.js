'use strict';

const { randomUUID } = require('node:crypto');
const cors = require('cors');
const express = require('express');

const { apiLogger } = require('./logger');
const { isConfigured, supabase } = require('./supabase');
const adminDiscoveryRoutes = require('./routes/adminDiscovery');
const companyRoutes = require('./routes/company');

function configuredOrigins() {
  const raw = (process.env.CORS_ORIGINS ?? '*').trim();
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.includes('*') ? true : origins;
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(
    cors({
      origin: configuredOrigins(),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-API-Key',
        'X-Request-Id',
      ],
      exposedHeaders: [
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'Retry-After',
        'X-Request-Id',
      ],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use((req, res, next) => {
    req.id = req.get('x-request-id')?.slice(0, 100) || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Liveness: the process is up. Does not touch the database.
  app.get(['/health', '/api/health'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'agriopportunities-api',
      supabase_configured: isConfigured,
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: the service can reach Supabase.
  app.get('/ready', async (req, res) => {
    if (!isConfigured) {
      res.status(503).json({
        status: 'not_ready',
        database: 'not_configured',
        message:
          'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in APP/BACKEND/.env.',
      });
      return;
    }
    const { error } = await supabase
      .from('system_settings')
      .select('key')
      .limit(1);
    if (error) {
      res.status(503).json({
        status: 'not_ready',
        database: 'unreachable',
        message: error.message,
      });
      return;
    }
    res.json({
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/company', apiLogger);
  app.use('/api/company/opportunities', companyRoutes);
  app.use('/api/admin/discovery', adminDiscoveryRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: `No route matches ${req.method} ${req.path}.`,
      },
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const isJsonParseError = error?.type === 'entity.parse.failed';
    const status = error?.statusCode || (isJsonParseError ? 400 : 500);
    const message = isJsonParseError
      ? 'The request body is not valid JSON.'
      : status >= 500 && !error?.statusCode
        ? 'Something went wrong on the server.'
        : error?.message || 'Request failed.';

    res.locals.errorMessage = message;
    if (status >= 500) {
      // Expected 5xx responses (database unreachable, not configured) should
      // not dump a stack trace on every request; keep a one-line warning.
      if (error?.statusCode) {
        console.error(`[${req.id}] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
      } else {
        console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, error);
      }
    }

    res.status(status).json({
      error: {
        code: error?.code || (isJsonParseError ? 'invalid_json' : 'internal_error'),
        message,
        ...(error?.details ? { details: error.details } : {}),
      },
    });
  });

  return app;
}

module.exports = { createApp };
