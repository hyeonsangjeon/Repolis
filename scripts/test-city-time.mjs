import assert from 'node:assert/strict';
import {
  CITY_STATE_SCHEMA,
  CITY_STATE_VERSION,
  REPO_NEWCOMER_DAYS,
  cityReferenceTimestamp,
  classifyBuildingWear,
  constructionScaffoldPlan,
  projectCityTime,
  repositoryAgeDays,
  resolveCitySeason,
  seasonPalette
} from '../assets/city-time.js';

const cityState = {
  schema: CITY_STATE_SCHEMA,
  version: CITY_STATE_VERSION,
  last_sap_flow: '2026-06-30T12:00:00Z',
  season: { value: 'autumn', inputs: { reference_date: '2026-06-30' } }
};
const reference = cityReferenceTimestamp(cityState);

assert.equal(new Date(reference).toISOString(), '2026-06-30T12:00:00.000Z');
assert.equal(classifyBuildingWear({ pushed:'2026-06-01' }, reference).state, 'recent');
assert.equal(classifyBuildingWear({ pushed:'2026-01-01' }, reference).state, 'faded');
assert.equal(classifyBuildingWear({ pushed:'2024-01-01' }, reference).state, 'mossed');
assert.equal(classifyBuildingWear({}, reference).state, 'mossed');
assert.equal(projectCityTime({ pushed:'2026-06-01', archived:true }, cityState).archived, true);
assert.equal(projectCityTime({ pushed:'2026-06-01' }, cityState, [], { wear:'mossed', archived:true }).state, 'mossed');
assert.equal(REPO_NEWCOMER_DAYS, 90);
assert.equal(repositoryAgeDays({ created:'2026-04-02' }, reference), 89);
assert.equal(repositoryAgeDays({ created:'2026-04-01' }, reference), 90);
assert.equal(repositoryAgeDays({ created:'2026-03-31' }, reference), 91);
assert.equal(projectCityTime({ created:'2026-04-02', pushed:'2026-06-01' }, cityState).newcomer, true);
assert.equal(projectCityTime({ created:'2026-04-01', pushed:'2026-06-01' }, cityState).newcomer, false);
assert.equal(projectCityTime({ created:'2026-03-31', pushed:'2026-06-01' }, cityState).newcomer, false);
assert.equal(projectCityTime({ created:'2026-04-02', pushed:'2026-06-01', archived:true }, cityState).newcomer, false);
const scaffoldMin = constructionScaffoldPlan({ width:2, height:2, depth:2 });
const scaffoldCurrent = constructionScaffoldPlan({ width:7, height:8, depth:7 });
const scaffoldMax = constructionScaffoldPlan({ width:40, height:40, depth:40, kind:'mansion' });
const scaffoldLow = constructionScaffoldPlan({ width:7, height:8, depth:7, lowEnd:true });
assert.equal(scaffoldMin.enabled, true);
assert.equal(scaffoldMin.parts, 8);
assert.equal(scaffoldCurrent.draws, 1);
assert.equal(scaffoldMax.sideX, 33.02);
assert.ok(scaffoldMin.frontClearance > 0 && scaffoldCurrent.frontClearance > 0 && scaffoldMax.frontClearance > 0);
assert.ok(scaffoldLow.parts < scaffoldCurrent.parts);
assert.deepEqual(constructionScaffoldPlan({ newcomer:false }), {
  enabled:false, poles:0, rails:0, decks:0, parts:0, draws:0, colliders:0,
});
assert.equal(resolveCitySeason(cityState), 'autumn');
assert.equal(resolveCitySeason(cityState, 'winter'), 'winter');
assert.equal(resolveCitySeason({}), 'summer');
assert.notDeepEqual(seasonPalette('spring'), seasonPalette('winter'));

console.log('ALL GREEN - city time wear, ruin, newcomer, and season fixtures');
