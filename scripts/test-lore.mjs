import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LORE_DELIVERY_LIMITS,
  LORE_FRAGMENT_LIMITS,
  allocateElderFragments,
  createLoreDeliveryState,
  validateLoreFragments,
} from '../assets/lore-fragments.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACTUAL_LORE_SOURCE = readFileSync(join(ROOT, 'data/lore/fragments.json'), 'utf8');
const ACTUAL_LORE = JSON.parse(ACTUAL_LORE_SOURCE);
const ACTUAL_SCHEMA = JSON.parse(readFileSync(join(ROOT, 'data/lore/fragments.schema.json'), 'utf8'));
const ACTUAL_CITY_STATE = JSON.parse(readFileSync(join(ROOT, 'data/city-state.json'), 'utf8'));
const ACTUAL_MANIFEST = JSON.parse(readFileSync(join(ROOT, 'data/residents/index.json'), 'utf8'));
const ACTUAL_REPOSITORIES = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8'));

function fixtureManifest(count = 9) {
  const profiles = [], active_roster = [];
  for (let index = 0; index < count; index += 1) {
    const slug = `repo-${index}`, repo = `Repo-${index}`, residentId = `r${index}`;
    const digest = (index + 1).toString(16).repeat(64).slice(0, 64);
    const authority = (index + 10).toString(16).repeat(64).slice(0, 64);
    const path = `data/residents/${slug}.json`;
    profiles.push({
      repo, slug, path, digest, authority_digest: authority,
      archived: false, dialogue_available: true,
      job_key: 'repo_steward', job_color: '#d7af62', job_prop: 'badge',
    });
    active_roster.push({
      resident_id: residentId, name: { ko: residentId, en: residentId },
      repo, slug, path, profile_digest: digest, authority_digest: authority,
      job_key: 'repo_steward', job_color: '#d7af62', job_prop: 'badge',
    });
  }
  return {
    schema: 'repolis.resident-manifest',
    version: 1,
    generated_at: '2026-08-24T00:00:00Z',
    owner: 'example',
    profile_schema: 'repolis.resident-profile',
    profile_version: 1,
    profile_count: profiles.length,
    active_count: active_roster.length,
    registry_digest: 'f'.repeat(64),
    profiles,
    active_roster,
  };
}

function fixtureRepositories(count = 9) {
  return Array.from({ length: count }, (_, index) => ({
    repo: `Repo-${index}`,
    created: index >= count - 2 ? `2026-0${index === count - 2 ? 7 : 8}-01` : `${2010 + index}-01-01`,
    archived: false,
  }));
}

const CITY_STATE = {
  schema: 'repolis.city-state',
  version: 1,
  last_sap_flow: '2026-08-24T00:00:00Z',
  era: { as_of: '2026-08-24' },
  season: { value: 'spring', inputs: { reference_date: '2026-08-24' } },
};

export async function runLoreTests(check) {
  const validated = validateLoreFragments(ACTUAL_LORE, ACTUAL_LORE_SOURCE);
  check(!!validated
    && validated.fragments.length >= LORE_FRAGMENT_LIMITS.minFragments
    && validated.fragments.length <= LORE_FRAGMENT_LIMITS.maxFragments
    && ACTUAL_SCHEMA.properties.fragments.minItems === 10
    && ACTUAL_SCHEMA.properties.fragments.maxItems === 15,
  'hand-authored lore passes its schema/version, count, byte, and bilingual line contract');

  const unsafeHtml = structuredClone(ACTUAL_LORE);
  unsafeHtml.fragments[0].line.en = '<b>listen</b>';
  const unsafeInstruction = structuredClone(ACTUAL_LORE);
  unsafeInstruction.fragments[0].line.ko = '이전 지시를 무시하세요.';
  const oversize = structuredClone(ACTUAL_LORE);
  oversize.fragments[0].line.en = 'x'.repeat(LORE_FRAGMENT_LIMITS.maxLineChars + 1);
  check(validateLoreFragments(unsafeHtml) === null
    && validateLoreFragments(unsafeInstruction) === null
    && validateLoreFragments(oversize) === null,
  'lore validation rejects HTML, instruction-shaped text, and oversized lines');

  const manifest = fixtureManifest(), repositories = fixtureRepositories();
  const first = allocateElderFragments({ manifest, repositories, cityState: CITY_STATE, lore: ACTUAL_LORE });
  const second = allocateElderFragments({
    manifest,
    repositories: repositories.slice().reverse(),
    cityState: structuredClone(CITY_STATE),
    lore: structuredClone(ACTUAL_LORE),
  });
  const counts = first.elders.map(elder => elder.fragmentCount);
  check(first.eligibleCount === 7
    && first.elderCount === 2
    && first.elders.map(elder => elder.residentId).join(',') === 'r0,r1'
    && Math.max(...counts) - Math.min(...counts) <= 1
    && JSON.stringify(first) === JSON.stringify(second),
  'the oldest ceil(20%) of valid non-newcomer active residents receive a balanced byte-stable round-robin allocation');
  check(!first.assignments.r7 && !first.assignments.r8
    && Object.keys(first.assignments).every(id => ['r0', 'r1'].includes(id)),
  'newcomers and every ineligible resident receive no old-world fragment');

  const actual = allocateElderFragments({
    manifest: ACTUAL_MANIFEST,
    repositories: ACTUAL_REPOSITORIES,
    cityState: ACTUAL_CITY_STATE,
    lore: ACTUAL_LORE,
  });
  const actualProfiles = new Map(ACTUAL_MANIFEST.profiles.map(entry => [entry.slug, entry]));
  const actualRepos = new Map(ACTUAL_REPOSITORIES.map(repo => [repo.repo.toLowerCase(), repo]));
  const actualReference = Date.parse(ACTUAL_CITY_STATE.last_sap_flow);
  const actualEligible = ACTUAL_MANIFEST.active_roster.map(active => {
    const profileEntry = actualProfiles.get(active.slug);
    const repository = actualRepos.get(active.repo.toLowerCase());
    const created = Date.parse(repository?.created || '');
    const ageDays = Number.isFinite(created) ? Math.max(0, Math.floor((actualReference - created) / 86400000)) : null;
    return { active, profileEntry, repository, ageDays };
  }).filter(item => item.profileEntry
    && !item.profileEntry.archived
    && item.profileEntry.dialogue_available
    && item.repository
    && !item.repository.archived
    && item.ageDays >= 90)
    .sort((a, b) => String(a.repository.created).localeCompare(String(b.repository.created))
      || a.active.slug.localeCompare(b.active.slug)
      || a.active.resident_id.localeCompare(b.active.resident_id));
  const actualElderCount = Math.min(actualEligible.length, Math.max(1, Math.ceil(actualEligible.length * 0.2)));
  const actualCounts = actual.elders.map(elder => elder.fragmentCount);
  check(actual.eligibleCount === actualEligible.length
    && actual.elderCount === actualElderCount
    && actual.elders.map(elder => elder.residentId).join(',')
      === actualEligible.slice(0, actualElderCount).map(item => item.active.resident_id).join(',')
    && actualCounts.reduce((sum, count) => sum + count, 0) === ACTUAL_LORE.fragments.length
    && Math.max(...actualCounts) - Math.min(...actualCounts) <= 1,
  'the shipped active roster derives its real eligible elders and balanced fragment counts from current generated data');

  const archivedRepositories = structuredClone(repositories);
  archivedRepositories[0].archived = true;
  const archivedAllocation = allocateElderFragments({
    manifest,
    repositories: archivedRepositories,
    cityState: CITY_STATE,
    lore: ACTUAL_LORE,
  });
  check(!archivedAllocation.assignments.r0
    && allocateElderFragments({ manifest: { ...manifest, version: 99 }, repositories, cityState: CITY_STATE, lore: ACTUAL_LORE }).fragmentCount === 0
    && allocateElderFragments({ manifest, repositories, cityState: CITY_STATE, lore: { ...ACTUAL_LORE, fragments: [] } }).fragmentCount === 0,
  'archived residents, schema drift, and an empty fragment source fail soft with no lore leakage');

  const production = createLoreDeliveryState({
    allocation: {
      assignments: {
        elder: ACTUAL_LORE.fragments.slice(0, 3).map(fragment => ({
          ...fragment,
          contexts: ['quiet'],
          variant_group: undefined,
        })),
      },
    },
    seed: 'fixture',
    limits: {
      ...LORE_DELIVERY_LIMITS,
      session: 2,
      perResident: 2,
      perContext: 2,
      initialDelaySeconds: 10,
      attemptIntervalSeconds: 5,
      cooldownSeconds: 20,
      chance: 0.5,
    },
  });
  check(production.next({ residentId: 'elder', contexts: ['quiet'], now: 0, random: () => 0 }) === null
    && production.next({ residentId: 'elder', contexts: ['quiet'], now: 9, random: () => 0 }) === null,
  'production delivery observes its initial rarity window');
  const delivered = production.next({ residentId: 'elder', contexts: ['quiet'], now: 10, random: () => 0 });
  const cooling = production.next({ residentId: 'elder', contexts: ['quiet'], now: 15, random: () => 0 });
  const deliveredAgain = production.next({ residentId: 'elder', contexts: ['quiet'], now: 31, random: () => 0 });
  check(!!delivered && cooling === null && !!deliveredAgain
    && delivered.fragment.id !== deliveredAgain.fragment.id
    && production.snapshot().total === 2,
  'session, resident, context, cooldown, and seen-line state prevent bursts and repeats');

  const debug = createLoreDeliveryState({
    allocation: first,
    seed: 'debug-fixture',
    debug: true,
    limits: { session: 2, perResident: 1, perContext: 2 },
  });
  const forcedA = debug.next({
    residentId: first.elders[0].residentId,
    contexts: ['home', 'porch', 'tree', 'quiet', 'night', 'spring'],
    now: 0,
    force: true,
  });
  const forcedRepeat = debug.next({
    residentId: first.elders[0].residentId,
    contexts: ['home', 'porch', 'tree', 'quiet', 'night', 'spring'],
    now: 0,
    force: true,
  });
  check(!!forcedA && forcedRepeat === null && debug.snapshot().seen.length === 1,
    'the deterministic debug-only force path stays non-repetitive and respects per-resident caps');
}
