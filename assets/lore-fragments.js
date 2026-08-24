import {
  CITY_STATE_SCHEMA,
  CITY_STATE_VERSION,
  REPO_NEWCOMER_DAYS,
  cityReferenceTimestamp,
  repositoryAgeDays,
} from './city-time.js?v=world-tree-phase4-v1';
import {
  RESIDENT_MANIFEST_SCHEMA,
  RESIDENT_MANIFEST_VERSION,
  validateResidentManifest,
} from './resident-profiles.js?v=world-tree-phase4-v1';

export const LORE_FRAGMENT_SCHEMA = 'repolis.lore-fragments';
export const LORE_FRAGMENT_VERSION = 1;
export const LORE_FRAGMENT_LIMITS = Object.freeze({
  minFragments: 10,
  maxFragments: 15,
  maxBytes: 32768,
  maxLineChars: 80,
  maxContexts: 4,
  maxTags: 4,
});
export const LORE_DELIVERY_LIMITS = Object.freeze({
  session: 2,
  perResident: 1,
  perContext: 1,
  initialDelaySeconds: 75,
  attemptIntervalSeconds: 16,
  cooldownSeconds: 90,
  chance: 0.03,
});

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_CONTEXTS = new Set([
  'home', 'porch', 'tree', 'quiet', 'dawn', 'dusk', 'night',
  'spring', 'summer', 'autumn', 'winter',
]);
const CONTROL_OR_HTML = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]|&(?:#\d+|#x[a-f0-9]+|[a-z]+);/i;
const INSTRUCTION_SHAPED = /\b(?:system|assistant|developer|user)\s*:|ignore (?:all|any|previous)|follow (?:these|the) instructions|reveal (?:the )?(?:prompt|secret)|이전\s+지시|지시(?:문)?을?\s*(?:무시|따라)|시스템\s*(?:프롬프트|메시지)|프롬프트\s*(?:공개|보여)/i;
const INTERNAL_TERMS = /\b(?:openai|anthropic|gemini|cloudflare|azure|worker|api|tokens?|provider|llm|chatgpt)\b|클라우드플레어|애저|토큰|시스템\s*프롬프트|비공개\s*분석/i;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function textBytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function safeGroup(value, max = 48) {
  return value === undefined || (
    typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && SAFE_ID.test(value)
  );
}

function safeLine(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= LORE_FRAGMENT_LIMITS.maxLineChars
    && value.trim() === value
    && !CONTROL_OR_HTML.test(value)
    && !INSTRUCTION_SHAPED.test(value)
    && !INTERNAL_TERMS.test(value);
}

function safeList(values, max, predicate) {
  return Array.isArray(values)
    && values.length > 0
    && values.length <= max
    && new Set(values).size === values.length
    && values.every(predicate);
}

export function validateLoreFragments(value, sourceText = '') {
  const lore = record(value);
  if (!lore
    || lore.schema !== LORE_FRAGMENT_SCHEMA
    || lore.version !== LORE_FRAGMENT_VERSION
    || Object.keys(lore).some(key => !['schema', 'version', 'fragments'].includes(key))
    || !Array.isArray(lore.fragments)
    || lore.fragments.length < LORE_FRAGMENT_LIMITS.minFragments
    || lore.fragments.length > LORE_FRAGMENT_LIMITS.maxFragments
    || (sourceText && textBytes(sourceText) > LORE_FRAGMENT_LIMITS.maxBytes)) return null;
  const ids = new Set(), koLines = new Set(), enLines = new Set();
  for (const candidate of lore.fragments) {
    const fragment = record(candidate), line = record(fragment?.line);
    if (!fragment
      || Object.keys(fragment).some(key => ![
        'id', 'line', 'contexts', 'tags', 'variant_group', 'contradiction_group',
      ].includes(key))
      || typeof fragment.id !== 'string'
      || fragment.id.length > 64
      || !SAFE_ID.test(fragment.id)
      || ids.has(fragment.id)
      || !line
      || Object.keys(line).length !== 2
      || !safeLine(line.ko)
      || !safeLine(line.en)
      || koLines.has(line.ko)
      || enLines.has(line.en)
      || !safeList(fragment.contexts, LORE_FRAGMENT_LIMITS.maxContexts, item => SAFE_CONTEXTS.has(item))
      || !safeList(fragment.tags, LORE_FRAGMENT_LIMITS.maxTags,
        item => typeof item === 'string' && item.length <= 32 && SAFE_ID.test(item))
      || !safeGroup(fragment.variant_group)
      || !safeGroup(fragment.contradiction_group)) return null;
    ids.add(fragment.id);
    koLines.add(line.ko);
    enLines.add(line.en);
  }
  return lore;
}

export async function loadLoreFragments({
  fetchImpl = globalThis.fetch,
  url = 'data/lore/fragments.json',
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('lore_fetch_unavailable');
  const response = await fetchImpl(url, { cache: 'no-cache' });
  if (!response?.ok) throw new Error('lore_unavailable');
  const source = await response.text();
  if (textBytes(source) > LORE_FRAGMENT_LIMITS.maxBytes) throw new Error('lore_oversized');
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('lore_malformed');
  }
  const lore = validateLoreFragments(parsed, source);
  if (!lore) throw new Error('lore_unsupported');
  return lore;
}

export function stableLoreHash(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function emptyAllocation(reason) {
  return Object.freeze({
    reason,
    eligibleCount: 0,
    elderCount: 0,
    fragmentCount: 0,
    elders: Object.freeze([]),
    assignments: Object.freeze({}),
  });
}

export function allocateElderFragments({
  manifest,
  repositories,
  cityState,
  lore,
} = {}) {
  const validManifest = validateResidentManifest(manifest);
  const validLore = validateLoreFragments(lore);
  if (!validManifest
    || validManifest.schema !== RESIDENT_MANIFEST_SCHEMA
    || validManifest.version !== RESIDENT_MANIFEST_VERSION) return emptyAllocation('resident_manifest_unavailable');
  if (!validLore) return emptyAllocation('lore_unavailable');
  if (cityState?.schema !== CITY_STATE_SCHEMA || cityState?.version !== CITY_STATE_VERSION) {
    return emptyAllocation('city_state_unavailable');
  }
  const reference = cityReferenceTimestamp(cityState, repositories || [], Number.NaN);
  if (!Number.isFinite(reference)) return emptyAllocation('reference_date_unavailable');

  const repoByName = new Map((repositories || [])
    .filter(repo => record(repo) && typeof repo.repo === 'string')
    .map(repo => [repo.repo.toLowerCase(), repo]));
  const profiles = new Map(validManifest.profiles.map(entry => [entry.slug, entry]));
  const eligible = [];
  for (const active of validManifest.active_roster) {
    const profile = profiles.get(active.slug);
    const repo = repoByName.get(String(active.repo || '').toLowerCase());
    if (!profile
      || !repo
      || profile.archived
      || profile.dialogue_available !== true
      || repo.archived
      || active.repo !== profile.repo
      || active.path !== profile.path
      || active.profile_digest !== profile.digest
      || active.authority_digest !== profile.authority_digest) continue;
    const ageDays = repositoryAgeDays(repo, reference);
    if (ageDays === null || ageDays < REPO_NEWCOMER_DAYS) continue;
    eligible.push({
      residentId: active.resident_id,
      repo: active.repo,
      slug: active.slug,
      createdOn: new Date(reference - ageDays * 86400000).toISOString().slice(0, 10),
      ageDays,
    });
  }
  eligible.sort((a, b) => a.createdOn.localeCompare(b.createdOn)
    || a.slug.localeCompare(b.slug)
    || a.residentId.localeCompare(b.residentId));
  if (!eligible.length) return emptyAllocation('no_eligible_residents');

  const elderCount = Math.min(eligible.length, Math.max(1, Math.ceil(eligible.length * 0.2)));
  const elders = eligible.slice(0, elderCount);
  const seed = `${cityState.last_sap_flow || cityState.era?.as_of || ''}|${validManifest.registry_digest}`;
  const orderedFragments = validLore.fragments.slice().sort((a, b) =>
    stableLoreHash(`${seed}|${a.id}`) - stableLoreHash(`${seed}|${b.id}`)
    || a.id.localeCompare(b.id));
  const start = stableLoreHash(seed) % elderCount;
  const mutable = Object.fromEntries(elders.map(elder => [elder.residentId, []]));
  orderedFragments.forEach((fragment, index) => {
    const elder = elders[(start + index) % elderCount];
    mutable[elder.residentId].push(fragment);
  });
  const assignments = Object.freeze(Object.fromEntries(
    Object.entries(mutable).map(([id, fragments]) => [id, Object.freeze(fragments.slice())]),
  ));
  return Object.freeze({
    reason: null,
    eligibleCount: eligible.length,
    elderCount,
    fragmentCount: orderedFragments.length,
    elders: Object.freeze(elders.map(elder => Object.freeze({
      ...elder,
      fragmentCount: assignments[elder.residentId].length,
      fragmentIds: Object.freeze(assignments[elder.residentId].map(fragment => fragment.id)),
    }))),
    assignments,
  });
}

export function createLoreDeliveryState({
  allocation,
  seed = '',
  limits = {},
  debug = false,
} = {}) {
  const policy = Object.freeze({ ...LORE_DELIVERY_LIMITS, ...limits });
  const assignments = allocation?.assignments || {};
  const residentIds = Object.keys(assignments).sort();
  const seenIds = new Set(), seenVariants = new Set(), residentCounts = new Map(), contextCounts = new Map();
  let total = 0, startedAt = null, nextAttemptAt = 0, lastDeliveredAt = Number.NEGATIVE_INFINITY, attempts = 0;

  function snapshot() {
    return {
      total,
      seen: [...seenIds],
      residentCounts: Object.fromEntries(residentCounts),
      contextCounts: Object.fromEntries(contextCounts),
      nextAttemptAt,
      debug,
    };
  }

  function next({
    residentId,
    contexts = [],
    now = 0,
    quiet = true,
    random = Math.random,
    force = false,
  } = {}) {
    const assigned = assignments[residentId] || [];
    const activeContexts = [...new Set((Array.isArray(contexts) ? contexts : [contexts])
      .filter(context => SAFE_CONTEXTS.has(context)))];
    if (!assigned.length || !activeContexts.length || !quiet) return null;
    if (startedAt === null) startedAt = now;
    const residentCount = residentCounts.get(residentId) || 0;
    if (total >= policy.session || residentCount >= policy.perResident) return null;
    if (!force) {
      if (now - startedAt < policy.initialDelaySeconds
        || now < nextAttemptAt
        || now - lastDeliveredAt < policy.cooldownSeconds) return null;
      const slot = Math.floor(now / Math.max(1, policy.attemptIntervalSeconds));
      const scheduled = residentIds[stableLoreHash(`${seed}|${slot}`) % Math.max(1, residentIds.length)];
      if (scheduled !== residentId) return null;
      nextAttemptAt = now + policy.attemptIntervalSeconds;
      if (!(Number(random()) < policy.chance)) return null;
    } else if (!debug) {
      return null;
    }
    const candidates = assigned.filter(fragment =>
      !seenIds.has(fragment.id)
      && (!fragment.variant_group || !seenVariants.has(fragment.variant_group))
      && fragment.contexts.some(context =>
        activeContexts.includes(context) && (contextCounts.get(context) || 0) < policy.perContext));
    if (!candidates.length) return null;
    const ordered = candidates.slice().sort((a, b) =>
      stableLoreHash(`${seed}|${residentId}|${activeContexts.join('|')}|${attempts}|${a.id}`)
        - stableLoreHash(`${seed}|${residentId}|${activeContexts.join('|')}|${attempts}|${b.id}`)
      || a.id.localeCompare(b.id));
    attempts += 1;
    const fragment = ordered[0];
    const context = fragment.contexts.find(item =>
      activeContexts.includes(item) && (contextCounts.get(item) || 0) < policy.perContext);
    seenIds.add(fragment.id);
    if (fragment.variant_group) seenVariants.add(fragment.variant_group);
    residentCounts.set(residentId, residentCount + 1);
    contextCounts.set(context, (contextCounts.get(context) || 0) + 1);
    total += 1;
    lastDeliveredAt = now;
    nextAttemptAt = Math.max(nextAttemptAt, now + policy.cooldownSeconds);
    return Object.freeze({ fragment, context, total });
  }

  return Object.freeze({ next, snapshot });
}
