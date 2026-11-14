'use strict';

const express = require('express');

const { requireAdmin } = require('../adminAuth');
const { isUuid, httpError } = require('../auth');
const { asHttpError, getClient } = require('../supabase');
const { runDueSources, runSource } = require('../discovery/runner');

const router = express.Router();

router.use(requireAdmin);

const SOURCE_TYPES = ['json', 'rss', 'html'];

function slugifyName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function validateSourcePayload(body, { partial = false } = {}) {
  const errors = [];
  const payload = {};

  const required = ['name', 'source_type', 'base_url'];
  for (const key of required) {
    if (!partial && !body?.[key]) errors.push(`${key} is required.`);
  }

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 160) {
      errors.push('name must be between 2 and 160 characters.');
    } else payload.name = name;
    payload.slug = slugifyName(name);
    if (payload.slug.length < 2) errors.push('name must contain letters or numbers.');
  }

  if (body?.source_type !== undefined) {
    if (!SOURCE_TYPES.includes(body.source_type)) {
      errors.push(`source_type must be one of: ${SOURCE_TYPES.join(', ')}.`);
    } else payload.source_type = body.source_type;
  }

  if (body?.base_url !== undefined) {
    try {
      const url = new URL(String(body.base_url).trim());
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('base_url must use http or https.');
      } else if (url.username || url.password) {
        errors.push('base_url must not contain embedded credentials.');
      } else {
        payload.base_url = url.toString();
      }
    } catch {
      errors.push('base_url must be a valid absolute URL.');
    }
  }

  if (body?.terms_url !== undefined) {
    payload.terms_url = body.terms_url ? String(body.terms_url).trim().slice(0, 2000) : null;
  }
  if (body?.license_note !== undefined) {
    payload.license_note = body.license_note
      ? String(body.license_note).trim().slice(0, 2000)
      : null;
  }
  if (body?.is_enabled !== undefined) payload.is_enabled = Boolean(body.is_enabled);
  if (body?.requires_credentials !== undefined) {
    payload.requires_credentials = Boolean(body.requires_credentials);
  }
  if (body?.rate_limit_seconds !== undefined) {
    const seconds = Number(body.rate_limit_seconds);
    if (!Number.isInteger(seconds) || seconds < 60 || seconds > 604800) {
      errors.push('rate_limit_seconds must be an integer between 60 and 604800.');
    } else payload.rate_limit_seconds = seconds;
  }
  if (body?.config !== undefined) {
    if (typeof body.config !== 'object' || body.config === null || Array.isArray(body.config)) {
      errors.push('config must be a JSON object.');
    } else {
      payload.config = body.config;
    }
  }

  return { errors, payload };
}

async function writeAudit(req, client, action, entityType, entityId, details) {
  const { error } = await client.from('admin_logs').insert({
    admin_id: req.admin.id,
    actor_type: 'admin',
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    details: details ?? {},
    ip_address: req.ip ? String(req.ip).slice(0, 100) : null,
  });
  if (error) console.warn(`[admin] Could not write audit log: ${error.message}`);
}

/* -------------------------------------------------------------------------- */
/* Sources                                                                    */
/* -------------------------------------------------------------------------- */

router.get('/sources', async (req, res, next) => {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('discovery_sources')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw asHttpError(error, 'Could not load discovery sources.');
    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

router.post('/sources', async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      throw httpError('insufficient_admin_role', 'Only a Super Admin can manage sources.', 403);
    }
    const { errors, payload } = validateSourcePayload(req.body);
    if (errors.length > 0) throw httpError('validation_failed', errors[0], 422, errors);

    const client = getClient();
    const { data, error } = await client
      .from('discovery_sources')
      .insert({
        ...payload,
        is_enabled: payload.is_enabled === true,
        rate_limit_seconds: payload.rate_limit_seconds ?? 3600,
        config: payload.config ?? {},
        created_by: req.admin.id,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw httpError(
          'source_exists',
          'A discovery source with that name or slug already exists.',
          409,
        );
      }
      throw asHttpError(error, 'Could not create the discovery source.');
    }

    await writeAudit(req, client, 'discovery.source_created', 'discovery_source', data.id, {
      name: data.name,
      source_type: data.source_type,
      is_enabled: data.is_enabled,
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.patch('/sources/:id', async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      throw httpError('insufficient_admin_role', 'Only a Super Admin can manage sources.', 403);
    }
    if (!isUuid(req.params.id)) {
      throw httpError('invalid_id', 'The source id must be a UUID.', 400);
    }
    const { errors, payload } = validateSourcePayload(req.body, { partial: true });
    if (errors.length > 0) throw httpError('validation_failed', errors[0], 422, errors);
    if (Object.keys(payload).length === 0) {
      throw httpError('empty_payload', 'Provide at least one field to update.', 400);
    }

    const client = getClient();
    const { data, error } = await client
      .from('discovery_sources')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw asHttpError(error, 'Could not update the discovery source.');

    await writeAudit(req, client, 'discovery.source_updated', 'discovery_source', data.id, {
      fields: Object.keys(payload),
      is_enabled: data.is_enabled,
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* Runs                                                                       */
/* -------------------------------------------------------------------------- */

router.post('/sources/:id/run', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      throw httpError('invalid_id', 'The source id must be a UUID.', 400);
    }
    const client = getClient();
    const { data: source, error } = await client
      .from('discovery_sources')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw asHttpError(error, 'Could not load the discovery source.');
    if (!source) throw httpError('source_not_found', 'Discovery source not found.', 404);

    const result = await runSource(client, source, {
      triggerType: 'manual',
      requestedBy: req.admin.id,
    });

    await writeAudit(req, client, 'discovery.run_started', 'discovery_run', result.run?.id, {
      source_id: source.id,
      source_name: source.name,
      status: result.run?.status,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/run-due', async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      throw httpError('insufficient_admin_role', 'Only a Super Admin can start scheduled runs.', 403);
    }
    const client = getClient();
    const results = await runDueSources(client);
    await writeAudit(req, client, 'discovery.run_due', 'discovery_scheduler', null, {
      results,
    });
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

router.get('/runs', async (req, res, next) => {
  try {
    const client = getClient();
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1),
      200,
    );
    let query = client
      .from('discovery_runs')
      .select('*, discovery_sources(name, source_type, slug)')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (req.query.source_id) {
      if (!isUuid(String(req.query.source_id))) {
        throw httpError('invalid_source_id', 'source_id must be a UUID.', 400);
      }
      query = query.eq('source_id', req.query.source_id);
    }
    if (req.query.status) query = query.eq('status', String(req.query.status));

    const { data, error } = await query;
    if (error) throw asHttpError(error, 'Could not load discovery runs.');
    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
