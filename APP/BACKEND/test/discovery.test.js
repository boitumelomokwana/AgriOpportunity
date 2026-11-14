'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const { after, before, test } = require('node:test');

const { parseSourceResponse } = require('../src/discovery/adapters');
const { assertPublicUrl, parseRobots, robotsAllows } = require('../src/discovery/http');
const { runSource } = require('../src/discovery/runner');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const originalLookup = dns.lookup;
const originalFetch = global.fetch;
const routes = new Map();

function fakeResponse(status, body, contentType = 'text/plain') {
  const headers = new Map([['content-type', contentType]]);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers.get(String(name).toLowerCase()) ?? null },
    text: async () => body,
  };
}

function fakeFetch(input) {
  const url = String(input);
  if (url.endsWith('/robots.txt')) {
    return Promise.resolve(fakeResponse(200, 'User-agent: *\nAllow: /\n'));
  }
  const route = routes.get(url);
  if (!route) return Promise.resolve(fakeResponse(404, 'not found'));
  return Promise.resolve(fakeResponse(200, route.body, route.contentType));
}

before(() => {
  dns.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  global.fetch = fakeFetch;
});

after(() => {
  dns.lookup = originalLookup;
  global.fetch = originalFetch;
});

/* -------------------------------------------------------------------------- */
/* Adapters                                                                   */
/* -------------------------------------------------------------------------- */

test('JSON adapter maps fields, infers category and never invents dates', () => {
  const source = {
    source_type: 'json',
    config: {
      type: 'opportunity',
      itemPath: 'data.jobs',
      fields: { provider: 'company.name', closingDate: 'dates.closes' },
    },
  };
  const response = {
    url: 'https://example.com/jobs',
    text: JSON.stringify({
      data: {
        jobs: [
          {
            id: 'job-1',
            title: 'Agronomy Internship',
            company: { name: 'FarmCo' },
            description: '<p>Work on a farm.</p>',
            province: 'Gauteng',
            dates: { closes: '31/01/2027' },
            tags: ['agriculture', 'graduate'],
          },
          {
            id: 'job-2',
            title: 'Learnership without a deadline',
            company: { name: 'FarmCo' },
            description: 'No closing date supplied.',
            province: 'Limpopo',
            dates: {},
          },
        ],
      },
    }),
  };

  const parsed = parseSourceResponse(response, source);
  assert.equal(parsed.items.length, 2);

  const first = parsed.items[0];
  assert.equal(first.kind, 'opportunity');
  assert.equal(first.externalId, 'job-1');
  assert.equal(first.opportunity.title, 'Agronomy Internship');
  assert.equal(first.opportunity.provider, 'FarmCo');
  assert.equal(first.opportunity.category, 'Internship');
  assert.equal(first.opportunity.province, 'Gauteng');
  assert.equal(first.opportunity.closingDate, '2027-01-31');
  assert.equal(first.opportunity.description, 'Work on a farm.');
  assert.deepEqual(first.opportunity.tags, ['agriculture', 'graduate']);

  assert.equal(parsed.items[1].opportunity.closingDate, null);
});

test('JSON adapter supports company records and mixed type mapping', () => {
  const source = {
    source_type: 'json',
    config: {
      type: 'mixed',
      typeField: 'kind',
      typeMap: { company: 'company', vacancy: 'opportunity' },
      itemPath: 'items',
    },
  };
  const response = {
    url: 'https://example.com/feed',
    text: JSON.stringify({
      items: [
        { kind: 'company', id: 'c1', name: 'Agri Co', province: 'Western Cape' },
        { kind: 'vacancy', id: 'v1', title: 'Farm Manager', company: 'Agri Co' },
      ],
    }),
  };

  const parsed = parseSourceResponse(response, source);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].kind, 'company');
  assert.equal(parsed.items[0].company.name, 'Agri Co');
  assert.equal(parsed.items[0].company.province, 'Western Cape');
  assert.equal(parsed.items[1].kind, 'opportunity');
  assert.equal(parsed.items[1].opportunity.provider, 'Agri Co');
});

test('JSON adapter rejects invalid JSON and missing item paths', () => {
  assert.throws(
    () =>
      parseSourceResponse(
        { url: 'https://example.com', text: 'not json' },
        { source_type: 'json', config: {} },
      ),
    /valid JSON/,
  );
  assert.throws(
    () =>
      parseSourceResponse(
        { url: 'https://example.com', text: '{"items":[]}' },
        { source_type: 'json', config: { itemPath: 'data.records' } },
      ),
    /did not contain an array/,
  );
});

test('RSS adapter reads RSS and Atom envelopes', () => {
  const rss = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[Agricultural Learnership 2027]]></title>
        <link>https://example.com/learnerships/1</link>
        <guid>learnership-1</guid>
        <description><![CDATA[<p>Apply for the learnership.</p>]]></description>
        <category>Learnership</category>
        <pubDate>Mon, 02 Feb 2026 08:00:00 +0200</pubDate>
      </item>
    </channel></rss>`;

  const parsed = parseSourceResponse(
    { url: 'https://example.com/feed.xml', text: rss },
    { source_type: 'rss', config: { type: 'opportunity' } },
  );

  assert.equal(parsed.items.length, 1);
  const item = parsed.items[0].opportunity;
  assert.equal(parsed.items[0].sourceUrl, 'https://example.com/learnerships/1');
  assert.equal(item.title, 'Agricultural Learnership 2027');
  assert.equal(item.category, 'Learnership');
  assert.equal(item.description, 'Apply for the learnership.');
  assert.equal(item.provider, null);

  const atom = `<feed>
    <entry>
      <title>Graduate Programme</title>
      <link rel="alternate" href="/graduate" />
      <id>entry-1</id>
      <summary>Graduate opportunity.</summary>
    </entry>
  </feed>`;
  const atomParsed = parseSourceResponse(
    { url: 'https://example.com/atom.xml', text: atom },
    { source_type: 'rss', config: { type: 'opportunity' } },
  );
  assert.equal(atomParsed.items.length, 1);
  assert.equal(atomParsed.items[0].sourceUrl, 'https://example.com/graduate');
});

test('HTML adapter uses configured item and field selectors', () => {
  const html = `<html><body>
    <article class="job">
      <h2><a href="/jobs/agri-intern">Agri Intern</a></h2>
      <div class="summary">Work with crops.</div>
      <span class="closing">15 March 2027</span>
      <span class="company">FarmCo</span>
    </article>
    <article class="job">
      <h2><a href="https://example.com/jobs/other">Farm Assistant</a></h2>
      <div class="summary">Assist on the farm.</div>
    </article>
  </body></html>`;

  const parsed = parseSourceResponse(
    { url: 'https://example.com/careers', text: html },
    {
      source_type: 'html',
      config: {
        type: 'opportunity',
        itemSelector: 'article.job',
        fields: {
          title: 'h2 a',
          sourceUrl: 'h2 a@href',
          description: '.summary',
          closingDate: '.closing',
          provider: '.company',
        },
      },
    },
  );

  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].opportunity.title, 'Agri Intern');
  assert.equal(parsed.items[0].sourceUrl, 'https://example.com/jobs/agri-intern');
  assert.equal(parsed.items[0].opportunity.closingDate, '2027-03-15');
  assert.equal(parsed.items[0].opportunity.provider, 'FarmCo');
  assert.equal(parsed.items[1].opportunity.closingDate, null);
});

test('HTML adapter requires itemSelector', () => {
  assert.throws(
    () =>
      parseSourceResponse(
        { url: 'https://example.com', text: '<html></html>' },
        { source_type: 'html', config: { type: 'opportunity' } },
      ),
    /itemSelector/,
  );
});

/* -------------------------------------------------------------------------- */
/* Source safety                                                              */
/* -------------------------------------------------------------------------- */

test('private and non-HTTP source URLs are rejected', async () => {
  await assert.rejects(assertPublicUrl('http://127.0.0.1/jobs'), /private/i);
  await assert.rejects(assertPublicUrl('http://localhost/jobs'), /private/i);
  await assert.rejects(assertPublicUrl('file:///etc/passwd'), /http/i);
  await assert.rejects(assertPublicUrl('https://user:pass@example.com'), /Credentials/i);

  const privateLookup = dns.lookup;
  dns.lookup = async () => [{ address: '10.0.0.7', family: 4 }];
  try {
    await assert.rejects(assertPublicUrl('https://internal.example/jobs'), /private/i);
  } finally {
    dns.lookup = privateLookup;
  }
});

test('robots.txt rules are applied with longest-match precedence', () => {
  const groups = parseRobots(
    ['User-agent: *', 'Disallow: /private', 'Allow: /private/public', 'Disallow: /'].join('\n'),
  );
  assert.equal(robotsAllows(groups, '/', 'AgriOpportunitiesDiscovery'), false);
  assert.equal(robotsAllows(groups, '/private/x', 'AgriOpportunitiesDiscovery'), false);
  assert.equal(robotsAllows(groups, '/private/public/x', 'AgriOpportunitiesDiscovery'), true);
});

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

function likeMatcher(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '\\') {
      index += 1;
      source += (pattern[index] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (character === '%') source += '.*';
    else if (character === '_') source += '.';
    else source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${source}$`, 'i');
}

class FakeQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.mode = 'select';
    this.payload = null;
    this.limitValue = null;
    this.orderValue = null;
  }

  select() {
    return this;
  }

  insert(payload) {
    this.mode = 'insert';
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload) {
    this.mode = 'update';
    this.payload = payload;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ type: 'ilike', column, value });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderValue = { column, ascending };
    return this;
  }

  maybeSingle() {
    return this.execute('maybe');
  }

  single() {
    return this.execute('single');
  }

  then(resolve, reject) {
    return this.execute('many').then(resolve, reject);
  }

  catch(reject) {
    return this.execute('many').catch(reject);
  }

  matches(row) {
    return this.filters.every((filter) => {
      const value = row[filter.column];
      if (filter.type === 'eq') {
        return (value ?? null) === (filter.value ?? null);
      }
      return value !== null && value !== undefined &&
        likeMatcher(String(filter.value)).test(String(value));
    });
  }

  uniqueConflict(rows, candidate) {
    if (this.table === 'organizations') {
      return rows.some(
        (row) =>
          row.id !== candidate.id &&
          String(row.name).toLowerCase() === String(candidate.name).toLowerCase(),
      );
    }
    if (this.table === 'discovered_companies' || this.table === 'discovered_opportunities') {
      return rows.some(
        (row) =>
          row.id !== candidate.id &&
          row.source_id === candidate.source_id &&
          ((candidate.external_id && row.external_id === candidate.external_id) ||
            (candidate.source_url && row.source_url === candidate.source_url)),
      );
    }
    if (this.table === 'opportunities') {
      return rows.some(
        (row) =>
          row.id !== candidate.id &&
          candidate.external_reference &&
          row.external_reference === candidate.external_reference &&
          (row.organization_id ?? null) === (candidate.organization_id ?? null),
      );
    }
    return false;
  }

  async execute(mode) {
    const rows = this.db.tables[this.table];
    if (!rows) return { data: null, error: { message: `Unknown table ${this.table}` } };

    if (this.mode === 'insert') {
      const created = [];
      for (const candidate of this.payload) {
        const row = {
          id: candidate.id ?? crypto.randomUUID(),
          created_at: candidate.created_at ?? new Date().toISOString(),
          ...candidate,
        };
        if (this.uniqueConflict(rows, row)) {
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          };
        }
        rows.push(row);
        created.push(row);
      }
      return mode === 'single' ? { data: created[0], error: null } : { data: created, error: null };
    }

    const matched = rows.filter((row) => this.matches(row));

    if (this.mode === 'update') {
      for (const row of matched) {
        Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      }
      return mode === 'single'
        ? { data: matched[0] ?? null, error: null }
        : { data: matched, error: null };
    }

    let result = [...matched];
    if (this.orderValue) {
      const { column, ascending } = this.orderValue;
      result.sort((left, right) => {
        const a = left[column] ?? '';
        const b = right[column] ?? '';
        if (a === b) return 0;
        return (a < b ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (this.limitValue !== null) result = result.slice(0, this.limitValue);

    if (mode === 'single') {
      if (result.length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'JSON object requested' } };
      }
      return { data: result[0], error: null };
    }
    if (mode === 'maybe') {
      if (result.length > 1) {
        return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
      }
      return { data: result[0] ?? null, error: null };
    }
    return { data: result, error: null, count: result.length };
  }
}

function createFakeClient(seed = {}) {
  const tables = {
    discovery_sources: [],
    discovery_runs: [],
    discovered_companies: [],
    discovered_opportunities: [],
    discovery_changes: [],
    admin_logs: [],
    organizations: [],
    opportunities: [],
    ...Object.fromEntries(
      Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
    ),
  };
  return {
    tables,
    from(table) {
      return new FakeQuery({ tables }, table);
    },
  };
}

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

function fixtureSource(overrides = {}) {
  return {
    id: SOURCE_ID,
    name: 'Fixture Careers Feed',
    slug: 'fixture-careers-feed',
    source_type: 'json',
    base_url: 'https://example.com/jobs.json',
    terms_url: 'https://example.com/terms',
    license_note: 'Test fixture only',
    is_enabled: true,
    requires_credentials: false,
    rate_limit_seconds: 3600,
    last_run_at: null,
    last_success_at: null,
    last_error: null,
    config: {
      type: 'mixed',
      typeField: 'kind',
      typeMap: { company: 'company', opportunity: 'opportunity' },
      itemPath: 'items',
      autoImport: true,
    },
    ...overrides,
  };
}

function fixturePayload(closingDate = '2030-01-31') {
  return {
    items: [
      {
        kind: 'company',
        id: 'company-1',
        name: 'Fixture Agri (Pty) Ltd',
        registration_number: '2026/111111/07',
        description: 'A fixture agricultural company.',
        industry: 'Agriculture',
        website: 'https://fixture-agri.example',
        contact_email: 'careers@fixture-agri.example',
        province: 'Gauteng',
        city: 'Pretoria',
        careers_url: 'https://fixture-agri.example/careers',
      },
      {
        kind: 'opportunity',
        id: 'opportunity-1',
        title: 'Agronomy Graduate Programme',
        company: 'Fixture Agri (Pty) Ltd',
        description: 'A fixture graduate programme description.',
        category: 'Graduate Programme',
        province: 'Gauteng',
        closing_date: closingDate,
        application_url: 'https://fixture-agri.example/apply',
      },
    ],
  };
}

test('runner imports companies and opportunities as pending and unpublished', async () => {
  routes.set('https://example.com/jobs.json', {
    body: JSON.stringify(fixturePayload()),
    contentType: 'application/json',
  });

  const client = createFakeClient();
  const source = fixtureSource();
  client.tables.discovery_sources.push({ ...source });

  const result = await runSource(client, source, { triggerType: 'manual' });

  assert.equal(result.run.status, 'succeeded');
  assert.equal(result.stats.companiesFound, 1);
  assert.equal(result.stats.opportunitiesFound, 1);
  assert.equal(result.stats.companiesImported, 1);
  assert.equal(result.stats.opportunitiesImported, 1);

  const organizations = client.tables.organizations;
  assert.equal(organizations.length, 1);
  assert.equal(organizations[0].name, 'Fixture Agri (Pty) Ltd');
  assert.equal(organizations[0].status, 'pending');
  assert.equal(organizations[0].api_enabled, false);
  assert.equal(organizations[0].registration_number, '2026/111111/07');

  const opportunities = client.tables.opportunities;
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].status, 'pending');
  assert.equal(opportunities[0].published, false);
  assert.equal(opportunities[0].verification_status, 'pending');
  assert.equal(opportunities[0].submission_source, 'import');
  assert.equal(opportunities[0].source_type, 'third_party_api');
  assert.equal(opportunities[0].organization_id, organizations[0].id);
  assert.match(opportunities[0].external_reference, /^discovery:fixture-careers-feed:/);

  assert.equal(client.tables.discovered_companies[0].status, 'imported');
  assert.equal(client.tables.discovered_opportunities[0].status, 'imported');
  assert.ok(client.tables.admin_logs.some((log) => log.action === 'discovery.company_auto_imported'));
  assert.ok(
    client.tables.admin_logs.some((log) => log.action === 'discovery.opportunity_auto_imported'),
  );
  assert.ok(client.tables.discovery_runs[0].finished_at);

  // A second collection must deduplicate rather than duplicate records.
  const again = await runSource(client, source, { triggerType: 'manual' });
  assert.equal(again.stats.duplicates, 2);
  assert.equal(client.tables.organizations.length, 1);
  assert.equal(client.tables.opportunities.length, 1);
});

test('runner marks expired opportunities and never imports them', async () => {
  routes.set('https://example.com/jobs.json', {
    body: JSON.stringify(fixturePayload('2020-01-31')),
    contentType: 'application/json',
  });

  const client = createFakeClient();
  const source = fixtureSource();
  client.tables.discovery_sources.push({ ...source });

  const result = await runSource(client, source, { triggerType: 'manual' });

  assert.equal(result.run.status, 'succeeded');
  assert.equal(client.tables.opportunities.length, 0);
  assert.equal(client.tables.discovered_opportunities[0].status, 'expired');
  assert.ok(client.tables.discovered_opportunities[0].expired_at);
  assert.equal(result.stats.expiredCount, 1);
});

test('runner rejects a disabled source without creating a run', async () => {
  const client = createFakeClient();
  const source = fixtureSource({ is_enabled: false });

  await assert.rejects(
    runSource(client, source, { triggerType: 'manual' }),
    /disabled/,
  );
  assert.equal(client.tables.discovery_runs.length, 0);
});
