const MIN_GITHUB_YEAR = 2008;
const MAX_SAFE_YEAR = 2100;

function cleanText(value, limit = 120) {
  return String(value || '').trim().slice(0, limit);
}

function creationPoint(value) {
  const raw = cleanText(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;
  const year = new Date(timestamp).getUTCFullYear();
  return year >= MIN_GITHUB_YEAR && year <= MAX_SAFE_YEAR
    ? Object.freeze({ timestamp, year, date: raw.slice(0, 10) })
    : null;
}

export function buildTownGrowthTimeline(repos = []) {
  const unique = new Map();
  for (const item of Array.isArray(repos) ? repos : []) {
    const repo = cleanText(item?.repo);
    if (!repo) continue;
    const key = repo.toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
  }

  const entries = [];
  let unknownCount = 0;
  for (const item of unique.values()) {
    const point = creationPoint(item?.created);
    if (!point) {
      unknownCount++;
      continue;
    }
    entries.push(Object.freeze({
      repo: cleanText(item.repo),
      lang: cleanText(item.lang || 'Other', 60) || 'Other',
      date: point.date,
      year: point.year,
      timestamp: point.timestamp
    }));
  }
  entries.sort((a, b) => a.timestamp - b.timestamp || a.repo.localeCompare(b.repo));

  const milestones = [];
  const languages = new Set();
  for (let offset = 0; offset < entries.length;) {
    const year = entries[offset].year;
    const added = [];
    while (offset < entries.length && entries[offset].year === year) {
      added.push(entries[offset]);
      languages.add(entries[offset].lang);
      offset++;
    }
    milestones.push(Object.freeze({
      year,
      total: offset,
      languageCount: languages.size,
      added: Object.freeze(added.map(entry => entry.repo))
    }));
  }

  const frozenEntries = Object.freeze(entries);
  const frozenMilestones = Object.freeze(milestones);
  return Object.freeze({
    available: frozenMilestones.length >= 2,
    firstYear: frozenMilestones[0]?.year || null,
    lastYear: frozenMilestones[frozenMilestones.length - 1]?.year || null,
    knownCount: frozenEntries.length,
    unknownCount,
    totalCount: unique.size,
    entries: frozenEntries,
    milestones: frozenMilestones
  });
}

export function townGrowthIndexForYear(timeline, requestedYear) {
  const milestones = timeline?.milestones;
  if (!Array.isArray(milestones) || !milestones.length) return -1;
  const year = Math.trunc(Number(requestedYear));
  if (!Number.isFinite(year)) return 0;
  let index = 0;
  for (let cursor = 0; cursor < milestones.length; cursor++) {
    if (milestones[cursor].year > year) break;
    index = cursor;
  }
  return index;
}

export function townGrowthSnapshot(timeline, requestedIndex = 0) {
  const milestones = timeline?.milestones;
  if (!Array.isArray(milestones) || !milestones.length) return null;
  const index = Math.max(0, Math.min(milestones.length - 1, Math.trunc(Number(requestedIndex) || 0)));
  const milestone = milestones[index];
  const isPresent = index === milestones.length - 1;
  return Object.freeze({
    index,
    steps: milestones.length,
    year: milestone.year,
    total: milestone.total,
    visibleCount: milestone.total + (isPresent ? (timeline.unknownCount || 0) : 0),
    languageCount: milestone.languageCount,
    added: milestone.added,
    isPresent
  });
}

export function createTownGrowthShareUrl(baseUrl, year) {
  try {
    const url = new URL(String(baseUrl));
    const safeYear = Math.trunc(Number(year));
    if (!Number.isFinite(safeYear)) return '';
    for (const key of ['dbg', 'perf', 'launch', 'twin']) url.searchParams.delete(key);
    url.searchParams.set('growth', String(safeYear));
    url.searchParams.set('ref', 'growth-replay');
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}
