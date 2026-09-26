import assert from 'node:assert/strict';
import { createTownLabelLayout, handleTownPanelKey, layoutTownLabels, readableCardForeground, stableTownLabelFocus, TOWN_LABEL_LIMITS as L } from '../assets/town-labels.js';

const candidate = (order, extra = {}) => ({
  order, id: 'person-' + order, priority: 0, distance: 4, depth: 2,
  eligible: true, x: 120, y: 240, naturalWidth: 680, naturalHeight: 170,
  selected: false, lastVisibleAt: 0, ...extra,
});
const viewport = { width: 390, height: 844, near: .2, lowEnd: false };
for (const [width, height] of [[390, 844], [1440, 900], [844, 390], [320, 360]]) {
  const state = createTownLabelLayout();
  const entries = Array.from({ length: 14 }, (_, i) => candidate(i, { x: 75 + i % 3 * 120, y: 130 + Math.floor(i / 3) * 70 }));
  const output = layoutTownLabels(entries, { ...viewport, width, height }, 1000, [], state);
  assert(output.length > 0 && output.length <= (width <= 520 ? L.mobileCount : L.count));
  for (const entry of output) {
    assert(entry.width <= (width <= 520 ? L.mobileWidth : L.width) && entry.height <= L.height);
    assert(entry.left >= L.margin && entry.left + entry.width <= width - L.margin);
    assert(entry.top >= 0 && entry.top + entry.height <= height);
  }
  assert.equal(output, state.chosen, 'reuse the output buffer');
}
const crowded = [candidate(0, { selected: true }), candidate(1, { priority: 3 }), candidate(2)];
const chosen = layoutTownLabels(crowded, viewport, 1000, [], createTownLabelLayout());
assert.deepEqual(chosen.map(entry => entry.id), ['person-1'], 'engaged actor wins an overlapping slot');
const state = createTownLabelLayout(), stable = [candidate(0), candidate(1, { x: 250 })];
layoutTownLabels(stable, viewport, 1000, [], state);
const original = state.chosen.map(entry => entry.id);
stable[1].distance = .5;
layoutTownLabels(stable, viewport, 1100, [], state);
assert.deepEqual(state.chosen.map(entry => entry.id), original, 'minor distance changes cannot reorder retained slots');
for (const extra of [{ depth: 0 }, { depth: -.2 }, { depth: .1 }, { eligible: false }, { x: -1 }, { y: 10 }, { x: Infinity }]) {
  assert.equal(layoutTownLabels([candidate(0, extra)], viewport, 1000, [], createTownLabelLayout()).length, 0);
}
const excluded = layoutTownLabels([candidate(0)], viewport, 1000, [{ left: 30, top: 200, width: 200, height: 80 }], createTownLabelLayout());
assert.equal(excluded.length, 0, 'existing speech and panel rectangles own their space');
const phoneLandscape = layoutTownLabels(Array.from({ length: 8 }, (_, i) => candidate(i, { x: 90 + i * 95, y: 150 })),
  { width: 844, height: 390, mobile: true, near: .2 }, 1000, [], createTownLabelLayout());
assert(phoneLandscape.length <= L.mobileCount && phoneLandscape.every(row => row.height <= L.mobileHeight),
  'landscape phones retain the mobile label budget');
const safe = layoutTownLabels([candidate(0, { x: 60 })], { ...viewport, left: 70 }, 1000, [], createTownLabelLayout());
assert.equal(safe.length, 0, 'safe-area insets cannot be crossed');
const focus = createTownLabelLayout();
assert.equal(stableTownLabelFocus(focus, 'a', 100), 'a');
assert.equal(stableTownLabelFocus(focus, 'b', 200), 'a');
assert.equal(stableTownLabelFocus(focus, 'a', 300), 'a');
assert.equal(stableTownLabelFocus(focus, 'b', 400), 'a');
assert.equal(stableTownLabelFocus(focus, 'b', 801), 'b');
assert.equal(stableTownLabelFocus(focus, null, 802), null);
let closes = 0, focused = null, consumed = 0;
const first = { focus: () => { focused = 'first'; } }, last = { focus: () => { focused = 'last'; } };
const owner = { element: { contains: element => element === first || element === last }, close: () => { closes++; } };
const event = extra => ({ key: 'Escape', preventDefault: () => { consumed++; }, stopImmediatePropagation() {}, ...extra });
assert(!handleTownPanelKey(event({ isComposing: true }), owner, () => [first, last], null));
assert(!handleTownPanelKey(event({ keyCode: 229 }), owner, () => [first, last], first));
assert.equal(closes, 0, 'IME cancellation is not panel dismissal');
assert(handleTownPanelKey(event(), owner, () => [first, last], null));
assert.equal(closes, 1, 'Escape outside panel closes exactly its owner');
handleTownPanelKey(event({ repeat: true }), owner, () => [first, last], null);
assert.equal(closes, 1, 'a held Escape cannot dismiss consecutive scenes');
handleTownPanelKey(event({ key: 'Tab' }), owner, () => [first, last], null);
assert.equal(focused, 'first');
handleTownPanelKey(event({ key: 'Tab', shiftKey: true }), owner, () => [first, last], first);
assert.equal(focused, 'last');
assert(!handleTownPanelKey(event({ key: 'Enter' }), owner, () => [first, last], first));
assert(consumed > 0);
for (const hex of ['#9d8ec9', '#ffffff', '#f6ca80']) assert.equal(readableCardForeground(hex), '#000000');
for (const hex of ['#000000', '#123445', '#552211']) assert.equal(readableCardForeground(hex), '#ffffff');
assert.throws(() => readableCardForeground('invalid'), TypeError);
console.log('Readable town: bounded projection, priority, stable selection, occlusion and safe-area fixtures passed');
