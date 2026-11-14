'use strict';

const { getClient, asHttpError } = require('./supabase');
const { httpError } = require('./auth');

function extractAccessToken(req) {
  const header = req.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Authenticate an administrator with the existing Supabase Auth session.
 * The role is always read from admin_roles in the database; it is never taken
 * from the request body, headers, or any client-controlled state.
 */
async function requireAdmin(req, res, next) {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      throw httpError(
        'missing_access_token',
        'Sign in with an administrator account to use this endpoint.',
        401,
      );
    }

    const client = getClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      throw httpError(
        'invalid_access_token',
        'The administrator session is invalid or has expired. Sign in again.',
        401,
      );
    }

    const { data: role, error: roleError } = await client
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (roleError) throw asHttpError(roleError, 'Could not verify administrator access.');

    if (!role?.is_active) {
      throw httpError(
        'admin_required',
        'This account does not have an active administrator role.',
        403,
      );
    }

    req.admin = {
      id: data.user.id,
      email: data.user.email ?? null,
      role: role.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdminRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return next(httpError('admin_required', 'Administrator access required.', 403));
    }
    if (!roles.includes(req.admin.role)) {
      return next(
        httpError(
          'insufficient_admin_role',
          `This action requires one of: ${roles.join(', ')}.`,
          403,
        ),
      );
    }
    next();
  };
}

module.exports = { requireAdmin, requireAdminRole, extractAccessToken };
