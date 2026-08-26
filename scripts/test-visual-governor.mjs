import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { runInNewContext } from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const CORE = (HTML.match(/\/\*VISUAL_GOVERNOR_CORE:START\*\/([\s\S]*?)\/\*VISUAL_GOVERNOR_CORE:END\*\//) || [, ''])[1];

function loadCore() {
  if (!CORE) throw new Error('visual governor core markers are missing');
  const context = {};
  runInNewContext(`${CORE}
globalThis.__api = {
  VISUAL_GOVERNOR_TIER_NAMES,
  VISUAL_GOVERNOR_CONFIG,
  createVisualGovernorState,
  stepVisualGovernor,
  forceVisualGovernorTier,
  visualGovernorDecorativeStride,
  visualGovernorStateSnapshot,
  replayVisualGovernor
};`, context);
  return context.__api;
}

function drive(api, state, frameMs, durationMs, eligible = true, reason = 'fixture') {
  const transitions = [];
  for (let elapsed = 0; elapsed < durationMs; elapsed += frameMs) {
    const transition = api.stepVisualGovernor(state, frameMs, eligible, reason);
    if (transition) transitions.push({ ...transition });
  }
  return transitions;
}

function lowSequence() {
  const sequence = [];
  for (let elapsed = 0; elapsed < 6200; elapsed += 16.67) sequence.push(16.67);
  for (let elapsed = 0; elapsed < 18000; elapsed += 34) sequence.push(34);
  return sequence;
}

export function runVisualGovernorTests(check) {
  const api = loadCore();

  {
    const { tiers, policies } = api.VISUAL_GOVERNOR_CONFIG;
    check(api.VISUAL_GOVERNOR_TIER_NAMES.join(',') === 'full,balanced,lean'
      && tiers.length === 3
      && tiers[1].upFrameMs < tiers[0].downFrameMs
      && tiers[2].upFrameMs < tiers[1].downFrameMs
      && policies[0].shadowRadius === null
      && policies[1].lodBias === 1
      && policies[2].lodBias > 1
      && policies[0].particleScale > policies[1].particleScale
      && policies[1].particleScale > policies[2].particleScale,
    'visual governor has three reversible tiers, separated hysteresis, and defers far-detail bias until lean');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 34, 5900);
    check(state.tier === 0 && state.transitionCount === 0
      && api.visualGovernorStateSnapshot(state).warmup.complete === false,
    'bounded warm-up observes frames without degrading quality');
  }

  {
    const result = api.replayVisualGovernor(lowSequence());
    check(result.state.tier === 'lean'
      && result.transitions.map(item => `${item.from}>${item.to}`).join(',') === 'full>balanced,balanced>lean',
    'a sustained deterministic low-frame fixture steps down one tier at a time');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 16.67, 6200);
    api.stepVisualGovernor(state, 80, true, 'transient-spike');
    drive(api, state, 16.67, 9000);
    check(state.tier === 0 && state.transitionCount === 0 && state.emaMs < state.config.tiers[0].downFrameMs,
    'one transient frame spike is smoothed and cannot trigger a downgrade');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 16.67, 6200);
    const down = drive(api, state, 26, 7000);
    drive(api, state, 20, 30000);
    check(down.length === 1 && state.tier === 1 && state.transitionCount === 1,
    'neutral frames inside the hysteresis band neither recover nor degrade');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 16.67, 6200);
    const first = drive(api, state, 26, 7000);
    const tierAfterFirst = state.tier;
    drive(api, state, 34, 5000);
    check(first.length === 1 && tierAfterFirst === 1 && state.tier === 1
      && state.activeMs < state.dwellUntilMs,
    'minimum dwell blocks an immediate second downgrade even with continuing slow frames');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 16.67, 6200);
    drive(api, state, 34, 19000);
    const before = state.transitionCount;
    const firstRecovery = drive(api, state, 16.2, 19500);
    const afterFirst = state.tier;
    const secondRecovery = drive(api, state, 16.2, 25000);
    check(afterFirst === 1
      && firstRecovery.map(item => item.to).join(',') === 'balanced'
      && secondRecovery.map(item => item.to).join(',') === 'full'
      && state.transitionCount === before + 2,
    'stable frames recover exactly one tier per sustained evidence and dwell interval');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 16.67, 6200);
    drive(api, state, 30, 2500);
    const activeBefore = state.activeMs;
    api.stepVisualGovernor(state, 5000, false, 'hidden');
    drive(api, state, 30, 2500);
    check(state.activeMs > activeBefore && state.activeMs < activeBefore + 2600
      && state.tier === 0 && state.lastPauseReason === 'hidden',
    'a hidden-page pause advances no active time and clears partial slow evidence');
  }

  {
    const lowEnd = api.createVisualGovernorState({ lowEnd: true });
    api.forceVisualGovernorTier(lowEnd, 'full');
    const reduced = api.createVisualGovernorState({ reducedMotion: true });
    api.forceVisualGovernorTier(reduced, 'lean');
    api.forceVisualGovernorTier(reduced, 'full');
    check(lowEnd.floor === 1 && lowEnd.tier === 1
      && api.visualGovernorStateSnapshot(lowEnd).qualityCeiling === 'balanced'
      && api.visualGovernorDecorativeStride(reduced) === 0,
    'LOW_END clamps the quality ceiling and reduced motion cannot be re-enabled by recovery or debug force');
  }

  {
    const sequence = lowSequence();
    for (let elapsed = 0; elapsed < 42000; elapsed += 16.2) sequence.push(16.2);
    const first = api.replayVisualGovernor(sequence);
    const second = api.replayVisualGovernor(sequence);
    check(JSON.stringify(first) === JSON.stringify(second)
      && first.transitions.map(item => `${item.from}>${item.to}`).join(',')
        === 'full>balanced,balanced>lean,lean>balanced,balanced>full',
    'deterministic replay produces byte-stable transitions through degradation and recovery');
  }

  {
    const state = api.createVisualGovernorState();
    drive(api, state, 16.67, 6200);
    drive(api, state, 34, 19000);
    drive(api, state, 16.2, 45000);
    const transitions = state.transitionCount;
    drive(api, state, 20, 30000);
    check(state.tier === 0 && state.transitionCount === transitions,
    'stable recovery stays full without threshold flicker');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let passed = 0;
  const failures = [];
  runVisualGovernorTests((condition, message) => {
    if (condition) passed++;
    else failures.push(message);
  });
  if (failures.length) {
    failures.forEach(message => console.error(`  x ${message}`));
    process.exitCode = 1;
  } else {
    console.log(`VISUAL GOVERNOR GREEN - ${passed} deterministic checks passed`);
  }
}
