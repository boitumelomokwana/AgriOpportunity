'use strict';

const crypto = require('node:crypto');

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

const PROVINCE_ALIASES = new Map([
  ['eastern cape', 'Eastern Cape'],
  ['free state', 'Free State'],
  ['gauteng', 'Gauteng'],
  ['kwazulu natal', 'KwaZulu-Natal'],
  ['kwazulu-natal', 'KwaZulu-Natal'],
  ['kzn', 'KwaZulu-Natal'],
  ['limpopo', 'Limpopo'],
  ['mpumalanga', 'Mpumalanga'],
  ['northern cape', 'Northern Cape'],
  ['north west', 'North West'],
  ['northwest', 'North West'],
  ['western cape', 'Western Cape'],
]);

const CATEGORY_RULES = [
  ['Bursary', /\bbursar(y|ies)\b/i],
  ['Scholarship', /\bscholarship\b/i],
  ['Learnership', /\blearnership\b/i],
  ['Internship', /\bintern(ship|ships)?\b/i],
  ['Graduate Programme', /\b(graduate|graduates|graduation)\s+(programme|program|scheme|development)\b/i],
  ['Apprenticeship', /\bapprenticeship\b/i],
  ['WIL', /\b(work[\s-]?integrated learning|wil)\b/i],
  ['In-service Training', /\bin[\s-]?service training\b/i],
  ['Grant', /\bgrant\b/i],
  ['Farm Job', /\bfarm (job|worker|assistant)\b/i],
  ['Scholarship', /\bscholarship\b/i],
  ['Training', /\btraining\b/i],
  ['Job', /\b(job|vacancy|vacancies|position|post)\b/i],
];

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
};

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, digits) => {
      const code = Number.parseInt(digits, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function stripHtml(value) {
  return decodeEntities(
    String(value ?? '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function cleanText(value, maxLength = 20000) {
  const text = stripHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function oneLine(value, maxLength = 300) {
  return cleanText(value, maxLength).replace(/\s+/g, ' ').trim();
}

function getPath(value, path) {
  if (!path) return value;
  return String(path)
    .split('.')
    .reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, value);
}

function asArray(value) {
  if (value === null || value === undefined || value === '') return [];
  const items = Array.isArray(value) ? value : String(value).split(/[,;|]/);
  return [...new Set(items.map((item) => oneLine(item, 80)).filter(Boolean))].slice(0, 20);
}

function absoluteUrl(base, value) {
  const raw = oneLine(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function makeDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const test = new Date(Date.UTC(year, month - 1, day));
  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() !== month - 1 ||
    test.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse only unambiguous dates. Anything unclear is returned as null instead
 * of inventing a deadline.
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return makeDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  const text = oneLine(value, 120);
  if (!text) return null;

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (match) return makeDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    // South African convention is day/month/year. Reject impossible values
    // instead of silently swapping them.
    return makeDate(Number(match[3]), second, first);
  }

  match = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i.exec(text);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    return month ? makeDate(Number(match[3]), month, Number(match[1])) : null;
  }

  match = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    return month ? makeDate(Number(match[3]), month, Number(match[2])) : null;
  }

  return null;
}

function inferCategory(...values) {
  const text = values.filter(Boolean).join(' ');
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return 'Other';
}

function matchProvince(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  for (const [alias, province] of PROVINCE_ALIASES) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      return province;
    }
  }
  if (/\b(national|nationwide|remote|anywhere)\b/i.test(text)) return 'National';
  return null;
}

function normalizeProvince(...values) {
  return matchProvince(...values) ?? 'National';
}

function slugify(value) {
  return oneLine(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isExpired(closingDate) {
  if (!closingDate) return false;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return closingDate < localToday;
}

module.exports = {
  PROVINCES,
  absoluteUrl,
  asArray,
  cleanText,
  decodeEntities,
  getPath,
  hashObject,
  inferCategory,
  isExpired,
  matchProvince,
  normalizeProvince,
  oneLine,
  parseDate,
  slugify,
  stripHtml,
};
