'use strict';

const { getPath, oneLine } = require('../normalize');
const { buildItem } = require('./shared');

function adapterError(message) {
  const error = new Error(message);
  error.code = 'invalid_source_payload';
  error.statusCode = 502;
  return error;
}

/**
 * JSON adapter. The payload is either an array or an object containing an
 * array at `config.itemPath` (dot notation supported).
 */
function parse(response, source) {
  const config = source.config ?? {};
  let payload;
  try {
    payload = JSON.parse(response.text);
  } catch {
    throw adapterError('The JSON source did not return valid JSON.');
  }

  const itemPath =
    typeof config.itemPath === 'string' && config.itemPath.trim()
      ? config.itemPath.trim()
      : null;
  const container = itemPath ? getPath(payload, itemPath) : payload;

  let items = null;
  if (Array.isArray(container)) items = container;
  else if (container && Array.isArray(container.items)) items = container.items;
  else if (container && Array.isArray(container.results)) items = container.results;
  else if (container && Array.isArray(container.data)) items = container.data;
  else if (itemPath && container && typeof container === 'object') items = [container];

  if (!items) {
    throw adapterError(
      itemPath
        ? `The JSON source did not contain an array at ${itemPath}.`
        : 'The JSON source must return an array or set config.itemPath.',
    );
  }

  const maxItems = Math.min(
    Number.isFinite(Number(config.maxItems)) ? Number(config.maxItems) : 200,
    1000,
  );

  const parsed = [];
  for (const record of items.slice(0, maxItems)) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const item = buildItem({
      record,
      config,
      baseUrl: response.url,
      raw: record,
    });
    if (item) parsed.push(item);
  }

  return {
    items: parsed,
    skipped: Math.max(0, items.length - parsed.length),
    pageSummary: oneLine(
      config.label ?? `${items.length} JSON record(s) read`,
      200,
    ),
  };
}

module.exports = { parse };
