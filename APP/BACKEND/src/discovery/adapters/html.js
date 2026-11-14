'use strict';

const cheerio = require('cheerio');

const { oneLine } = require('../normalize');
const { buildItem } = require('./shared');

function adapterError(message) {
  const error = new Error(message);
  error.code = 'invalid_source_payload';
  error.statusCode = 502;
  return error;
}

/** Sensible fallbacks inside a configured item container. */
const DEFAULT_SELECTORS = {
  title: 'h1, h2, h3, h4, [class*="title"], [class*="heading"]',
  sourceUrl: 'a[href]',
  description: '[class*="summary"], [class*="description"], [class*="excerpt"], p',
  provider: '[class*="company"], [class*="employer"], [class*="organisation"]',
  location: '[class*="location"], [class*="province"], [class*="city"]',
  closingDate: '[class*="closing"], [class*="deadline"], time',
  category: '[class*="category"], [class*="type"]',
  applicationUrl: 'a[href*="apply"], a[class*="apply"]',
};

function parseSelector(spec) {
  if (spec && typeof spec === 'object') {
    return {
      selector: typeof spec.selector === 'string' ? spec.selector : null,
      attribute:
        typeof spec.attribute === 'string' ? spec.attribute.toLowerCase() : null,
    };
  }
  if (typeof spec !== 'string' || !spec.trim()) return null;
  const trimmed = spec.trim();
  const index = trimmed.lastIndexOf('@');
  if (index > 0) {
    return {
      selector: trimmed.slice(0, index).trim(),
      attribute: trimmed.slice(index + 1).trim().toLowerCase(),
    };
  }
  return { selector: trimmed, attribute: null };
}

function readValue($, element, spec) {
  const parsed = parseSelector(spec);
  if (!parsed) return undefined;

  const target =
    !parsed.selector || parsed.selector === 'self' || parsed.selector === ':scope'
      ? $(element)
      : $(element).find(parsed.selector).first();
  if (!target.length) return undefined;

  if (parsed.attribute === 'html') return target.html() ?? undefined;
  if (parsed.attribute === 'text') return target.text() ?? undefined;
  if (parsed.attribute) return target.attr(parsed.attribute) ?? undefined;
  return target.text() ?? undefined;
}

/**
 * HTML adapter. Extraction is fully selector driven so a source can be enabled
 * only after an administrator has reviewed its structure and terms.
 *
 * config example:
 *   {
 *     "type": "opportunity",
 *     "itemSelector": "article.job",
 *     "fields": {
 *       "title": "h2 a",
 *       "sourceUrl": "h2 a@href",
 *       "description": ".summary",
 *       "closingDate": ".closing"
 *     }
 *   }
 */
function parse(response, source) {
  const config = source.config ?? {};
  const itemSelector =
    typeof config.itemSelector === 'string' ? config.itemSelector.trim() : '';
  if (!itemSelector) {
    throw adapterError(
      'HTML sources must set config.itemSelector to the repeating record element.',
    );
  }

  const $ = cheerio.load(response.text ?? '');
  const elements = $(itemSelector).toArray();
  const maxItems = Math.min(
    Number.isFinite(Number(config.maxItems)) ? Number(config.maxItems) : 200,
    1000,
  );

  const items = [];
  for (const element of elements.slice(0, maxItems)) {
    const record = {};
    for (const [key, fallback] of Object.entries(DEFAULT_SELECTORS)) {
      const configured = config.fields?.[key] ?? fallback;
      const value = readValue($, element, configured);
      if (value !== undefined && value !== null && String(value).trim()) {
        record[key] = value;
      }
    }
    const category = $(element).find('[class*="category"], [class*="type"]').first().text();
    if (category) record.category = category;

    const item = buildItem({
      record,
      // Fields are already mapped by selector above; do not re-map them.
      config: { ...config, fields: {} },
      baseUrl: response.url,
      raw: {
        html: $(element).html()?.slice(0, 20000) ?? null,
      },
    });
    if (item) items.push(item);
  }

  return {
    items,
    skipped: Math.max(0, elements.length - items.length),
    pageSummary: `${elements.length} HTML record(s) matched`,
  };
}

module.exports = { parse, parseSelector, readValue, oneLine };
