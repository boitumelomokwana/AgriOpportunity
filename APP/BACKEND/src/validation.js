'use strict';

const { isUuid } = require('./auth');

const STRING_FIELDS = {
  title: 300,
  description: 20000,
  application_url: 2048,
  category: 100,
  opportunity_type: 100,
  location: 200,
  province: 100,
  qualification: 200,
  sector: 100,
  eligibility_criteria: 5000,
  external_reference: 200,
};

const PROJECTION_FIELDS = [
  'id',
  'title',
  'description',
  'application_url',
  'category',
  'opportunity_type',
  'province',
  'location',
  'qualification',
  'sector',
  'eligibility_criteria',
  'closing_date',
  'is_remote',
  'tags',
  'requirements',
  'status',
  'rejection_reason',
  'external_reference',
  'submission_source',
  'source_url',
  'created_at',
  'updated_at',
  'published_at',
  'withdrawn_at',
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Whitelist and validate the fields a company may submit. Unknown properties
 * are ignored so a provider can post its own internal metadata safely.
 */
function validateOpportunityPayload(body, { partial = false } = {}) {
  const errors = [];
  if (!isPlainObject(body)) {
    return { errors: ['The JSON body must be an object.'], payload: {} };
  }

  const payload = {};

  for (const [field, maxLength] of Object.entries(STRING_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (value === null) {
      if (field === 'title' || field === 'description') {
        payload[field] = null;
      }
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`${field} must be a string.`);
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      if (field === 'title' || field === 'description') payload[field] = null;
      continue;
    }
    if (trimmed.length > maxLength) {
      errors.push(`${field} must be ${maxLength} characters or fewer.`);
      continue;
    }
    if (field === 'application_url' && !/^https?:\/\/\S+$/i.test(trimmed)) {
      errors.push('application_url must be a valid http(s) URL.');
      continue;
    }
    payload[field] = trimmed;
  }

  if (!partial) {
    if (!payload.title) errors.push('title is required.');
    if (!payload.description) errors.push('description is required.');
  } else {
    if (Object.prototype.hasOwnProperty.call(body, 'title') && !payload.title) {
      errors.push('title cannot be blank.');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description') && !payload.description) {
      errors.push('description cannot be blank.');
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'closing_date')) {
    const value = body.closing_date;
    if (value === null) {
      payload.closing_date = null;
    } else if (typeof value !== 'string' || !validDate(value.trim())) {
      errors.push('closing_date must be a real date in YYYY-MM-DD format.');
    } else {
      payload.closing_date = value.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_remote')) {
    if (typeof body.is_remote !== 'boolean') {
      errors.push('is_remote must be true or false.');
    } else {
      payload.is_remote = body.is_remote;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
    if (!Array.isArray(body.tags)) {
      errors.push('tags must be an array of strings.');
    } else if (body.tags.length > 20) {
      errors.push('tags can contain at most 20 items.');
    } else {
      const tags = [];
      for (const tag of body.tags) {
        if (typeof tag !== 'string') {
          errors.push('Every tag must be a string.');
          break;
        }
        const trimmed = tag.trim();
        if (!trimmed) continue;
        if (trimmed.length > 50) {
          errors.push('Each tag must be 50 characters or fewer.');
          break;
        }
        tags.push(trimmed);
      }
      if (!errors.length) payload.tags = tags;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'requirements')) {
    if (!isPlainObject(body.requirements)) {
      errors.push('requirements must be an object.');
    } else {
      const requirements = {};
      for (const key of ['studyLevel', 'careerField', 'experience']) {
        if (Object.prototype.hasOwnProperty.call(body.requirements, key)) {
          if (typeof body.requirements[key] !== 'boolean') {
            errors.push(`requirements.${key} must be true or false.`);
          } else {
            requirements[key] = body.requirements[key];
          }
        }
      }
      if (!errors.length) payload.requirements = requirements;
    }
  }

  return { errors, payload };
}

function parsePagination(query) {
  const limitRaw = Number.parseInt(String(query.limit ?? '25'), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? '0'), 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 25;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

module.exports = {
  validateOpportunityPayload,
  parsePagination,
  isUuid,
  PROJECTION_FIELDS,
};
