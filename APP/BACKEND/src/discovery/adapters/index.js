'use strict';

const html = require('./html');
const json = require('./json');
const rss = require('./rss');

const ADAPTERS = {
  json,
  rss,
  html,
};

function getAdapter(sourceType) {
  const adapter = ADAPTERS[sourceType];
  if (!adapter) {
    const error = new Error(`Unsupported discovery source type: ${sourceType}`);
    error.code = 'unsupported_source_type';
    error.statusCode = 400;
    throw error;
  }
  return adapter;
}

function parseSourceResponse(response, source) {
  return getAdapter(source.source_type).parse(response, source);
}

module.exports = { ADAPTERS, getAdapter, parseSourceResponse };
