import { createHash } from 'crypto';
import {
  bindResidentSlots,
  createResidentProfileStore,
  loadResidentManifest,
  residentLocalResponse,
  residentNewcomerLine,
  validateResidentManifest,
} from '../assets/resident-profiles.js';

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function response(body, ok = true) {
  return { ok, text: async () => body };
}

export async function runResidentRuntimeTests(check) {
  const profile = {
    schema: 'repolis.resident-profile',
    version: 1,
    generated_at: '2026-08-24T00:00:00Z',
    repo: {
      owner: 'example',
      name: 'alpha-lab',
      slug: 'alpha-lab',
      url: 'https://github.com/example/alpha-lab',
      summary: 'A bounded public workshop.',
      language: 'Python',
      topics: ['ai'],
    },
    age: { created_on: '2020-01-01', days: 2428, years: 6.65, basis: 'public_repository_created_at' },
    job: { key: 'model_smith', labels: { ko: 'AI 모델 장인', en: 'AI model smith' } },
    personality: { key: 'steady_maintainer', labels: { ko: '꾸준한 유지보수자', en: 'steady maintainer' } },
    recent_concerns: [{
      kind: 'issue',
      title: 'Improve retry handling',
      url: 'https://github.com/example/alpha-lab/issues/7',
      occurred_at: '2026-08-22T00:00:00Z',
      number: 7,
    }],
    bound_memories: [{
      kind: 'release',
      title: 'v1.2.0',
      url: 'https://github.com/example/alpha-lab/releases/tag/v1.2.0',
      occurred_at: '2026-08-20T00:00:00Z',
    }],
    shared: { city_state: { schema: 'repolis.city-state', version: 1, season: 'spring' } },
    archived: false,
    dialogue_available: true,
    provenance: { repository_visibility: 'public' },
  };
  const profileText = JSON.stringify(profile) + '\n';
  const alphaDigest = digest(profileText);
  const betaDigest = 'b'.repeat(64);
  const manifest = {
    schema: 'repolis.resident-manifest',
    version: 1,
    generated_at: '2026-08-24T00:00:00Z',
    owner: 'example',
    profile_schema: 'repolis.resident-profile',
    profile_version: 1,
    profile_count: 2,
    active_count: 1,
    registry_digest: 'a'.repeat(64),
    profiles: [
      {
        repo: 'alpha-lab', slug: 'alpha-lab', path: 'data/residents/alpha-lab.json',
        digest: alphaDigest, authority_digest: 'c'.repeat(64), archived: false, dialogue_available: true,
        job_key: 'model_smith', job_color: '#8faef5', job_prop: 'orb',
      },
      {
        repo: 'beta-house', slug: 'beta-house', path: 'data/residents/beta-house.json',
        digest: betaDigest, authority_digest: 'd'.repeat(64), archived: false, dialogue_available: true,
        job_key: 'repo_steward', job_color: '#d7af62', job_prop: 'badge',
      },
    ],
    active_roster: [{
      resident_id: 'sol',
      name: { ko: '솔', en: 'Sol' },
      repo: 'alpha-lab',
      slug: 'alpha-lab',
      path: 'data/residents/alpha-lab.json',
      profile_digest: alphaDigest,
      authority_digest: 'c'.repeat(64),
      job_key: 'model_smith',
      job_color: '#8faef5',
      job_prop: 'orb',
    }],
  };
  const manifestText = JSON.stringify(manifest);
  let fetches = 0;
  const fetchImpl = async (url) => {
    fetches += 1;
    if (url === 'data/residents/index.json') return response(manifestText);
    if (url === 'data/residents/alpha-lab.json') return response(profileText);
    return response('', false);
  };
  const loaded = await loadResidentManifest({ fetchImpl, owner: 'example' });
  check(loaded.owner === manifest.owner && loaded.registry_digest === manifest.registry_digest && fetches === 1,
    'resident boot fetches only the bounded manifest and validates its owner/schema contract');

  const slots = [{ id: 'sol', color: 0, ko: { name: '솔' }, en: { name: 'Sol' } }];
  const repos = [
    { repo: 'alpha-lab', rank: 0, archived: false, desc: 'A bounded public workshop.' },
    { repo: 'beta-house', rank: 1, archived: false },
  ];
  const roster = bindResidentSlots(slots, loaded, repos);
  check(roster.generated && roster.activeCount === 1
    && slots[0].bound.repo === 'alpha-lab'
    && slots[0].bound.repoRecord === repos[0]
    && slots[0].color === 0x8faef5
    && fetches === 1,
  'the bounded active roster reuses existing resident slots, binds a real repo building, and adds no detail fetch');

  const store = createResidentProfileStore({ manifest: loaded, fetchImpl });
  check(store.cached('sol') === null && fetches === 1,
    'profile details stay lazy until an explicit resident interaction');
  const loadedProfile = await store.load('sol');
  await store.load('sol');
  check(loadedProfile.repo.name === 'alpha-lab' && fetches === 2 && store.cached('sol') === loadedProfile,
    'explicit interaction hash-validates one profile and caches it without repeat transfer');

  const own = residentLocalResponse({
    resident: slots[0], profile: loadedProfile, question: 'release memory?', lang: 'en', manifest: loaded,
  });
  const cross = residentLocalResponse({
    resident: slots[0], profile: loadedProfile, question: 'Tell me beta-house bound memory', lang: 'en', manifest: loaded,
  });
  check(own.intent === 'own_bound_memory' && own.text.includes('v1.2.0')
    && cross.intent === 'cross_resident_redirect'
    && cross.targetRepo === 'beta-house'
    && !cross.text.includes('v1.2.0'),
  'local fallback answers only the selected resident memory and redirects cross-resident Bound questions');

  const newcomerProfile = {
    ...loadedProfile,
    age: { ...loadedProfile.age, days: 89, years: 0.24 },
  };
  const newcomer = residentLocalResponse({
    resident: slots[0], profile: newcomerProfile, question: 'hello', lang: 'en', manifest: loaded,
  });
  const newcomerAlt = residentNewcomerLine({
    resident: slots[0], profile: newcomerProfile, lang: 'ko', variant: 2,
  });
  check(newcomer.intent === 'newcomer_introduction'
    && newcomer.targetRepo === 'alpha-lab'
    && !/World Tree|세계수/i.test(newcomer.text + newcomerAlt)
    && newcomer.text.length <= 180
    && newcomerAlt.length <= 180,
  'young residents use a short local newcomer voice without claiming old-world lore');

  let drifted = true;
  const retryStore = createResidentProfileStore({
    manifest: loaded,
    fetchImpl: async () => response(drifted ? profileText + ' ' : profileText),
  });
  let driftReason = '';
  try {
    await retryStore.load('sol');
  } catch (error) {
    driftReason = error.message;
  }
  drifted = false;
  const retried = await retryStore.retry('sol');
  check(driftReason === 'resident_profile_drift' && retried.repo.name === 'alpha-lab',
    'stale profile bytes fail soft and the explicit retry path can recover');

  const archivedOnly = bindResidentSlots(
    [{ id: 'sol', color: 1 }],
    null,
    [{ repo: 'sleeping', rank: 0, archived: true }],
  );
  check(archivedOnly.activeCount === 0,
    'archived repositories never enter the active 3D roster even when no generated manifest is available');
  check(validateResidentManifest({ ...manifest, version: 99 }, 'example') === null,
    'profile schema/version mismatch selects the static fail-soft path');
}
