'use strict';

const express = require('express');

const { asHttpError, getClient } = require('../supabase');
const { requireCompanyKey, requireScope, isUuid, httpError } = require('../auth');
const {
  PROJECTION_FIELDS,
  parsePagination,
  validateOpportunityPayload,
} = require('../validation');

const router = express.Router();

router.use(requireCompanyKey);

const ALLOWED_STATUSES = ['pending', 'approved', 'published', 'rejected'];

const SUBMIT_ERROR_STATUS = {
  invalid_event: 400,
  invalid_source: 400,
  validation_failed: 422,
  organization_not_approved: 403,
  not_found: 404,
};

const SUBMIT_ERROR_MESSAGE = {
  invalid_event: 'The requested event type is not supported.',
  invalid_source: 'The submission source is not supported.',
  validation_failed: 'The opportunity payload did not pass validation.',
  organization_not_approved:
    'This organisation is not approved for the company API.',
  not_found:
    'That opportunity does not exist for this organisation. Check the id or external reference.',
};

function sendSubmissionResult(res, result, successStatus) {
  if (!result || typeof result !== 'object') {
    throw httpError(
      'invalid_database_response',
      'The database returned an unexpected response.',
      502,
    );
  }

  if (result.ok !== true) {
    const status = SUBMIT_ERROR_STATUS[result.error] || 400;
    res.status(status).json({
      error: {
        code: result.error || 'submission_failed',
        message:
          result.detail ||
          SUBMIT_ERROR_MESSAGE[result.error] ||
          'The opportunity could not be saved.',
      },
    });
    return;
  }

  res.status(successStatus).json({ data: result });
}

async function submit(req, event, opportunityId = null, payload = req.body) {
  const client = getClient();
  const { data, error } = await client.rpc('submit_company_opportunity', {
    p_org_id: req.company.organizationId,
    p_key_id: req.company.keyId,
    p_event: event,
    p_payload: payload ?? {},
    p_source: 'company_api',
    p_opportunity_id: opportunityId,
  });
  if (error) throw asHttpError(error, 'The opportunity could not be saved.');
  return data;
}

/* -------------------------------------------------------------------------- */
/* GET /api/company/opportunities                                             */
/* -------------------------------------------------------------------------- */

router.get('/', requireScope('opportunities:read'), async (req, res, next) => {
  try {
    const client = getClient();
    const { limit, offset } = parsePagination(req.query);
    const status =
      typeof req.query.status === 'string' ? req.query.status.trim() : '';

    if (status && !ALLOWED_STATUSES.includes(status)) {
      throw httpError(
        'invalid_status',
        `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
        400,
      );
    }

    let query = client
      .from('opportunities')
      .select(PROJECTION_FIELDS.join(','), { count: 'exact' })
      .eq('organization_id', req.company.organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw asHttpError(error, 'Could not load opportunities.');

    const rows = data ?? [];
    res.json({
      data: rows,
      meta: {
        limit,
        offset,
        total: count ?? null,
        has_more: count !== null ? offset + rows.length < count : rows.length === limit,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/company/opportunities/:id                                         */
/* -------------------------------------------------------------------------- */

router.get('/:id', requireScope('opportunities:read'), async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      throw httpError('invalid_id', 'The opportunity id must be a UUID.', 400);
    }
    const client = getClient();
    const { data, error } = await client
      .from('opportunities')
      .select(PROJECTION_FIELDS.join(','))
      .eq('id', req.params.id)
      .eq('organization_id', req.company.organizationId)
      .maybeSingle();

    if (error) throw asHttpError(error, 'Could not load the opportunity.');
    if (!data) {
      throw httpError(
        'not_found',
        'That opportunity does not exist for this organisation.',
        404,
      );
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* POST /api/company/opportunities                                            */
/* -------------------------------------------------------------------------- */

router.post('/', requireScope('opportunities:write'), async (req, res, next) => {
  try {
    const { errors, payload } = validateOpportunityPayload(req.body, {
      partial: false,
    });
    if (errors.length > 0) {
      throw httpError('validation_failed', errors[0], 422, errors);
    }

    const result = await submit(req, 'created', null, payload);
    sendSubmissionResult(res, result, result?.action === 'created' ? 201 : 200);
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* PUT /api/company/opportunities/:id                                         */
/* -------------------------------------------------------------------------- */

router.put('/:id', requireScope('opportunities:write'), async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      throw httpError('invalid_id', 'The opportunity id must be a UUID.', 400);
    }
    const { errors, payload } = validateOpportunityPayload(req.body, {
      partial: true,
    });
    if (errors.length > 0) {
      throw httpError('validation_failed', errors[0], 422, errors);
    }
    if (Object.keys(payload).length === 0) {
      throw httpError(
        'empty_payload',
        'Provide at least one field to update.',
        400,
      );
    }

    const result = await submit(req, 'updated', req.params.id, payload);
    sendSubmissionResult(res, result, 200);
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* DELETE /api/company/opportunities/:id                                      */
/* Withdraws the listing; it is not hard-deleted and audit history is kept.  */
/* -------------------------------------------------------------------------- */

router.delete(
  '/:id',
  requireScope('opportunities:write'),
  async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) {
        throw httpError('invalid_id', 'The opportunity id must be a UUID.', 400);
      }

      const externalReference =
        typeof req.body?.external_reference === 'string'
          ? { external_reference: req.body.external_reference.trim().slice(0, 200) }
          : {};

      const result = await submit(req, 'withdrawn', req.params.id, externalReference);
      sendSubmissionResult(res, result, 200);
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
