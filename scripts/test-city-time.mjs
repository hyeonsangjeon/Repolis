import assert from 'node:assert/strict';
import {
  CITY_STATE_SCHEMA,
  CITY_STATE_VERSION,
  cityReferenceTimestamp,
  classifyBuildingWear,
  projectCityTime,
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
assert.equal(resolveCitySeason(cityState), 'autumn');
assert.equal(resolveCitySeason(cityState, 'winter'), 'winter');
assert.equal(resolveCitySeason({}), 'summer');
assert.notDeepEqual(seasonPalette('spring'), seasonPalette('winter'));

console.log('ALL GREEN - city time wear, ruin, and season fixtures');
