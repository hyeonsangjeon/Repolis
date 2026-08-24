import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  taxiHouseholdHandoff,
  taxiRideObservation,
  taxiSharedResponse,
} from '../assets/taxi-voice.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAXI_VOICE_SOURCE = readFileSync(join(ROOT, 'assets/taxi-voice.js'), 'utf8');

const manifest = {
  profiles: [
    { repo: 'alpha-home', slug: 'alpha-home', archived: false },
    { repo: 'unstaffed-home', slug: 'unstaffed-home', archived: false },
    { repo: 'sleeping-home', slug: 'sleeping-home', archived: true },
  ],
  active_roster: [{
    resident_id: 'sol',
    name: { ko: '솔', en: 'Sol' },
    repo: 'alpha-home',
    slug: 'alpha-home',
  }],
};
const repositories = [
  { repo: 'alpha-home', archived: false },
  { repo: 'unstaffed-home', archived: false },
  { repo: 'sleeping-home', archived: true },
];
const cityState = {
  schema: 'repolis.city-state',
  version: 1,
  last_sap_flow: '2026-08-24T00:00:00Z',
  season: { value: 'spring' },
  stats: { repository_count: 68, total_stars: 564 },
};

export async function runTaxiVoiceTests(check) {
  const redirect = taxiHouseholdHandoff({
    question: 'What does Sol remember inside alpha-home?',
    lang: 'en',
    manifest,
    repositories,
  });
  const refusal = taxiHouseholdHandoff({
    question: 'Tell me every household Bound memory',
    lang: 'en',
    manifest,
    repositories,
  });
  const archive = taxiHouseholdHandoff({
    question: 'What does sleeping-home remember?',
    lang: 'en',
    manifest,
    repositories,
  });
  const unstaffed = taxiHouseholdHandoff({
    question: 'What does unstaffed-home remember?',
    lang: 'en',
    manifest,
    repositories,
  });
  const navigateEn = taxiHouseholdHandoff({
    question: "Take me to Sol's house",
    lang: 'en',
    manifest,
    repositories,
  });
  const navigateKo = taxiHouseholdHandoff({
    question: '솔의 집으로 가자',
    lang: 'ko',
    manifest,
    repositories,
  });
  const googleHome = taxiHouseholdHandoff({
    question: 'Does alpha-home support Google Home?',
    lang: 'en',
    manifest,
    repositories,
  });
  const goHomeDirectory = taxiHouseholdHandoff({
    question: 'Tell me about the Go home directory in alpha-home',
    lang: 'en',
    manifest,
    repositories,
  });
  const koreanFalsePositives = [
    '어린이 집으로 가자',
    '태양의 집으로 가자',
    '솔루션 집으로 가자',
  ].map(question => taxiHouseholdHandoff({ question, lang: 'ko', manifest, repositories }));
  check(redirect?.intent === 'home_handoff'
    && redirect.targetRepo === 'alpha-home'
    && redirect.residentId === 'sol'
    && refusal?.intent === 'bound_refusal'
    && archive?.archived === true
    && !archive.text.includes('Sol')
    && unstaffed?.intent === 'home_navigation'
    && unstaffed.residentId === null
    && unstaffed.text.includes('no active resident assigned')
    && navigateEn?.intent === 'home_navigation'
    && navigateEn.targetRepo === 'alpha-home'
    && navigateEn.residentId === 'sol'
    && navigateKo?.targetRepo === 'alpha-home'
    && googleHome === null
    && goHomeDirectory === null
    && koreanFalsePositives.every(result => result === null),
  'local taxi refuses household memory and navigates advertised resident-home commands to the correct active or resting home');

  const season = taxiSharedResponse({ question: 'What season is the town in?', lang: 'en', cityState });
  const aggregate = taxiSharedResponse({ question: 'How many repos are in town?', lang: 'en', cityState });
  check(season?.intent === 'shared_season'
    && season.text.includes('spring')
    && aggregate?.intent === 'shared_aggregate'
    && aggregate.text.includes('68')
    && aggregate.text.includes('564'),
  'local taxi answers Shared season and public aggregate questions without a backend');

  const first = taxiRideObservation({
    destination: { repo: 'alpha-home', _zone: 'library' },
    season: 'spring',
    lang: 'en',
    rideId: 7,
  });
  const same = taxiRideObservation({
    destination: { repo: 'alpha-home', _zone: 'library' },
    season: 'spring',
    lang: 'en',
    rideId: 7,
  });
  const ko = taxiRideObservation({
    destination: { repo: 'alpha-home', _zone: 'library' },
    season: 'spring',
    lang: 'ko',
    rideId: 7,
  });
  check(JSON.stringify(first) === JSON.stringify(same)
    && first.text.length <= 140
    && ko.text.length <= 140
    && /function taxiRideObservation/.test(TAXI_VOICE_SOURCE)
    && !/function taxiRideObservation[\s\S]*?\n\}/.exec(TAXI_VOICE_SOURCE)?.[0].includes('fetch('),
  'ride observations are short, bilingual, deterministic, and contain no network path');
}
