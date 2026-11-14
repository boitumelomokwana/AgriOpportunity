'use strict';

const {
  absoluteUrl,
  asArray,
  cleanText,
  getPath,
  inferCategory,
  oneLine,
  parseDate,
} = require('../normalize');

/**
 * Normalised field names used by every adapter. Each entry lists the source
 * keys that are tried, in order, when a source configuration does not provide
 * an explicit path/selector.
 */
const ALIASES = {
  externalId: [
    'externalId', 'external_id', 'externalid', 'id', 'guid', 'uuid',
    'reference', 'ref', 'jobId', 'job_id', 'vacancyId', 'vacancy_id',
  ],
  name: [
    'name', 'companyName', 'company_name', 'company', 'organisation',
    'organization', 'employer', 'provider',
  ],
  title: ['title', 'jobTitle', 'job_title', 'position', 'role', 'name'],
  tradingName: ['tradingName', 'trading_name'],
  registrationNumber: [
    'registrationNumber', 'registration_number', 'companyRegistration',
    'registration', 'regNumber', 'reg_number',
  ],
  description: [
    'description', 'summary', 'details', 'content', 'body', 'about',
    'jobDescription', 'job_description',
  ],
  industry: ['industry', 'businessSector', 'business_sector'],
  sector: ['sector', 'industry'],
  website: ['website', 'companyUrl', 'company_url', 'homepage', 'url'],
  contactEmail: [
    'contactEmail', 'contact_email', 'email', 'careersEmail', 'careers_email',
  ],
  contactPhone: ['contactPhone', 'contact_phone', 'phone', 'telephone', 'tel'],
  province: ['province', 'state', 'region'],
  city: ['city', 'town', 'suburb'],
  careersUrl: [
    'careersUrl', 'careers_url', 'careersPage', 'careers_page', 'jobsUrl',
    'jobs_url',
  ],
  provider: [
    'provider', 'company', 'companyName', 'company_name', 'employer',
    'organisation', 'organization',
  ],
  category: [
    'category', 'opportunityType', 'opportunity_type', 'jobType', 'job_type',
    'type',
  ],
  opportunityType: [
    'opportunityType', 'opportunity_type', 'jobType', 'job_type', 'type',
  ],
  location: ['location', 'city', 'town', 'place'],
  qualification: [
    'qualification', 'qualifications', 'education', 'educationLevel',
    'education_level',
  ],
  eligibility: [
    'eligibility', 'eligibilityCriteria', 'eligibility_criteria',
    'requirements',
  ],
  applicationUrl: [
    'applicationUrl', 'application_url', 'applyUrl', 'apply_url', 'applyLink',
    'apply_link',
  ],
  sourceUrl: [
    'sourceUrl', 'source_url', 'url', 'link', 'href', 'permalink', 'webUrl',
    'web_url',
  ],
  openingDate: [
    'openingDate', 'opening_date', 'startDate', 'start_date', 'publishedAt',
    'published_at', 'pubDate', 'date',
  ],
  closingDate: [
    'closingDate', 'closing_date', 'closeDate', 'close_date', 'deadline',
    'expiryDate', 'expiry_date', 'endDate', 'end_date',
  ],
  isRemote: ['isRemote', 'is_remote', 'remote'],
  tags: ['tags', 'keywords'],
};

function getPathLoose(value, path) {
  const direct = getPath(value, path);
  if (direct !== undefined) return direct;
  if (!path || !value || typeof value !== 'object') return undefined;
  const keys = String(path).split('.');
  let current = value;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)];
      continue;
    }
    if (typeof current !== 'object') return undefined;
    const match = Object.keys(current).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    if (!match) return undefined;
    current = current[match];
  }
  return current;
}

function firstValue(record, key, configuredPath) {
  if (configuredPath !== undefined && configuredPath !== null) {
    return getPathLoose(record, configuredPath);
  }
  for (const alias of ALIASES[key] ?? [key]) {
    const value = getPathLoose(record, alias);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function pick(record, config, key) {
  return firstValue(record, key, (config.fields ?? {})[key]);
}

function text(value, maxLength = 300) {
  if (value === undefined || value === null) return null;
  const cleaned = oneLine(value, maxLength);
  return cleaned || null;
}

function longText(value) {
  if (value === undefined || value === null) return null;
  const cleaned = cleanText(value, 20000);
  return cleaned || null;
}

function boolValue(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  return /^(true|yes|y|1|remote)$/i.test(String(value).trim());
}

const COMPANY_FIELDS = [
  'name', 'tradingName', 'registrationNumber', 'description', 'industry',
  'sector', 'website', 'contactEmail', 'contactPhone', 'province', 'city',
  'careersUrl',
];

function buildItem({ record, config = {}, baseUrl, raw = record }) {
  const configuredKind = text(config.type, 40) ?? 'opportunity';
  let kind = configuredKind;

  if (configuredKind === 'mixed' || configuredKind === 'auto') {
    const rawKind = text(
      config.typeField ? getPathLoose(record, config.typeField) : null,
      40,
    );
    const mapped = rawKind
      ? config.typeMap?.[rawKind] ?? config.typeMap?.[rawKind.toLowerCase()]
      : null;
    if (mapped === 'company' || mapped === 'opportunity') {
      kind = mapped;
    } else if (text(firstValue(record, 'title'), 300)) {
      kind = 'opportunity';
    } else {
      kind = 'company';
    }
  }

  if (kind !== 'company' && kind !== 'opportunity') {
    throw new Error(`Unsupported discovery item type: ${configuredKind}`);
  }

  const sourceUrl =
    absoluteUrl(baseUrl, pick(record, config, 'sourceUrl')) ?? baseUrl;
  const externalId = text(pick(record, config, 'externalId'), 200);

  if (kind === 'company') {
    const name = text(pick(record, config, 'name'), 300);
    if (!name) return null;
    const fields = {};
    for (const key of COMPANY_FIELDS) {
      const value = pick(record, config, key);
      if (key === 'description') fields[key] = longText(value);
      else if (['website', 'careersUrl'].includes(key)) {
        fields[key] = absoluteUrl(baseUrl, value);
      } else fields[key] = text(value, key === 'industry' || key === 'sector' ? 120 : 300);
    }
    return {
      kind,
      externalId,
      sourceUrl,
      company: fields,
      raw,
    };
  }

  const title = text(pick(record, config, 'title'), 300);
  if (!title) return null;

  const provider = text(pick(record, config, 'provider'), 200);
  const description = longText(pick(record, config, 'description'));
  const location = text(pick(record, config, 'location'), 200);
  const remoteValue = pick(record, config, 'isRemote');
  const opportunityType = text(pick(record, config, 'opportunityType'), 80);

  return {
    kind,
    externalId,
    sourceUrl,
    opportunity: {
      title,
      provider,
      description,
      category:
        text(pick(record, config, 'category'), 80) ??
        inferCategory(title, description, opportunityType),
      opportunityType,
      location,
      province: text(pick(record, config, 'province'), 80),
      qualification: text(pick(record, config, 'qualification'), 500),
      eligibility: longText(pick(record, config, 'eligibility')),
      applicationUrl: absoluteUrl(baseUrl, pick(record, config, 'applicationUrl')),
      openingDate: parseDate(pick(record, config, 'openingDate')),
      closingDate: parseDate(pick(record, config, 'closingDate')),
      isRemote:
        boolValue(remoteValue) || /\bremote\b/i.test(location ?? ''),
      tags: asArray(pick(record, config, 'tags')),
    },
    raw,
  };
}

module.exports = {
  ALIASES,
  buildItem,
  firstValue,
  getPathLoose,
  longText,
  text,
};
