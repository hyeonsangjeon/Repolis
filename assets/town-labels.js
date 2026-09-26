export const TOWN_LABEL_LIMITS = Object.freeze({
  count: 6, mobileCount: 4, width: 176, mobileWidth: 148, height: 32, mobileHeight: 28,
  margin: 12, top: 84, bottom: 120, distance: 32, minWidth: 38,
  gap: 8, edgeGraceMs: 300, focusDwellMs: 400, maxCandidates: 32, signWidth: 260, signHeight: 84,
});

export function createTownLabelLayout() {
  return { candidates: [], chosen: [], focus: null, pendingFocus: null, pendingSince: 0 };
}

export function readableCardForeground(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new TypeError('Expected a six-digit card color');
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return luminance > .179 ? '#000000' : '#ffffff';
}

export function stableTownLabelFocus(state, target, now) {
  if (state.focus === target) { state.pendingFocus = null; return state.focus; }
  if (!state.focus || !target) {
    state.focus = target; state.pendingFocus = null; return target;
  }
  if (state.pendingFocus !== target) { state.pendingFocus = target; state.pendingSince = now; }
  if (now - state.pendingSince >= TOWN_LABEL_LIMITS.focusDwellMs) {
    state.focus = target; state.pendingFocus = null;
  }
  return state.focus;
}

export function handleTownPanelKey(event, owner, focusables, activeElement) {
  if (!owner || event.defaultPrevented || event.isComposing || event.keyCode === 229) return false;
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat) owner.close();
    return true;
  }
  if (event.key !== 'Tab') return false;
  const items = focusables(owner.element);
  if (!items.length) return false;
  const first = items[0], last = items[items.length - 1];
  if (!owner.element.contains(activeElement) || (event.shiftKey && activeElement === first)
    || (!event.shiftKey && activeElement === last)) {
    event.preventDefault(); event.stopImmediatePropagation();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
    return true;
  }
  return false;
}

function overlaps(a, b, gap) {
  return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;
}

// Entries and scratch arrays are reused. Selection never creates a sprite or DOM node.
export function layoutTownLabels(entries, viewport, now, obstacles, state) {
  const L = TOWN_LABEL_LIMITS, mobile = viewport.mobile || viewport.width <= 520;
  const maxCount = mobile || viewport.lowEnd ? L.mobileCount : L.count;
  const left = Math.max(L.margin, viewport.left || 0), right = viewport.width - Math.max(L.margin, viewport.right || 0);
  const top = Math.max(Math.min(L.top, viewport.height * .22), viewport.top || 0);
  const bottom = viewport.height - Math.max(Math.min(L.bottom, viewport.height * .27), viewport.bottom || 0);
  const candidates = state.candidates, chosen = state.chosen;
  candidates.length = 0; chosen.length = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    entry.visible = false;
    const scale = Math.min(1, (mobile ? L.mobileWidth : L.width) / entry.naturalWidth,
      (mobile ? L.mobileHeight : L.height) / entry.naturalHeight);
    entry.width = entry.naturalWidth * scale; entry.height = entry.naturalHeight * scale;
    const eligible = entry.eligible && entry.depth > viewport.near && entry.distance < L.distance
      && Number.isFinite(entry.width + entry.height + entry.x + entry.y)
      && entry.width >= L.minWidth && entry.x >= left && entry.x <= right
      && entry.y >= top && entry.y <= bottom && right - left >= entry.width && bottom - top >= entry.height;
    if (!eligible) {
      if (now - entry.lastVisibleAt > L.edgeGraceMs) entry.selected = false;
      continue;
    }
    entry.left = Math.max(left, Math.min(right - entry.width, entry.x - entry.width / 2));
    entry.top = Math.max(top, Math.min(bottom - entry.height, entry.y - entry.height / 2));
    if (candidates.length < L.maxCandidates) candidates.push(entry);
  }
  candidates.sort((a, b) => b.priority - a.priority || Number(b.selected) - Number(a.selected)
    || (a.selected && b.selected ? a.order - b.order : Math.floor(a.distance / 3) - Math.floor(b.distance / 3)) || a.order - b.order);
  for (const entry of candidates) {
    let blocked = chosen.length >= maxCount;
    for (let i = 0; !blocked && i < obstacles.length; i++) blocked = overlaps(entry, obstacles[i], L.gap);
    for (let i = 0; !blocked && i < chosen.length; i++) blocked = overlaps(entry, chosen[i], L.gap);
    entry.selected = !blocked;
    if (blocked) continue;
    entry.visible = true; entry.lastVisibleAt = now; chosen.push(entry);
  }
  return chosen;
}
