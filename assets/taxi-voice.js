const HOUSEHOLD_INTENT = /\bbound\b|household|private memory|inside (?:that|the) house|what (?:does|did) .{0,40} remember|kept memory|묶인\s*기억|집안\s*(?:기억|사정)|속기억|무엇을\s*기억|뭘\s*기억|그\s*집\s*(?:주민|기억|사정)/i;
const EN_HOME_NAV = /^\s*(?:(?:please|could you|can you)\s+)?(?:(?:take|drive|guide|bring)\s+(?:me\s+)?to|(?:go|head|walk|navigate)\s+to|visit)\b/i;
const KO_HOME_NAV = /(?:집으로|집에)\s*(?:가자|가\s*줘|가줘|갈래|데려다\s*줘|안내해\s*줘|이동하자)[?.!]*\s*$/;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

function clean(value, max = 180) {
  const text = String(value || '').replace(CONTROL, ' ').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const clipped = text.slice(0, max - 1), boundary = clipped.lastIndexOf(' ');
  return clipped.slice(0, boundary > max * 0.55 ? boundary : max - 1).trim() + '\u2026';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentioned(source, value) {
  const identity = String(value || '').trim();
  if (!identity) return false;
  if (/[^\x00-\x7f]/.test(identity)) {
    return new RegExp(
      `(^|[^\\p{L}\\p{N}._-])${escapeRegExp(identity)}(?=$|[^\\p{L}\\p{N}._-]|의|에게|한테|은|는|이|가|을|를|와|과|도)`,
      'iu',
    ).test(source);
  }
  return new RegExp(
    `(^|[^\\p{L}\\p{N}._-])${escapeRegExp(identity)}([^\\p{L}\\p{N}._-]|$)`,
    'iu',
  ).test(source);
}

function targetHome(question, manifest) {
  const active = new Map((manifest?.active_roster || []).map(entry => [entry.slug, entry]));
  const profiles = (manifest?.profiles || []).slice().sort((a, b) =>
    String(b.repo || '').length - String(a.repo || '').length || String(a.slug).localeCompare(String(b.slug)));
  for (const profile of profiles) {
    if (mentioned(question, profile.repo)) return { profile, active: active.get(profile.slug) || null };
  }
  for (const entry of manifest?.active_roster || []) {
    const names = [entry.resident_id, entry.name?.ko, entry.name?.en];
    if (names.some(name => mentioned(question, name))) {
      return { profile: profiles.find(profile => profile.slug === entry.slug) || entry, active: entry };
    }
  }
  return null;
}

function navigationHome(question, manifest) {
  const english = EN_HOME_NAV.test(question), korean = KO_HOME_NAV.test(question);
  if (!english && !korean) return null;
  const active = new Map((manifest?.active_roster || []).map(entry => [entry.slug, entry]));
  const profiles = (manifest?.profiles || []).slice().sort((a, b) =>
    String(b.repo || '').length - String(a.repo || '').length || String(a.slug).localeCompare(String(b.slug)));
  for (const profile of profiles) {
    const resident = active.get(profile.slug) || null;
    const identities = [profile.repo, resident?.resident_id, resident?.name?.en, resident?.name?.ko]
      .filter(Boolean)
      .sort((a, b) => String(b).length - String(a).length);
    for (const identity of identities) {
      const escaped = escapeRegExp(identity);
      const pattern = english
        ? new RegExp(`(^|[^\\p{L}\\p{N}._-])${escaped}(?:['\u2019]s)?\\s+(?:home|house)\\b`, 'iu')
        : new RegExp(`(^|[^\\p{L}\\p{N}._-])${escaped}(?:의)?\\s*집(?:으로|에)`, 'iu');
      if (pattern.test(question)) return { profile, active: resident };
    }
  }
  return null;
}

export function taxiHouseholdHandoff({
  question,
  lang = 'ko',
  manifest,
  repositories = [],
} = {}) {
  const source = clean(question, 2000);
  if (!source) return null;
  const householdIntent = HOUSEHOLD_INTENT.test(source);
  const navigationTarget = navigationHome(source, manifest);
  const navigationIntent = !!navigationTarget;
  if (!householdIntent && !navigationIntent) return null;
  const ko = lang !== 'en', target = householdIntent ? targetHome(source, manifest) : navigationTarget;
  if (!target && navigationIntent && !householdIntent) return null;
  if (!target) {
    return Object.freeze({
      intent: 'bound_refusal',
      targetRepo: null,
      text: ko
        ? '나는 도시의 길은 알지만 어느 집의 속기억도 들여다보지 않아요. 집 이름을 말하면 그 앞까지는 데려다줄게요.'
        : 'I know every road in town, but I do not keep any household memories. Name the house and I can take you to its door.',
    });
  }
  const repo = target.profile.repo;
  const record = repositories.find(item => String(item?.repo || '').toLowerCase() === String(repo).toLowerCase());
  const archived = target.profile.archived === true || record?.archived === true;
  const residentName = target.active?.name?.[ko ? 'ko' : 'en'] || target.active?.resident_id || '';
  const unstaffed = !archived && !target.active;
  if (navigationIntent && !householdIntent) {
    const text = archived
      ? (ko
        ? `${repo} 집은 지금 잠들어 있어요. 이름이 남은 곳까지 조용히 모셔다드릴게요.`
        : `${repo} is resting now. I can take you quietly to where its name remains.`)
      : unstaffed
        ? (ko
          ? `${repo}에는 지금 배정된 주민이 없지만, 공개된 집 앞까지는 모셔다드릴게요.`
          : `${repo} has no active resident assigned, but I can take you to the public house.`)
        : (ko
          ? `${residentName}의 집은 ${repo}예요. 그 집 앞까지 모셔다드릴게요.`
          : `${residentName}'s home is ${repo}. I can take you to the door.`);
    return Object.freeze({
      intent: 'home_navigation',
      targetRepo: repo,
      residentId: target.active?.resident_id || null,
      archived,
      text: clean(text),
    });
  }
  const text = archived
    ? (ko
      ? `${repo} 집은 지금 잠들어 있어요. 그 안의 기억을 대신 말할 수는 없지만, 이름이 남은 곳까지 모셔다드릴게요.`
      : `${repo} is resting now. I cannot speak for what it kept, but I can take you to where its name remains.`)
    : unstaffed
      ? (ko
        ? `${repo}에는 지금 배정된 주민이 없어요. 집안 기억을 대신 말할 수는 없지만, 공개된 집 앞까지는 모셔다드릴게요.`
        : `${repo} has no active resident assigned. I cannot speak for its household memory, but I can take you to the public house.`)
    : (ko
      ? `그 집의 기억은 내가 대신 말할 수 없어요. ${repo} 앞까지 모셔다드릴 테니${residentName ? ` ${residentName}에게` : ' 그곳 주민에게'} 직접 물어봐요.`
      : `I do not keep that home's memories. I can take you to ${repo}; ask ${residentName || 'the resident'} there.`);
  return Object.freeze({
    intent: unstaffed ? 'home_navigation' : 'home_handoff',
    targetRepo: repo,
    residentId: target.active?.resident_id || null,
    archived,
    text: clean(text),
  });
}

const SEASON_NAMES = Object.freeze({
  spring: Object.freeze({ ko: '봄', en: 'spring' }),
  summer: Object.freeze({ ko: '여름', en: 'summer' }),
  autumn: Object.freeze({ ko: '가을', en: 'autumn' }),
  winter: Object.freeze({ ko: '겨울', en: 'winter' }),
});

export function taxiSharedResponse({ question, lang = 'ko', cityState } = {}) {
  const source = clean(question, 2000), ko = lang !== 'en';
  if (!source || cityState?.schema !== 'repolis.city-state' || cityState?.version !== 1) return null;
  const season = cityState?.season?.value, seasonName = SEASON_NAMES[season]?.[ko ? 'ko' : 'en'];
  if (seasonName && /도시.{0,8}계절|지금.{0,8}계절|요즘.{0,8}계절|what season|current season|season in (?:town|the city)/i.test(source)) {
    return Object.freeze({
      intent: 'shared_season',
      text: ko
        ? `지금 도시는 ${seasonName}이에요. 길마다 볕과 바람이 조금씩 달라서 천천히 돌아보는 편이 좋아요.`
        : `The town is in ${seasonName} now. Light and wind change from road to road, so it is worth taking the long way.`,
    });
  }
  const stats = cityState.stats || {};
  if (/도시.{0,10}(몇|통계)|레포.{0,8}(몇|개수)|how many (?:repos|repositories|houses)|town (?:count|totals|stats)/i.test(source)
    && Number.isInteger(stats.repository_count)) {
    return Object.freeze({
      intent: 'shared_aggregate',
      text: ko
        ? `오늘 장부에는 레포 집 ${stats.repository_count}채, 별 ${Number(stats.total_stars) || 0}개가 보여요. 어느 구역부터 돌까요?`
        : `Today's town ledger shows ${stats.repository_count} repo houses and ${Number(stats.total_stars) || 0} stars. Which district first?`,
    });
  }
  if (/마지막.{0,8}수액|수액.{0,8}(언제|기록)|last sap|sap record/i.test(source) && cityState.last_sap_flow) {
    const day = String(cityState.last_sap_flow).slice(0, 10);
    return Object.freeze({
      intent: 'shared_sap_record',
      text: ko
        ? `내가 아는 건 ${day}에 남은 수액빛 기록뿐이에요. 나무가 무슨 뜻이었는지는 나도 몰라요.`
        : `All I know is that the sap-light record is dated ${day}. I cannot tell you what the tree meant by it.`,
    });
  }
  return null;
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const SEASON_OBSERVATIONS = Object.freeze({
  spring: Object.freeze({
    ko: ['봄길은 모퉁이마다 꽃가루가 달라요. 창문은 조금 열어둘게요.', '오늘은 봄바람이 부드러워서 먼 구역까지 금방 가겠네요.'],
    en: ['Every corner has its own pollen in spring. I will keep the window cracked.', 'The spring wind is gentle today. Even the far districts feel close.'],
  }),
  summer: Object.freeze({
    ko: ['여름 낮엔 운하 쪽 길이 조금 더 시원해요.', '볕이 세네요. 그늘 많은 골목으로 돌아갈게요.'],
    en: ['The canal road runs cooler on summer days.', 'Bright sun today. I will take the lane with more shade.'],
  }),
  autumn: Object.freeze({
    ko: ['가을엔 낙엽이 구역 경계보다 먼저 길을 바꿔 놓죠.', '오늘 길에는 마른 잎이 많아요. 조금 천천히 갈게요.'],
    en: ['In autumn, fallen leaves redraw the roads before the district signs do.', 'Dry leaves on the road today. I will take this turn gently.'],
  }),
  winter: Object.freeze({
    ko: ['겨울길은 소리가 멀리 가요. 조용히 달리기 좋은 날이네요.', '그늘진 길엔 서리가 남아 있어요. 넓은 길로 갈게요.'],
    en: ['Sound carries far on winter roads. A good day for a quiet ride.', 'Frost lingers in the shaded lanes. I will keep to the wider road.'],
  }),
});

const DISTRICT_OBSERVATIONS = Object.freeze({
  ai: Object.freeze({
    ko: ['관측소 쪽은 늦은 시간에도 창가 불빛이 오래 남아요.'],
    en: ['The observatory windows tend to keep their light late.'],
  }),
  infra: Object.freeze({
    ko: ['항구 길은 정돈돼 보여도 늘 작은 수레 하나쯤 지나가요.'],
    en: ['The harbor road looks orderly, yet there is always one little cart in motion.'],
  }),
  web: Object.freeze({
    ko: ['이 거리 간판은 계절마다 색이 조금씩 달라 보여요.'],
    en: ['The signs on this street seem to change colour with the season.'],
  }),
  data: Object.freeze({
    ko: ['공방 앞은 조용해도 안쪽에선 숫자 굴러가는 소리가 나죠.'],
    en: ['The workshops look quiet, though you can almost hear numbers rolling inside.'],
  }),
  library: Object.freeze({
    ko: ['학습관 골목은 서두르면 꼭 한 권을 놓치게 돼요.'],
    en: ['Rush through the library lane and you always miss one good volume.'],
  }),
  ruins: Object.freeze({
    ko: ['폐허 지구엔 들꽃이 길 가장자리를 먼저 골라요.'],
    en: ['In the ruins district, wildflowers always choose the road edge first.'],
  }),
  plaza: Object.freeze({
    ko: ['광장은 어느 구역으로 가든 한 번쯤 다시 만나게 되는 길이에요.'],
    en: ['Whichever district you choose, the plaza has a way of meeting you again.'],
  }),
});

export function taxiRideObservation({
  destination,
  season = 'summer',
  lang = 'ko',
  rideId = 0,
} = {}) {
  const ko = lang !== 'en';
  const zone = String(destination?._zone || destination?.zone || '').toLowerCase();
  const districtBank = DISTRICT_OBSERVATIONS[zone]?.[ko ? 'ko' : 'en'] || [];
  const seasonBank = SEASON_OBSERVATIONS[season]?.[ko ? 'ko' : 'en']
    || SEASON_OBSERVATIONS.summer[ko ? 'ko' : 'en'];
  const key = `${rideId}|${season}|${zone}|${destination?.repo || destination?.label || ''}`;
  const useDistrict = districtBank.length > 0 && stableHash(`${key}|kind`) % 2 === 0;
  const bank = useDistrict ? districtBank : seasonBank;
  const text = bank[stableHash(key) % bank.length];
  return Object.freeze({ kind: useDistrict ? 'district' : 'season', zone: zone || null, text: clean(text, 140) });
}
