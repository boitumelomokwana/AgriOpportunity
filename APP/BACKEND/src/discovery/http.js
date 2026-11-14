'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 15000;

function discoveryError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function isPrivateIp(address) {
  if (!net.isIP(address)) return false;
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('::ffff:127.') ||
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:192.168.')
  );
}

async function assertPublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw discoveryError('invalid_source_url', 'The source URL is not valid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw discoveryError('invalid_source_url', 'Only http and https sources are allowed.');
  }
  if (url.username || url.password) {
    throw discoveryError('invalid_source_url', 'Credentials must not be embedded in source URLs.');
  }

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw discoveryError('private_source', 'Local and private source hosts are not allowed.');
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw discoveryError('private_source', 'Private network source hosts are not allowed.');
  }

  // Resolve and reject private addresses. This does not fully prevent DNS
  // rebinding, so redirects are re-validated on every hop as well.
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      throw discoveryError('private_source', 'The source resolves to a private network address.');
    }
  } catch (error) {
    if (error.code === 'private_source') throw error;
    throw discoveryError('source_unreachable', `Could not resolve ${host}.`, 502);
  }

  return url;
}

function credentialHeaders(source) {
  const config = source.config ?? {};
  const headers = { ...(config.headers ?? {}) };
  const envName = config.credentialEnv;
  if (envName) {
    if (!/^DISCOVERY_[A-Z0-9_]+$/.test(envName)) {
      throw discoveryError(
        'invalid_credential_env',
        'credentialEnv must use the DISCOVERY_ prefix.',
      );
    }
    const value = process.env[envName];
    if (!value) {
      throw discoveryError(
        'missing_credentials',
        `The server environment variable ${envName} is not set.`,
        503,
      );
    }
    headers.Authorization = value.startsWith('Bearer ') ? value : `Bearer ${value}`;
  }
  // Never allow a stored config to override the user agent or accept-encoding.
  delete headers.host;
  delete headers['content-length'];
  return headers;
}

async function requestOnce(url, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent':
          'AgriOpportunitiesDiscovery/1.0 (+https://agriopportunities.co.za; admin-configured sources)',
        accept: 'application/json, application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'accept-language': 'en-ZA,en;q=0.9',
        ...headers,
      },
      redirect: 'manual',
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function safeFetch(rawUrl, source) {
  let url = await assertPublicUrl(rawUrl);
  const headers = credentialHeaders(source);
  const timeoutMs = Number(source.config?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;
    try {
      response = await requestOnce(url, headers, timeoutMs);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw discoveryError('source_timeout', `The source timed out after ${timeoutMs}ms.`, 504);
      }
      throw discoveryError('source_unreachable', `The source request failed: ${error.message}`, 502);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw discoveryError('invalid_redirect', 'The source returned a redirect without a location.', 502);
      }
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw discoveryError(
        'source_http_error',
        `The source returned HTTP ${response.status}.`,
        response.status === 429 ? 429 : 502,
      );
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) {
      throw discoveryError('source_too_large', 'The source response is larger than 2 MB.', 502);
    }
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      throw discoveryError('source_too_large', 'The source response is larger than 2 MB.', 502);
    }

    return {
      url: url.toString(),
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      text,
    };
  }

  throw discoveryError('too_many_redirects', 'The source redirected too many times.', 502);
}

function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && current && value) {
      current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  return groups;
}

function robotsAllows(groups, pathname, userAgent) {
  const agent = userAgent.toLowerCase();
  let selected = [];
  for (const group of groups) {
    if (group.agents.includes('*') || group.agents.some((item) => agent.includes(item))) {
      selected = selected.concat(group.rules);
    }
  }
  if (selected.length === 0) return true;

  let best = null;
  for (const rule of selected) {
    if (rule.path === '/') {
      if (!best || rule.path.length > best.path.length) best = rule;
      continue;
    }
    if (pathname.startsWith(rule.path)) {
      if (!best || rule.path.length > best.path.length) best = rule;
    }
  }
  return best ? best.allow : true;
}

const robotsCache = new Map();

async function assertRobotsAllowed(url, source) {
  if (source.config?.respectRobots === false) return;
  const origin = new URL(url).origin;
  let groups = robotsCache.get(origin);
  if (!groups) {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const response = await safeFetch(robotsUrl, { ...source, config: {} });
      groups = parseRobots(response.text);
    } catch (error) {
      if (error.code === 'source_http_error' && /HTTP (401|403)/.test(error.message)) {
        robotsCache.set(origin, []);
        throw discoveryError(
          'robots_forbidden',
          'robots.txt forbids automated access to this source.',
          403,
        );
      }
      // 404/5xx or a transient failure: continue. A 401/403 is handled above.
      groups = [];
    }
    robotsCache.set(origin, groups);
  }
  const pathname = new URL(url).pathname || '/';
  const ua = 'AgriOpportunitiesDiscovery';
  if (!robotsAllows(groups, pathname, ua)) {
    throw discoveryError('robots_forbidden', 'robots.txt does not allow this path.', 403);
  }
}

module.exports = {
  assertPublicUrl,
  assertRobotsAllowed,
  isPrivateIp,
  parseRobots,
  robotsAllows,
  safeFetch,
  discoveryError,
};
