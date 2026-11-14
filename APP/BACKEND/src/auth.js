'use strict';

const { getClient, asHttpError } = require('./supabase');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function httpError(code, message, statusCode = 400, details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  return error;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function extractApiKey(req) {
  const header = req.get('authorization');
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1].trim() : null;
  }
  const direct = req.get('x-api-key');
  return direct ? direct.trim() : null;
}

/**
 * Validate a company API key against public.verify_company_api_key and apply
 * the database-backed fixed-window rate limiter.
 */
async function requireCompanyKey(req, res, next) {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      throw httpError(
        'missing_api_key',
        'Provide a company API key in the Authorization: Bearer <key> header.',
        401,
      );
    }
    if (apiKey.length < 20 || apiKey.length > 200) {
      throw httpError('invalid_api_key', 'That company API key is not valid.', 401);
    }

    const client = getClient();

    const { data: verified, error: verifyError } = await client.rpc(
      'verify_company_api_key',
      { p_key: apiKey },
    );
    if (verifyError) throw asHttpError(verifyError, 'Could not verify the API key.');
    if (!verified) {
      throw httpError(
        'invalid_api_key',
        'That company API key is invalid, revoked, expired, or its organisation is not approved.',
        401,
      );
    }

    const { data: rate, error: rateError } = await client.rpc(
      'check_api_rate_limit',
      { p_key_id: verified.key_id },
    );
    if (rateError) throw asHttpError(rateError, 'Could not check the rate limit.');

    const limit = Number(rate?.limit ?? 60);
    const remaining = Number(rate?.remaining ?? 0);
    const resetAt = rate?.reset_at ? new Date(rate.reset_at) : null;
    const retryAfter = resetAt
      ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
      : 60;

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(retryAfter));
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (!rate?.allowed) {
      res.setHeader('Retry-After', String(retryAfter));
      throw httpError(
        'rate_limit_exceeded',
        `Too many requests. Try again in ${retryAfter} second(s).`,
        429,
      );
    }

    req.company = {
      keyId: verified.key_id,
      organizationId: verified.organization_id,
      scopes: Array.isArray(verified.scopes) ? verified.scopes : [],
    };
    next();
  } catch (error) {
    next(error);
  }
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.company) {
      return next(httpError('unauthorized', 'Company API key required.', 401));
    }
    if (!req.company.scopes.includes(scope)) {
      return next(
        httpError(
          'insufficient_scope',
          `This API key does not include the required ${scope} scope.`,
          403,
        ),
      );
    }
    next();
  };
}

module.exports = { requireCompanyKey, requireScope, isUuid, httpError, extractApiKey };
