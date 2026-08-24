#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LORE_FRAGMENT_LIMITS,
  validateLoreFragments,
} from '../assets/lore-fragments.js';

const path = resolve(process.argv[2] || 'data/lore/fragments.json');
const source = readFileSync(path, 'utf8');
const parsed = JSON.parse(source);
const lore = validateLoreFragments(parsed, source);

if (!lore) {
  console.error('lore fragments invalid');
  process.exit(1);
}
if (statSync(path).size > LORE_FRAGMENT_LIMITS.maxBytes) {
  console.error('lore fragment file exceeds byte cap');
  process.exit(1);
}
console.log(`lore fragments valid: fragments=${lore.fragments.length} bytes=${statSync(path).size}`);
