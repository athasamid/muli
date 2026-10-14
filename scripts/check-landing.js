#!/usr/bin/env node
/**
 * Structural sanity check for the landing page.
 *
 * The landing page has no build step and no test framework, so this guards the
 * one class of defect that has actually bitten it: hand-edits that leave the
 * document structure subtly wrong while still rendering correctly. A bare
 * `/main>` in place of `</main>`, for example, is invisible in a browser —
 * the parser recovers and the page looks perfect — but ships broken markup.
 *
 * Scope: structure only. It does not check copy, colour or layout; those are
 * verified by measuring the rendered page, not by reading the source.
 *
 * Usage: node scripts/check-landing.js   (exit 0 = pass, 1 = fail)
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'landing', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');

const failures = [];
const notes = [];

/** Strip comments, <style> and <script> bodies so their contents are not parsed as markup. */
function markup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

const doc = markup(html);

// --- 1. Required document landmarks are present exactly once -----------------
for (const tag of ['html', 'head', 'body', 'main', 'footer', 'header']) {
  const open = (doc.match(new RegExp(`<${tag}(\\s|>)`, 'gi')) || []).length;
  const close = (doc.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (open !== 1) failures.push(`<${tag}> opens ${open}x, expected exactly 1`);
  if (close !== 1) failures.push(`</${tag}> closes ${close}x, expected exactly 1`);
}

// --- 2. The specific defect class: a truncated close tag -------------------
// A stray `/main>` means a previous edit's slice length was off by one and ate
// the `<`. The parser hides it, so it has to be asserted.
const bare = doc.match(/(?<!<)\/[a-z][a-z0-9]*\s*>/gi);
if (bare) failures.push(`stray close-tag fragment(s) with no opening "<": ${bare.join(' ')}`);

// --- 3. Tag balance for every element that can nest -------------------------
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);
const stack = [];
const tagRe = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi;
let m;
while ((m = tagRe.exec(doc)) !== null) {
  const [, closing, name, selfClose] = m;
  const lower = name.toLowerCase();
  if (VOID.has(lower) || selfClose === '/') continue;
  if (closing === '/') {
    const top = stack.pop();
    if (top === undefined) {
      failures.push(`</${lower}> closes with nothing open`);
    } else if (top !== lower) {
      failures.push(`</${lower}> closes <${top}> (mismatched nesting)`);
    }
  } else {
    stack.push(lower);
  }
}
if (stack.length) failures.push(`unclosed element(s) at EOF: ${stack.join(' > ')}`);

// --- 4. Accessibility basics the page depends on ---------------------------
if (!/class="skip"/.test(html)) {
  failures.push('skip link missing — it must be the first focusable element');
}
if (!/id="main"/.test(html)) {
  failures.push('no id="main": the skip link has no target');
}
const h1 = (doc.match(/<h1\b/gi) || []).length;
if (h1 !== 1) failures.push(`page has ${h1} <h1> elements, expected exactly 1`);

for (const mm of doc.matchAll(/<svg\b[^>]*>/gi)) {
  if (!/aria-hidden="true"/.test(mm[0])) {
    const line = html.slice(0, mm.index).split('\n').length;
    failures.push(`line ${line}: decorative <svg> without aria-hidden="true"`);
  }
}

// --- 5. The self-hosted fonts referenced by @font-face must exist -----------
// Scanned against the raw file, not `doc`: @font-face lives inside <style>,
// which markup() strips out.
for (const mm of html.matchAll(/url\(["']?(fonts\/[^"')]+)["']?\)/g)) {
  const p = path.join(path.dirname(FILE), mm[1]);
  if (!fs.existsSync(p)) failures.push(`@font-face references missing file: ${mm[1]}`);
}

// --- 6. Internal anchors must resolve ---------------------------------------
for (const mm of html.matchAll(/href="#([^"]+)"/g)) {
  const id = mm[1];
  if (!new RegExp(`id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html)) {
    failures.push(`link to #${id} has no matching id`);
  }
}

// --- 7. External links in new tabs need rel="noopener" ----------------------
for (const mm of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
  if (!/rel="[^"]*noopener/.test(mm[0])) {
    const line = html.slice(0, mm.index).split('\n').length;
    failures.push(`line ${line}: target="_blank" without rel="noopener"`);
  }
}

// --- Report ----------------------------------------------------------------
const rel = path.relative(path.join(__dirname, '..'), FILE);
if (failures.length) {
  console.error(`FAIL ${rel}\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}
console.log(`PASS ${rel}`);
for (const n of notes) console.log(`  note: ${n}`);
