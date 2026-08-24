export const RESIDENT_PROFILE_SCHEMA = 'repolis.resident-profile';
export const RESIDENT_PROFILE_VERSION = 1;
export const RESIDENT_MANIFEST_SCHEMA = 'repolis.resident-manifest';
export const RESIDENT_MANIFEST_VERSION = 1;
export const RESIDENT_PROFILE_MAX_BYTES = 12000;
export const RESIDENT_MANIFEST_MAX_BYTES = 64000;

const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$/;
const SAFE_DIGEST = /^[a-f0-9]{64}$/;
const SAFE_RESIDENT_ID = /^[a-z][a-z0-9_-]{0,31}$/;
const SAFE_PATH = /^data\/residents\/([a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?)\.json$/;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function textBytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function validProfileEntry(entry) {
  const item = record(entry);
  const match = item && SAFE_PATH.exec(String(item.path || ''));
  return !!item
    && SAFE_SLUG.test(String(item.slug || ''))
    && match?.[1] === item.slug
    && typeof item.repo === 'string'
    && item.repo.length > 0
    && item.repo.length <= 100
    && SAFE_DIGEST.test(String(item.digest || ''))
    && SAFE_DIGEST.test(String(item.authority_digest || ''))
    && typeof item.archived === 'boolean'
    && typeof item.dialogue_available === 'boolean'
    && item.dialogue_available === !item.archived;
}

export function validateResidentManifest(value, owner = '') {
  const manifest = record(value);
  if (!manifest
    || manifest.schema !== RESIDENT_MANIFEST_SCHEMA
    || manifest.version !== RESIDENT_MANIFEST_VERSION
    || (owner && String(manifest.owner || '').toLowerCase() !== String(owner).toLowerCase())
    || manifest.profile_schema !== RESIDENT_PROFILE_SCHEMA
    || manifest.profile_version !== RESIDENT_PROFILE_VERSION
    || !SAFE_DIGEST.test(String(manifest.registry_digest || ''))
    || !Array.isArray(manifest.profiles)
    || !Array.isArray(manifest.active_roster)
    || manifest.profiles.length !== manifest.profile_count
    || manifest.active_roster.length !== manifest.active_count
    || manifest.active_roster.length > 9
    || !manifest.profiles.every(validProfileEntry)) return null;
  const profiles = new Map();
  for (const entry of manifest.profiles) {
    const repoKey = entry.repo.toLowerCase();
    if (profiles.has(entry.slug) || [...profiles.values()].some(item => item.repo.toLowerCase() === repoKey)) return null;
    profiles.set(entry.slug, entry);
  }
  const residentIds = new Set();
  for (const active of manifest.active_roster) {
    const entry = record(active), profile = entry && profiles.get(entry.slug);
    if (!entry
      || !SAFE_RESIDENT_ID.test(String(entry.resident_id || ''))
      || residentIds.has(entry.resident_id)
      || !profile
      || profile.archived
      || entry.repo !== profile.repo
      || entry.path !== profile.path
      || entry.profile_digest !== profile.digest
      || entry.authority_digest !== profile.authority_digest
      || !/^#[a-f0-9]{6}$/i.test(String(entry.job_color || ''))) return null;
    residentIds.add(entry.resident_id);
  }
  return manifest;
}

export function validateResidentProfile(value, entry) {
  const profile = record(value), repo = record(profile?.repo);
  if (!profile
    || profile.schema !== RESIDENT_PROFILE_SCHEMA
    || profile.version !== RESIDENT_PROFILE_VERSION
    || !repo
    || repo.slug !== entry?.slug
    || repo.name !== entry?.repo
    || profile.archived !== entry?.archived
    || profile.dialogue_available !== entry?.dialogue_available
    || profile.dialogue_available !== !profile.archived
    || !Array.isArray(profile.recent_concerns)
    || profile.recent_concerns.length > 3
    || !Array.isArray(profile.bound_memories)
    || profile.bound_memories.length > 4
    || !record(profile.age)
    || !record(profile.job)
    || !record(profile.personality)
    || !record(profile.shared)) return null;
  return profile;
}

async function digestHex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('resident_digest_unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadResidentManifest({
  fetchImpl = globalThis.fetch,
  url = 'data/residents/index.json',
  owner = '',
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('resident_manifest_fetch_unavailable');
  const response = await fetchImpl(url, { cache: 'no-cache' });
  if (!response?.ok) throw new Error('resident_manifest_unavailable');
  const source = await response.text();
  if (textBytes(source) > RESIDENT_MANIFEST_MAX_BYTES) throw new Error('resident_manifest_oversized');
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('resident_manifest_malformed');
  }
  const manifest = validateResidentManifest(parsed, owner);
  if (!manifest) throw new Error('resident_manifest_unsupported');
  return manifest;
}

export function bindResidentSlots(slots, manifest, repositories) {
  const available = (Array.isArray(repositories) ? repositories : [])
    .filter(repo => repo && repo.repo && !repo.archived)
    .slice()
    .sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0)
      || String(a.repo).localeCompare(String(b.repo)));
  const repoMap = new Map(available.map(repo => [String(repo.repo).toLowerCase(), repo]));
  const profiles = new Map((manifest?.profiles || []).map(entry => [entry.slug, entry]));
  const activeById = new Map((manifest?.active_roster || []).map(entry => [entry.resident_id, entry]));
  const used = new Set();
  const bound = [];
  for (let index = 0; index < (slots || []).length; index += 1) {
    const resident = slots[index];
    const generated = activeById.get(resident.id);
    const fallbackRepo = available.find(repo => !used.has(String(repo.repo).toLowerCase()));
    const repo = generated
      ? repoMap.get(String(generated.repo).toLowerCase())
      : fallbackRepo;
    const profile = generated && profiles.get(generated.slug);
    if (!repo || repo.archived || (generated && (!profile || profile.archived))) {
      resident.bound = null;
      continue;
    }
    used.add(String(repo.repo).toLowerCase());
    resident.bound = generated ? {
      residentId: generated.resident_id,
      repo: generated.repo,
      slug: generated.slug,
      path: generated.path,
      profileDigest: generated.profile_digest,
      authorityDigest: generated.authority_digest,
      jobKey: generated.job_key,
      jobColor: generated.job_color,
      jobProp: generated.job_prop,
      generated: true,
      repoRecord: repo,
    } : {
      residentId: resident.id,
      repo: repo.repo,
      slug: String(repo.repo).toLowerCase().replace(/[^a-z0-9._-]+/g, '-'),
      path: null,
      profileDigest: null,
      authorityDigest: null,
      jobKey: 'repo_steward',
      jobColor: '#' + Number(resident.color || 0xd7af62).toString(16).padStart(6, '0'),
      jobProp: 'badge',
      generated: false,
      repoRecord: repo,
    };
    if (/^#[a-f0-9]{6}$/i.test(resident.bound.jobColor)) {
      resident.color = Number.parseInt(resident.bound.jobColor.slice(1), 16);
    }
    bound.push(resident);
  }
  return Object.freeze({
    residents: bound,
    generated: !!manifest,
    activeCount: bound.length,
    profileCount: manifest?.profile_count || available.length,
  });
}

export function createResidentProfileStore({
  manifest,
  fetchImpl = globalThis.fetch,
} = {}) {
  const validManifest = validateResidentManifest(manifest);
  const entries = new Map((validManifest?.active_roster || []).map(entry => [entry.resident_id, entry]));
  const values = new Map();
  const pending = new Map();

  async function load(residentId) {
    const id = String(residentId || '');
    if (values.has(id)) return values.get(id);
    if (pending.has(id)) return pending.get(id);
    const entry = entries.get(id);
    if (!entry) throw new Error('resident_profile_unavailable');
    const task = (async () => {
      const response = await fetchImpl(entry.path, { cache: 'no-cache' });
      if (!response?.ok) throw new Error('resident_profile_unavailable');
      const source = await response.text();
      if (textBytes(source) > RESIDENT_PROFILE_MAX_BYTES) throw new Error('resident_profile_oversized');
      const digest = await digestHex(source);
      if (digest !== entry.profile_digest) throw new Error('resident_profile_drift');
      let parsed;
      try {
        parsed = JSON.parse(source);
      } catch {
        throw new Error('resident_profile_malformed');
      }
      const profileEntry = (validManifest.profiles || []).find(item => item.slug === entry.slug);
      const profile = validateResidentProfile(parsed, profileEntry);
      if (!profile) throw new Error('resident_profile_unsupported');
      values.set(id, profile);
      return profile;
    })();
    pending.set(id, task);
    try {
      return await task;
    } finally {
      pending.delete(id);
    }
  }

  return Object.freeze({
    manifest: validManifest,
    entryFor: residentId => entries.get(String(residentId || '')) || null,
    cached: residentId => values.get(String(residentId || '')) || null,
    load,
    retry(residentId) {
      const id = String(residentId || '');
      values.delete(id);
      pending.delete(id);
      return load(id);
    },
  });
}

function mentionedProfile(question, manifest) {
  const source = String(question || '').toLowerCase();
  if (!source) return null;
  return (manifest?.profiles || [])
    .slice()
    .sort((a, b) => b.repo.length - a.repo.length)
    .find(entry => source.includes(String(entry.repo).toLowerCase())) || null;
}

function cap(value, max = 220) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 1);
  const boundary = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf(' '));
  return clipped.slice(0, boundary > max * 0.6 ? boundary : max - 1).trim() + '\u2026';
}

export function isResidentNewcomer(resident, profile) {
  if (profile?.archived || resident?.bound?.repoRecord?.archived) return false;
  if (Number.isFinite(profile?.age?.days)) return profile.age.days < 90;
  return resident?.bound?.repoRecord?._newcomer === true;
}

export function residentNewcomerLine({
  resident,
  profile,
  lang = 'ko',
  variant = 0,
} = {}) {
  if (!isResidentNewcomer(resident, profile)) return '';
  const repo = resident?.bound?.repo || profile?.repo?.name || '';
  const ko = lang !== 'en';
  const bank = ko ? [
    `아직 ${repo} 집의 상자도 다 못 풀었어요. 길은 조금 헷갈리지만 천천히 익히는 중이에요.`,
    `새 간판이 아직 낯설어요. ${repo}에서 하나씩 배워 가고 있어요.`,
    `${repo}에 온 지 얼마 안 됐어요. 아는 길보다 모르는 골목이 더 많네요.`,
  ] : [
    `I still have boxes unopened at ${repo}. The roads confuse me a little, but I am learning them.`,
    `The new sign still feels unfamiliar. I am learning ${repo} one corner at a time.`,
    `I have not been at ${repo} long. There are still more unknown lanes than familiar ones.`,
  ];
  return cap(bank[Math.abs(Number(variant) || 0) % bank.length], 180);
}

export function residentLocalResponse({
  resident,
  profile,
  question,
  lang = 'ko',
  manifest,
} = {}) {
  const ko = lang !== 'en', bound = resident?.bound, repo = bound?.repoRecord;
  if (!bound || !repo) {
    return { intent: 'unavailable', text: ko ? '\uc774 \ub3c4\uc2dc\uc5d0\uc120 \uc544\uc9c1 \uc81c \uc9d1\uc774 \uc815\ud574\uc9c0\uc9c0 \uc54a\uc558\uc5b4\uc694.' : 'My home has not been assigned in this town yet.' };
  }
  if (profile?.archived || repo.archived) {
    return { intent: 'archived', text: ko ? `${bound.repo}\uc758 \uae30\ub85d\uc740 \uba85\ud328\uc640 \ubfcc\ub9ac\uc5d0 \ub0a8\uc544 \uc788\uc9c0\ub9cc, \uc9c0\uae08\uc740 \uc7a0\ub4e0 \uc9d1\uc774\uc5d0\uc694.` : `${bound.repo} remains in its nameplate and the Roots, but the house is asleep now.` };
  }
  const target = mentionedProfile(question, manifest);
  if (target && target.repo.toLowerCase() !== bound.repo.toLowerCase()) {
    return {
      intent: 'cross_resident_redirect',
      targetRepo: target.repo,
      text: ko
        ? `${target.repo}\uc758 \ubb36\uc778 \uae30\uc5b5\uc740 \uc81c\uac00 \ub300\uc2e0 \ub9d0\ud560 \uc218 \uc5c6\uc5b4\uc694. \uadf8 \uc9d1\uc73c\ub85c \uac00\uba74 \ub2f4\ub2f9 \uc8fc\ubbfc\uc744 \ub9cc\ub0a0 \uc218 \uc788\uc5b4\uc694.`
        : `I cannot speak for ${target.repo}'s Bound memory. Visit that house to meet its resident.`,
    };
  }
  const q = String(question || '').toLowerCase();
  const name = (resident?.[ko ? 'ko' : 'en'] || resident?.en || resident?.ko || {}).name || resident?.id;
  const job = profile?.job?.labels?.[ko ? 'ko' : 'en'];
  const summary = profile?.repo?.summary || repo.desc || '';
  const concern = profile?.recent_concerns?.[0];
  const memory = profile?.bound_memories?.[0];
  if (/(issue|pull request|pr\b|concern|worry|\uc774\uc288|\ud480\s*\ub9ac\ud018\uc2a4\ud2b8|\uace0\ubbfc)/i.test(q) && concern) {
    return { intent: 'own_concern', text: cap(ko ? `\uc694\uc998 ${bound.repo} \uc9d1\uc5d0\uc11c\ub294 \u201c${concern.title}\u201d\uc744 \uc0b4\ud3b4\ubcf4\uace0 \uc788\uc5b4\uc694.` : `Around ${bound.repo}, I have been watching \u201c${concern.title}.\u201d`) };
  }
  if (/(commit|release|history|memory|\ucee4\ubc0b|\ub9b4\ub9ac\uc2a4|\uc5ed\uc0ac|\uae30\uc5b5)/i.test(q) && memory) {
    return { intent: 'own_bound_memory', text: cap(ko ? `${bound.repo}\uc5d0 \ubb36\uc778 \uae30\uc5b5 \ud558\ub098\ub294 \u201c${memory.title}\u201d\uc774\uc5d0\uc694.` : `One Bound memory from ${bound.repo} is \u201c${memory.title}.\u201d`) };
  }
  if (/(where|home|house|direction|\uc5b4\ub514|\uc9d1|\uac74\ubb3c|\uae38)/i.test(q)) {
    return {
      intent: 'home_direction',
      targetRepo: bound.repo,
      text: ko ? `\uc81c\uac00 \ubb36\uc778 \uc9d1\uc740 ${bound.repo}\uc608\uc694. \uc774 \ub300\ud654\uc5d0\uc11c \ubc14\ub85c \uc548\ub0b4\ud560\uac8c\uc694.` : `My bound home is ${bound.repo}. I can guide you straight there.`,
    };
  }
  const newcomer = residentNewcomerLine({
    resident,
    profile,
    lang,
    variant: String(resident?.id || '').length,
  });
  if (newcomer) {
    return { intent: 'newcomer_introduction', targetRepo: bound.repo, text: newcomer };
  }
  return {
    intent: 'introduction',
    targetRepo: bound.repo,
    text: cap(ko
      ? `\uc800\ub294 ${name}, ${bound.repo}\uc5d0 \ubb36\uc778 ${job || '\ub808\ud3ec \uad00\ub9ac\uc778'}\uc774\uc5d0\uc694.${summary ? ` ${summary}` : ''}`
      : `I am ${name}, ${job || 'a repository steward'} bound to ${bound.repo}.${summary ? ` ${summary}` : ''}`),
  };
}
