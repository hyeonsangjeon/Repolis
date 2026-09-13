#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

# This is the single command list used locally and by the read-only PR gate.
set -x
node council/test.mjs
node council/test-live.mjs
node scripts/smoke.mjs
node scripts/test-visual-governor.mjs
node scripts/test-portable-town.mjs
python3 scripts/test_city_state.py
python3 scripts/validate_city_state.py
python3 scripts/test_fork_lineage.py
node scripts/test-city-time.mjs
node scripts/test-session-footprints.mjs
node scripts/test-procedural-surfaces.mjs
node scripts/test-fork-lineage.mjs
node scripts/test-repository-atelier-chat.mjs
node scripts/test-repository-blueprint.mjs
node scripts/test-issue-code-scout.mjs
node scripts/validate-lore-fragments.mjs
node --check scholars.js
node --check cloudflare-taxi/src/grounded.js
node --check cloudflare-taxi/src/taxi-boundary.js
node --check assets/repo-route.js
node --check assets/contribution-quests.js
node --check assets/issue-code-scout.js
node scripts/test-first-visit.mjs
node --check scripts/test-first-visit-browser.mjs
