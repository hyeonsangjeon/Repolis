#!/usr/bin/env node
/**
 * Build the Contribution Library data for Repolis.
 *
 * Parses the Korean and English contribution markdown from
 * `hyeonsangjeon/Hyeonsang-AI-Contributions` into a deterministic static JSON
 * file (`assets/contribution-library.json`) that `index.html` loads at runtime.
 * This replaces the previously hand-maintained `LIBDATA` array.
 *
 * Source resolution (per language), first match wins:
 *   1. CLI arg   --ko=<path|url>  / --en=<path|url>
 *   2. env       LIB_KO_SRC       / LIB_EN_SRC
 *   3. local sibling checkout     ../Hyeonsang-AI-Contributions/README.md
 *   4. raw GitHub URL             https://raw.githubusercontent.com/.../README.md
 *
 * Output is stable (sorted nowhere — source order is preserved — 2-space
 * indented, trailing newline) so the daily workflow only commits real changes.
 *
 * Usage:
 *   node scripts/build-contribution-library.mjs
 *   node scripts/build-contribution-library.mjs --ko=../Hyeonsang-AI-Contributions/README.md
 *   LIB_EN_SRC=https://raw.githubusercontent.com/.../README-EN.md node scripts/build-contribution-library.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const LIBREPO = 'https://github.com/hyeonsangjeon/Hyeonsang-AI-Contributions';
const REPO_BLOB_BASE = LIBREPO + '/blob/main/';
const RAW_BASE = 'https://raw.githubusercontent.com/hyeonsangjeon/Hyeonsang-AI-Contributions/main/';

const SOURCE_URL = {
  ko: LIBREPO + '/blob/main/README.md',
  en: LIBREPO + '/blob/main/README-EN.md',
};

const OUT_PATH = join(REPO_ROOT, 'assets', 'contribution-library.json');

/* ---------------- source resolution ---------------- */
function argFor(lang) {
  const pref = '--' + lang + '=';
  const a = process.argv.find((x) => x.startsWith(pref));
  return a ? a.slice(pref.length) : null;
}
function resolveSource(lang, file) {
  const explicit = argFor(lang) || process.env['LIB_' + lang.toUpperCase() + '_SRC'];
  if (explicit) return explicit;
  const sibling = resolve(REPO_ROOT, '..', 'Hyeonsang-AI-Contributions', file);
  if (existsSync(sibling)) return sibling;
  return RAW_BASE + file;
}
async function loadSource(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { headers: { 'User-Agent': 'repolis-library-build' } });
    if (!res.ok) throw new Error('fetch failed ' + res.status + ' for ' + src);
    return await res.text();
  }
  return await readFile(src, 'utf8');
}

/* ---------------- parsing helpers ---------------- */

// Split a "## 📑 Title" heading into its leading emoji icon and the title text.
function splitIcon(heading) {
  const m = heading.match(/^(\p{Extended_Pictographic}[\u200d\ufe0f\p{Extended_Pictographic}]*)\s*(.*)$/u);
  if (m) return { icon: m[1].trim(), title: m[2].trim() };
  return { icon: '', title: heading.trim() };
}

// Extract every markdown link in order. Tolerates `[t] (url)` (stray space) and
// one level of nested brackets inside the url part (malformed `[a]([b](c))`).
function extractLinks(text) {
  const links = [];
  const re = /\[([^\]]*)\]\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) links.push({ text: m[1], raw: m[2] });
  return links;
}

// Turn a raw link target into a usable absolute URL, or '' when unusable.
function cleanUrl(raw) {
  if (!raw) return '';
  let u = raw.trim();
  if (!u) return '';
  const https = u.match(/https?:\/\/[^\s)\]]+/g);
  if (https && https.length) return https[https.length - 1]; // last real URL wins (handles nested mess)
  // relative repo path, e.g. assets/social-contributions/foo.pdf
  if (/^[\w./#-]+$/.test(u)) return REPO_BLOB_BASE + u.replace(/^\.?\//, '');
  return '';
}

// Remove all markdown link syntax (and orphan leftovers) from a string.
function stripLinks(text) {
  let t = text.replace(/\[([^\]]*)\]\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g, '');
  t = t.replace(/\]\s*\([^)]*\)/g, ''); // orphan ](...)
  t = t.replace(/\[[^\]]*\]/g, ''); // orphan [text]
  return t;
}

// Drop bold/italic/code markers but keep the inner text.
function stripEmphasis(text) {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*+/g, '');
}

const QUOTES = '"\u201c\u201d\u2018\u2019\u300c\u300d';
function stripQuotes(text) {
  let t = text.trim();
  // strip one matching pair of leading/trailing quote-like chars, repeatedly
  for (let i = 0; i < 3; i++) {
    const m = t.match(new RegExp('^[' + QUOTES + "']([\\s\\S]*)[" + QUOTES + "']$"));
    if (!m) break;
    t = m[1].trim();
  }
  return t;
}

// Tidy a meta/description fragment.
function cleanMeta(text) {
  let t = stripEmphasis(stripLinks(text));
  t = t.replace(/\s+/g, ' ').trim();
  // strip leading separators / authorship comma left behind by title removal
  t = t.replace(/^[\s,.;:·\-–—)\]]+/, '');
  t = t.replace(/[\s,;:·\-–—([]+$/, '');
  // a lone trailing ) left by a malformed nested link (only when unbalanced)
  if (/\)\s*$/.test(t) && !t.includes('(')) t = t.replace(/\s*\)\s*$/, '');
  return t.trim();
}

// strip a leading owner author token (the one piece of noise in non-bold items)
function stripLeadAuthor(text) {
  return text.replace(/^\s*(?:전현상|Hyeonsang\s+Jeon)\s*(?:et al\.?)?\s*,\s*/i, '');
}

// Find the title span (bold > quoted) and return {inner, before, after} or null.
function findTitleSpan(text) {
  const bold = text.match(/\*\*\s*([\s\S]+?)\s*\*\*/);
  if (bold) {
    return {
      inner: bold[1],
      before: text.slice(0, bold.index),
      after: text.slice(bold.index + bold[0].length),
    };
  }
  const quoted = text.match(new RegExp('[' + QUOTES + ']([^' + QUOTES + ']+)[' + QUOTES + ']'));
  if (quoted) {
    return {
      inner: quoted[1],
      before: text.slice(0, quoted.index),
      after: text.slice(quoted.index + quoted[0].length),
    };
  }
  return null;
}

// Build one {title, meta, url} item from a raw list-item string.
function finalizeItem(raw) {
  const links = extractLinks(raw);
  let url = '';
  for (const l of links) {
    const u = cleanUrl(l.raw);
    if (u) { url = u; break; }
  }
  const text = stripLinks(raw).trim();

  const span = findTitleSpan(text);
  let title = '';
  let meta = '';
  if (span) {
    title = stripQuotes(stripEmphasis(span.inner));
    const after = cleanMeta(span.after);
    meta = after || cleanMeta(span.before);
  } else {
    // no bold/quote: split on the first italic venue if present, else all-title
    const ital = text.match(/\*([^*]+)\*/);
    const body = stripLeadAuthor(text);
    if (ital && ital.index != null) {
      const cut = body.indexOf('*');
      if (cut > 0) {
        title = cleanMeta(body.slice(0, cut));
        meta = cleanMeta(body.slice(cut));
      } else {
        title = cleanMeta(body);
      }
    } else {
      title = cleanMeta(body);
    }
  }
  title = title.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  return { title, meta, url };
}

// Parse a full markdown document into [{icon, title, items:[...]}].
function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const categories = [];
  let cur = null;
  let pending = null;
  const flush = () => {
    if (cur && pending && pending.trim()) {
      const it = finalizeItem(pending);
      if (it) cur.items.push(it);
    }
    pending = null;
  };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*\S)\s*$/);
    if (h2) {
      flush();
      const { icon, title } = splitIcon(h2[1].trim());
      cur = { icon, title, items: [] };
      categories.push(cur);
      continue;
    }
    if (!cur) continue;
    const marker = line.match(/^\s*(?:\d+\.|[-*])\s+(.*)$/);
    if (marker) {
      flush();
      pending = marker[1];
    } else if (pending != null) {
      const cont = line.trim();
      if (cont) pending += ' ' + cont;
    }
  }
  flush();
  return categories.filter((c) => c.items.length);
}

/* ---------------- main ---------------- */
async function buildLang(lang, file) {
  const src = resolveSource(lang, file);
  const md = await loadSource(src);
  const categories = parseMarkdown(md);
  const count = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`  ${lang}: ${categories.length} categories, ${count} items  (src: ${src})`);
  return { categories };
}

async function main() {
  console.log('Building contribution library JSON…');
  const ko = await buildLang('ko', 'README.md');
  const en = await buildLang('en', 'README-EN.md');

  const data = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_URL,
    repo: LIBREPO,
    ko,
    en,
  };

  // Deterministic w.r.t. content: if only the timestamp would change, keep the
  // previous generatedAt so the daily "commit if changed" workflow doesn't churn
  // a fresh commit every single day when no contribution actually changed.
  try {
    const prev = JSON.parse(await readFile(OUT_PATH, 'utf8'));
    const sansTs = (o) => { const c = { ...o }; delete c.generatedAt; return JSON.stringify(c); };
    if (sansTs(prev) === sansTs(data)) data.generatedAt = prev.generatedAt;
  } catch { /* no readable previous output → keep the fresh timestamp */ }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Wrote ' + OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
