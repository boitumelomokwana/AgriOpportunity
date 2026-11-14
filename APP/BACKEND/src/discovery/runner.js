'use strict';

const { parseSourceResponse } = require('./adapters');
const { assertRobotsAllowed, safeFetch } = require('./http');
const {
  hashObject,
  inferCategory,
  isExpired,
  matchProvince,
  oneLine,
} = require('./normalize');

const MAX_ERRORS = 20;
const DEFAULT_REQUIREMENTS = {
  studyLevel: false,
  careerField: false,
  experience: false,
};

const COMPANY_FIELDS = [
  'name',
  'trading_name',
  'registration_number',
  'description',
  'industry',
  'sector',
  'website',
  'contact_email',
  'contact_phone',
  'province',
  'city',
  'careers_url',
  'source_url',
];

function discoveryError(code, message, statusCode = 500, details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  return error;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function websiteHost(value) {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function todayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

function sourceConfig(source) {
  const config = source?.config;
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

function autoImportEnabled(source, kind) {
  const config = sourceConfig(source);
  if (config.autoImport === false) return false;
  if (kind === 'company' && config.autoImportCompanies === false) return false;
  return true;
}

function sourceTypeForOpportunity(source) {
  return sourceConfig(source).official === true ? 'official_api' : 'third_party_api';
}

function addError(stats, message) {
  stats.errorCount += 1;
  if (stats.errors.length < MAX_ERRORS) stats.errors.push(message);
}

async function audit(client, action, entityType, entityId, details) {
  const { error } = await client.from('admin_logs').insert({
    admin_id: null,
    actor_type: 'system',
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    details: details ?? {},
  });
  if (error) console.warn(`[discovery] Could not write audit log: ${error.message}`);
}

async function recordChange(client, change) {
  const { error } = await client.from('discovery_changes').insert(change);
  if (error) console.warn(`[discovery] Could not record change: ${error.message}`);
}

function changedFields(existing, next, fields) {
  const patch = {};
  for (const field of fields) {
    const value = next[field];
    if (value === undefined || value === null || value === '') continue;
    const current = existing[field];
    const same =
      current === value ||
      (value && typeof value === 'object' && JSON.stringify(current) === JSON.stringify(value));
    if (!same) patch[field] = value;
  }
  return patch;
}

function companyHash(payload) {
  return hashObject({
    name: payload.name,
    trading_name: payload.trading_name,
    registration_number: payload.registration_number,
    description: payload.description,
    industry: payload.industry,
    sector: payload.sector,
    website: payload.website,
    contact_email: payload.contact_email,
    contact_phone: payload.contact_phone,
    province: payload.province,
    city: payload.city,
    careers_url: payload.careers_url,
    source_url: payload.source_url,
  });
}

function opportunityHash(payload) {
  return hashObject({
    title: payload.title,
    description: payload.description,
    provider: payload.provider,
    category: payload.category,
    opportunity_type: payload.opportunity_type,
    location: payload.location,
    province: payload.province,
    qualification: payload.qualification,
    eligibility_criteria: payload.eligibility_criteria,
    application_url: payload.application_url,
    source_url: payload.source_url,
    opening_date: payload.opening_date,
    closing_date: payload.closing_date,
    is_remote: payload.is_remote,
    tags: payload.tags,
  });
}

function buildCompanyPayload(source, item) {
  const company = item.company;
  const province = company.province
    ? matchProvince(company.province) ?? company.province
    : null;
  const base = {
    source_id: source.id,
    external_id: item.externalId,
    name: company.name,
    trading_name: company.tradingName,
    registration_number: company.registrationNumber,
    description: company.description,
    industry: company.industry,
    sector: company.sector ?? company.industry,
    website: company.website,
    contact_email: company.contactEmail,
    contact_phone: company.contactPhone,
    province,
    city: company.city,
    careers_url: company.careersUrl,
    source_url: item.sourceUrl,
    raw_data: item.raw ?? {},
  };
  base.content_hash = companyHash(base);
  return base;
}

function buildOpportunityPayload(source, item) {
  const opportunity = item.opportunity;
  const category =
    oneLine(opportunity.category, 80) ||
    inferCategory(opportunity.title, opportunity.description, opportunity.opportunityType);
  const province =
    matchProvince(opportunity.province) ??
    matchProvince(opportunity.location) ??
    'National';
  const base = {
    source_id: source.id,
    external_id: item.externalId,
    title: opportunity.title,
    description: opportunity.description,
    provider: opportunity.provider,
    category,
    opportunity_type: opportunity.opportunityType ?? category,
    location: opportunity.location,
    province,
    qualification: opportunity.qualification ?? 'Not specified',
    eligibility_criteria: opportunity.eligibility,
    application_url: opportunity.applicationUrl,
    source_url: item.sourceUrl,
    opening_date: opportunity.openingDate,
    closing_date: opportunity.closingDate,
    is_remote: opportunity.isRemote,
    tags: opportunity.tags ?? [],
    requirements: {},
    raw_data: item.raw ?? {},
  };
  base.content_hash = opportunityHash(base);
  return base;
}

/* -------------------------------------------------------------------------- */
/* Candidate storage                                                          */
/* -------------------------------------------------------------------------- */

async function findDiscovered(client, table, sourceId, externalId, sourceUrl) {
  if (externalId) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('source_id', sourceId)
      .eq('external_id', externalId)
      .maybeSingle();
    if (error) throw discoveryError('database_error', error.message, 500);
    if (data) return data;
  }
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('source_id', sourceId)
    .eq('source_url', sourceUrl)
    .maybeSingle();
  if (error) throw discoveryError('database_error', error.message, 500);
  return data ?? null;
}

async function findMatchingOrganization(client, company) {
  if (company.registration_number) {
    const { data } = await client
      .from('organizations')
      .select('*')
      .ilike('registration_number', escapeLike(company.registration_number))
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  const { data: byName } = await client
    .from('organizations')
    .select('*')
    .ilike('name', escapeLike(company.name))
    .limit(1)
    .maybeSingle();
  if (byName) return byName;

  const host = websiteHost(company.website);
  if (host) {
    const { data: byWebsite } = await client
      .from('organizations')
      .select('*')
      .ilike('website', `%${escapeLike(host)}%`)
      .limit(1)
      .maybeSingle();
    if (byWebsite) return byWebsite;
  }

  return null;
}

async function upsertOrganizationFromCompany(client, row) {
  const match = await findMatchingOrganization(client, row);
  if (match) {
    const patch = {};
    const pairs = [
      ['description', row.description],
      ['industry', row.industry],
      ['website', row.website],
      ['contact_email', row.contact_email],
      ['contact_phone', row.contact_phone],
      ['province', row.province],
      ['registration_number', row.registration_number],
      ['address', row.city],
    ];
    for (const [field, value] of pairs) {
      if (value && !match[field]) patch[field] = value;
    }
    if (Object.keys(patch).length === 0) return match;

    const { data, error } = await client
      .from('organizations')
      .update(patch)
      .eq('id', match.id)
      .select('*')
      .single();
    if (error) throw discoveryError('database_error', error.message, 500);
    return data;
  }

  // Never let discovery overwrite or approve a curated organisation.
  if (row.name.length < 2 || row.name.length > 200) {
    throw discoveryError(
      'invalid_company_name',
      'The company name is outside the 2-200 character organisation range.',
      422,
    );
  }

  const { data, error } = await client
    .from('organizations')
    .insert({
      name: row.name,
      description: row.description,
      industry: row.industry ?? row.sector,
      website: row.website,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      province: row.province,
      address: row.city,
      registration_number: row.registration_number,
      status: 'pending',
      api_enabled: false,
      integration_method: 'none',
    })
    .select('*')
    .single();

  if (error?.code === '23505') {
    const { data: existing } = await client
      .from('organizations')
      .select('*')
      .ilike('name', escapeLike(row.name))
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
  }
  if (error) throw discoveryError('database_error', error.message, 500);
  return data;
}

async function importCompanyCandidate(client, source, row, stats) {
  const organization = await upsertOrganizationFromCompany(client, row);
  const now = new Date().toISOString();

  const { error } = await client
    .from('discovered_companies')
    .update({
      organization_id: organization.id,
      status: row.status === 'verified' ? 'verified' : 'imported',
      imported_at: row.imported_at ?? now,
      last_checked_at: now,
      last_seen_at: now,
    })
    .eq('id', row.id);
  if (error) throw discoveryError('database_error', error.message, 500);

  await audit(client, 'discovery.company_auto_imported', 'discovered_company', row.id, {
    organization_id: organization.id,
    organization_name: organization.name,
    source: source.name,
  });
  stats.companiesImported += 1;
  return organization;
}

async function storeCompany(client, source, item, stats) {
  const payload = buildCompanyPayload(source, item);
  const existing = await findDiscovered(
    client,
    'discovered_companies',
    source.id,
    payload.external_id,
    payload.source_url,
  );
  const now = new Date().toISOString();
  let row = existing;

  if (existing) {
    stats.duplicates += 1;
    const patch = changedFields(existing, payload, COMPANY_FIELDS);
    const update = {
      last_seen_at: now,
      last_checked_at: now,
      raw_data: payload.raw_data,
    };
    if (Object.keys(patch).length > 0) {
      Object.assign(update, patch, {
        content_hash: payload.content_hash,
        last_changed_at: now,
      });
    }
    const { data, error } = await client
      .from('discovered_companies')
      .update(update)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw discoveryError('database_error', error.message, 500);
    row = data;

    if (Object.keys(patch).length > 0) {
      await recordChange(client, {
        entity_type: 'company',
        entity_id: existing.id,
        source_id: source.id,
        change_type: 'updated',
        changed_fields: Object.keys(patch),
        previous_data: existing,
        new_data: data,
      });
    }
  } else {
    const { data, error } = await client
      .from('discovered_companies')
      .insert({ ...payload, status: 'new' })
      .select('*')
      .single();
    if (error) throw discoveryError('database_error', error.message, 500);
    row = data;
    await recordChange(client, {
      entity_type: 'company',
      entity_id: row.id,
      source_id: source.id,
      change_type: 'created',
      changed_fields: COMPANY_FIELDS,
      previous_data: null,
      new_data: row,
    });
  }

  if (['rejected', 'merged', 'verified'].includes(row.status)) return row;
  if (row.status === 'imported') return row;

  if (!row.organization_id) {
    const match = await findMatchingOrganization(client, row);
    if (match) {
      const { data } = await client
        .from('discovered_companies')
        .update({ organization_id: match.id, status: 'matched' })
        .eq('id', row.id)
        .select('*')
        .single();
      row = data ?? row;
    }
  }

  if (!autoImportEnabled(source, 'company')) return row;

  try {
    await importCompanyCandidate(client, source, row, stats);
  } catch (error) {
    addError(stats, `Company "${row.name}": ${error.message}`);
  }
  return row;
}

async function findExistingOpportunity(client, row, organizationId) {
  if (row.opportunity_id) {
    const { data } = await client
      .from('opportunities')
      .select('*')
      .eq('id', row.opportunity_id)
      .maybeSingle();
    if (data) return data;
  }

  const externalReference = row.external_reference;
  if (externalReference) {
    let query = client
      .from('opportunities')
      .select('*')
      .eq('external_reference', externalReference);
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data } = await query.limit(1).maybeSingle();
    if (data) return data;
  }

  if (row.provider && row.title) {
    const { data } = await client
      .from('opportunities')
      .select('*')
      .eq('provider', row.provider)
      .ilike('title', escapeLike(row.title))
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function importOpportunityCandidate(client, source, row, stats) {
  if (!row.provider) {
    addError(stats, `Opportunity "${row.title}" has no organisation and was not imported.`);
    return null;
  }
  if (!row.description) {
    addError(stats, `Opportunity "${row.title}" has no description and was not imported.`);
    return null;
  }
  if (row.closing_date && row.closing_date < todayIso()) {
    addError(stats, `Opportunity "${row.title}" has already closed and was not imported.`);
    return null;
  }

  let organizationId = row.organization_id;
  if (!organizationId) {
    const { data } = await client
      .from('organizations')
      .select('*')
      .ilike('name', escapeLike(row.provider))
      .limit(1)
      .maybeSingle();
    organizationId = data?.id ?? null;
  }

  let discoveredCompanyId = row.discovered_company_id;
  if (!discoveredCompanyId && source.id) {
    const { data } = await client
      .from('discovered_companies')
      .select('id, organization_id')
      .eq('source_id', source.id)
      .ilike('name', escapeLike(row.provider ?? ''))
      .limit(1)
      .maybeSingle();
    if (data) {
      discoveredCompanyId = data.id;
      organizationId = organizationId ?? data.organization_id;
    }
  }

  const externalReference = `discovery:${source.slug}:${row.external_id ?? row.id}`;
  const existing = await findExistingOpportunity(
    client,
    { ...row, external_reference: externalReference },
    organizationId,
  );
  const now = new Date().toISOString();

  if (existing) {
    const { error } = await client
      .from('discovered_opportunities')
      .update({
        status: 'duplicate',
        opportunity_id: existing.id,
        organization_id: organizationId,
        discovered_company_id: discoveredCompanyId,
        last_checked_at: now,
        last_seen_at: now,
      })
      .eq('id', row.id);
    if (error) throw discoveryError('database_error', error.message, 500);
    stats.duplicates += 1;
    return existing;
  }

  const { data: opportunity, error } = await client
    .from('opportunities')
    .insert({
      title: row.title,
      provider: row.provider,
      category: row.category ?? 'Other',
      province: row.province ?? 'National',
      qualification: row.qualification ?? 'Not specified',
      closing_date: row.closing_date,
      description: row.description,
      tags: row.tags ?? [],
      requirements: DEFAULT_REQUIREMENTS,
      sector: sourceConfig(source).sector ?? 'Other',
      source_name: source.name,
      source_url: row.source_url,
      source_type: sourceTypeForOpportunity(source),
      application_url: row.application_url,
      verification_status: 'pending',
      published: false,
      organization_id: organizationId,
      opportunity_type: row.opportunity_type,
      location: row.location,
      is_remote: Boolean(row.is_remote),
      eligibility_criteria: row.eligibility_criteria,
      external_reference: externalReference,
      submission_source: 'import',
      content_hash: row.content_hash,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code !== '23505') {
      throw discoveryError('database_error', error.message, 500);
    }
    const duplicate = await findExistingOpportunity(
      client,
      { ...row, external_reference: externalReference },
      organizationId,
    );
    if (!duplicate) throw discoveryError('database_error', error.message, 500);
    await client
      .from('discovered_opportunities')
      .update({ status: 'duplicate', opportunity_id: duplicate.id })
      .eq('id', row.id);
    stats.duplicates += 1;
    return duplicate;
  }

  const { error: linkError } = await client
    .from('discovered_opportunities')
    .update({
      opportunity_id: opportunity.id,
      organization_id: organizationId,
      discovered_company_id: discoveredCompanyId,
      status: 'imported',
      imported_at: now,
      last_checked_at: now,
      last_seen_at: now,
    })
    .eq('id', row.id);
  if (linkError) throw discoveryError('database_error', linkError.message, 500);

  await audit(client, 'discovery.opportunity_auto_imported', 'discovered_opportunity', row.id, {
    opportunity_id: opportunity.id,
    organization_id: organizationId,
    source: source.name,
  });
  stats.opportunitiesImported += 1;
  return opportunity;
}

async function storeOpportunity(client, source, item, stats) {
  const payload = buildOpportunityPayload(source, item);
  const existing = await findDiscovered(
    client,
    'discovered_opportunities',
    source.id,
    payload.external_id,
    payload.source_url,
  );
  const now = new Date().toISOString();
  const expired = isExpired(payload.closing_date);
  let row = existing;

  if (existing) {
    stats.duplicates += 1;
    const patch = changedFields(
      existing,
      payload,
      [
        'title',
        'description',
        'provider',
        'category',
        'opportunity_type',
        'location',
        'province',
        'qualification',
        'eligibility_criteria',
        'application_url',
        'source_url',
        'opening_date',
        'closing_date',
        'is_remote',
        'tags',
      ],
    );
    const update = {
      last_seen_at: now,
      last_checked_at: now,
      raw_data: payload.raw_data,
    };
    if (expired && ['new', 'matched', 'imported'].includes(existing.status)) {
      update.status = 'expired';
      update.expired_at = existing.expired_at ?? now;
      stats.expiredCount += 1;
    } else if (!expired && existing.status === 'expired') {
      update.status = 'new';
      update.expired_at = null;
    }
    if (Object.keys(patch).length > 0) {
      Object.assign(update, patch, {
        content_hash: payload.content_hash,
        last_changed_at: now,
      });
    }
    const { data, error } = await client
      .from('discovered_opportunities')
      .update(update)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw discoveryError('database_error', error.message, 500);
    row = data;

    if (Object.keys(patch).length > 0) {
      await recordChange(client, {
        entity_type: 'opportunity',
        entity_id: existing.id,
        source_id: source.id,
        change_type: 'updated',
        changed_fields: Object.keys(patch),
        previous_data: existing,
        new_data: data,
      });
    }
  } else {
    const { data, error } = await client
      .from('discovered_opportunities')
      .insert({
        ...payload,
        status: expired ? 'expired' : 'new',
        expired_at: expired ? now : null,
      })
      .select('*')
      .single();
    if (error) throw discoveryError('database_error', error.message, 500);
    row = data;
    if (expired) stats.expiredCount += 1;
    await recordChange(client, {
      entity_type: 'opportunity',
      entity_id: row.id,
      source_id: source.id,
      change_type: 'created',
      changed_fields: [
        'title',
        'description',
        'provider',
        'category',
        'province',
        'closing_date',
        'source_url',
      ],
      previous_data: null,
      new_data: row,
    });
  }

  if (['rejected', 'expired', 'verified'].includes(row.status)) return row;
  if (row.status === 'imported') return row;
  if (!autoImportEnabled(source, 'opportunity')) return row;

  try {
    await importOpportunityCandidate(client, source, row, stats);
  } catch (error) {
    addError(stats, `Opportunity "${row.title}": ${error.message}`);
  }
  return row;
}

/* -------------------------------------------------------------------------- */
/* Run orchestration                                                          */
/* -------------------------------------------------------------------------- */

function rateLimitRemainingSeconds(source) {
  const seconds = Number(source.rate_limit_seconds ?? 3600);
  if (!source.last_run_at || !Number.isFinite(seconds)) return 0;
  const elapsed = (Date.now() - new Date(source.last_run_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(seconds - elapsed));
}

async function createRun(client, source, triggerType, requestedBy) {
  const { data, error } = await client
    .from('discovery_runs')
    .insert({
      source_id: source.id,
      status: 'running',
      trigger_type: triggerType,
      requested_by: requestedBy,
    })
    .select('*')
    .single();
  if (error) throw discoveryError('database_error', error.message, 500);
  return data;
}

async function finishRun(client, runId, patch) {
  const { data, error } = await client
    .from('discovery_runs')
    .update(patch)
    .eq('id', runId)
    .select('*')
    .single();
  if (error) console.warn(`[discovery] Could not update run ${runId}: ${error.message}`);
  return data;
}

async function runSource(
  client,
  source,
  { triggerType = 'manual', requestedBy = null, force = false, logger = console } = {},
) {
  if (!source) throw discoveryError('source_not_found', 'Discovery source not found.', 404);
  if (!source.is_enabled) {
    throw discoveryError(
      'source_disabled',
      'This discovery source is disabled. Review its terms and enable it first.',
      409,
    );
  }

  const remaining = rateLimitRemainingSeconds(source);
  if (!force && triggerType === 'schedule' && remaining > 0) {
    throw discoveryError(
      'rate_limited',
      `This source was collected recently. Try again in ${remaining} second(s).`,
      429,
      { retry_after: remaining },
    );
  }

  const startedAt = Date.now();
  const run = await createRun(client, source, triggerType, requestedBy);
  const stats = {
    itemsFound: 0,
    companiesFound: 0,
    opportunitiesFound: 0,
    duplicates: 0,
    companiesImported: 0,
    opportunitiesImported: 0,
    expiredCount: 0,
    errorCount: 0,
    errors: [],
    skipped: 0,
  };

  try {
    const config = sourceConfig(source);
    await assertRobotsAllowed(source.base_url, source);
    logger.log?.(`[discovery] Fetching ${source.name} (${source.base_url})`);
    const response = await safeFetch(source.base_url, source);
    const parsed = parseSourceResponse(response, source);

    stats.itemsFound = parsed.items.length;
    stats.skipped = parsed.skipped ?? 0;

    for (const item of parsed.items) {
      try {
        if (item.kind === 'company') {
          stats.companiesFound += 1;
          await storeCompany(client, source, item, stats);
        } else {
          stats.opportunitiesFound += 1;
          await storeOpportunity(client, source, item, stats);
        }
      } catch (error) {
        addError(
          stats,
          `${item.kind} "${item.company?.name ?? item.opportunity?.title ?? 'unknown'}": ${error.message}`,
        );
      }
    }

    const status = stats.errorCount === 0 ? 'succeeded' : 'partial';
    const finishedAt = new Date().toISOString();
    const finishedRun = await finishRun(client, run.id, {
      status,
      finished_at: finishedAt,
      duration_ms: Date.now() - startedAt,
      items_found: stats.itemsFound,
      companies_found: stats.companiesFound,
      opportunities_found: stats.opportunitiesFound,
      duplicates: stats.duplicates,
      companies_imported: stats.companiesImported,
      opportunities_imported: stats.opportunitiesImported,
      expired_count: stats.expiredCount,
      error_count: stats.errorCount,
      error_summary: stats.errors.length ? stats.errors.join('\n').slice(0, 4000) : null,
      details: {
        source_url: response.url,
        content_type: response.contentType,
        adapter: source.source_type,
        skipped: stats.skipped,
        page_summary: parsed.pageSummary ?? null,
      },
    });

    await client
      .from('discovery_sources')
      .update({
        last_run_at: finishedAt,
        last_success_at: finishedAt,
        last_error: stats.errors.length ? stats.errors[0].slice(0, 1000) : null,
      })
      .eq('id', source.id);

    return { run: finishedRun ?? run, stats };
  } catch (error) {
    const message = error?.message ?? 'The discovery run failed.';
    const finishedRun = await finishRun(client, run.id, {
      status: 'failed',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      items_found: stats.itemsFound,
      companies_found: stats.companiesFound,
      opportunities_found: stats.opportunitiesFound,
      duplicates: stats.duplicates,
      companies_imported: stats.companiesImported,
      opportunities_imported: stats.opportunitiesImported,
      error_count: Math.max(1, stats.errorCount),
      error_summary: message.slice(0, 4000),
      details: { code: error?.code ?? 'discovery_failed' },
    });

    await client
      .from('discovery_sources')
      .update({
        last_run_at: new Date().toISOString(),
        last_error: message.slice(0, 1000),
      })
      .eq('id', source.id);

    error.run = finishedRun ?? run;
    throw error;
  }
}

function isDue(source, now = Date.now()) {
  if (!source.is_enabled) return false;
  if (!source.last_run_at) return true;
  const seconds = Number(source.rate_limit_seconds ?? 3600);
  return now - new Date(source.last_run_at).getTime() >= seconds * 1000;
}

async function runDueSources(client, { limit = 25, logger = console } = {}) {
  const { data: sources, error } = await client
    .from('discovery_sources')
    .select('*')
    .eq('is_enabled', true)
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw discoveryError('database_error', error.message, 500);

  const results = [];
  for (const source of sources ?? []) {
    if (!isDue(source)) continue;
    try {
      const result = await runSource(client, source, {
        triggerType: 'schedule',
        logger,
      });
      results.push({ source: source.name, status: result.run?.status ?? 'succeeded' });
    } catch (error) {
      results.push({ source: source.name, status: 'failed', error: error.message });
      logger.warn?.(`[discovery] ${source.name} failed: ${error.message}`);
    }
  }
  return results;
}

module.exports = {
  buildCompanyPayload,
  buildOpportunityPayload,
  isDue,
  runDueSources,
  runSource,
  sourceConfig,
};
