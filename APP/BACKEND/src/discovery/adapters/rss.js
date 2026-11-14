'use strict';

const { cleanText, decodeEntities, oneLine } = require('../normalize');
const { buildItem } = require('./shared');

function adapterError(message) {
  const error = new Error(message);
  error.code = 'invalid_source_payload';
  error.statusCode = 502;
  return error;
}

function unwrapCdata(value) {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value ?? '');
  return match ? match[1] : value ?? '';
}

function tagValue(block, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(
      `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`,
      'i',
    ).exec(block);
    if (match) return unwrapCdata(decodeEntities(match[1])).trim();
  }
  return null;
}

function atomLink(block) {
  const matches = block.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of matches) {
    const rel = /\brel=["']([^"']+)["']/i.exec(tag)?.[1];
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
    if (href && (!rel || rel === 'alternate')) return decodeEntities(href);
  }
  return null;
}

function allCategories(block) {
  const values = [];
  const pattern = /<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi;
  let match;
  while ((match = pattern.exec(block))) {
    values.push(decodeEntities(unwrapCdata(match[1])).trim());
  }
  const attrPattern = /<category\b[^>]*\bterm=["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = attrPattern.exec(block))) {
    values.push(decodeEntities(match[1]).trim());
  }
  return values.filter(Boolean);
}

/**
 * RSS 2.0 / Atom adapter. No external XML dependency is needed because only
 * the small, well-known item envelope is read.
 */
function parse(response, source) {
  const config = source.config ?? {};
  const text = response.text ?? '';
  if (!/<(rss|feed|rdf:RDF)\b/i.test(text)) {
    throw adapterError('The RSS source did not return an RSS or Atom feed.');
  }

  const blocks = [];
  const patterns = [
    /<item\b[^>]*>([\s\S]*?)<\/item>/gi,
    /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) blocks.push(match[1]);
  }
  if (blocks.length === 0) {
    return { items: [], skipped: 0, pageSummary: 'The feed contained no entries.' };
  }

  const maxItems = Math.min(
    Number.isFinite(Number(config.maxItems)) ? Number(config.maxItems) : 200,
    1000,
  );

  const items = [];
  for (const block of blocks.slice(0, maxItems)) {
    const title = tagValue(block, ['title']);
    const link =
      tagValue(block, ['link']) ??
      atomLink(block) ??
      tagValue(block, ['guid', 'id']);
    const description =
      tagValue(block, ['content:encoded', 'description', 'summary', 'content']) ??
      null;
    const categories = allCategories(block);
    const date = tagValue(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const author =
      tagValue(block, ['dc:creator', 'author', 'name']) ?? null;

    const record = {
      title,
      link,
      description,
      categories: categories.join(', '),
      pubDate: date,
      author,
      guid: tagValue(block, ['guid', 'id']) ?? link,
    };

    const item = buildItem({
      record,
      config,
      baseUrl: response.url,
      raw: {
        title,
        link,
        description: description ? cleanText(description, 2000) : null,
        categories,
        pubDate: date,
        author,
      },
    });
    if (item) items.push(item);
  }

  return {
    items,
    skipped: Math.max(0, blocks.length - items.length),
    pageSummary: `${blocks.length} feed entr${blocks.length === 1 ? 'y' : 'ies'} read`,
  };
}

module.exports = { parse, tagValue, allCategories, unwrapCdata, oneLine };
