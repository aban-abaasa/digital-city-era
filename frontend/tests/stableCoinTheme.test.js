import test from 'node:test';
import assert from 'node:assert/strict';
import { STABLE_COIN_TOKENS, STABLE_COIN_CSS, SUPPLIER_OVERRIDES, resolvedTokens } from '../src/styles/stableCoinTheme.js';

// WCAG 2.x contrast ratio between two #rrggbb colours.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Every foreground/background pair the stylesheet actually puts together. Small text (the pills are 11px) needs 4.5:1.
const TEXT_PAIRS = [
  ['text', 'bg'], ['text', 'card'], ['muted', 'bg'], ['muted', 'card'], ['ink', 'bg'], ['ink', 'card'],
  ['gold', 'bg'], ['gold', 'card'], ['gold', 'goldSoft'], ['accent', 'bg'], ['accent', 'card'], ['accent', 'accentSoft'],
  ['warnFg', 'warnBg'], ['text', 'warnBg'], ['badFg', 'badBg'], ['infoFg', 'infoBg'], ['text', 'inputBg'],
  ['muted', 'inputBg'], ['primaryFg', 'primaryBg'], ['onFg', 'onBg'], ['ink', 'goldSoft'], ['badFg', 'card'], ['warnFg', 'bg'], ['accent', 'warnBg'], ['gold', 'warnBg'], ['muted', 'warnBg'],
];
// Lines and chart marks only need 3:1 against the surface they sit on.
const GRAPHIC_PAIRS = [['chart', 'card'], ['focus', 'bg'], ['focus', 'card'], ['muted', 'card']];

for (const [mode, supplier] of [['light', false], ['dark', false], ['light', true], ['dark', true]]) {
  const label = `${mode}${supplier ? ' (supplier)' : ''}`;
  test(`${label}: every text colour pair is readable (WCAG AA, 4.5:1)`, () => {
    const t = resolvedTokens(mode, supplier);
    const failures = TEXT_PAIRS.map(([fg, bg]) => [fg, bg, contrast(t[fg], t[bg])]).filter(([, , c]) => c < 4.5);
    assert.deepEqual(failures.map(([fg, bg, c]) => `${fg} on ${bg} = ${c.toFixed(2)}`), []);
  });
  test(`${label}: chart line and focus ring are visible (3:1)`, () => {
    const t = resolvedTokens(mode, supplier);
    const failures = GRAPHIC_PAIRS.map(([fg, bg]) => [fg, bg, contrast(t[fg], t[bg])]).filter(([, , c]) => c < 3);
    assert.deepEqual(failures.map(([fg, bg, c]) => `${fg} on ${bg} = ${c.toFixed(2)}`), []);
  });
}

test('light and dark define exactly the same tokens, and every token reaches the CSS', () => {
  assert.deepEqual(Object.keys(STABLE_COIN_TOKENS.light).sort(), Object.keys(STABLE_COIN_TOKENS.dark).sort());
  for (const key of Object.keys(STABLE_COIN_TOKENS.light)) {
    const name = `--sc-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    assert.ok(STABLE_COIN_CSS.includes(`${name}:`), `${name} is declared`);
  }
});

test('the dark theme is keyed off the app-wide data-theme attribute and scoped to .sc-root', () => {
  assert.ok(STABLE_COIN_CSS.includes("[data-theme='dark'] .sc-root, [data-theme='dark'] .sc-scope {"));
  // every var(--sc-*) used is a declared token (a typo would silently render as "unset")
  const declared = new Set(Object.keys(STABLE_COIN_TOKENS.light).map((k) => `--sc-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`));
  const used = [...STABLE_COIN_CSS.matchAll(/var\((--sc-[a-z-]+)\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(used)].filter((v) => !declared.has(v)), []);
});

test('the supplier flavour only overrides tokens that exist', () => {
  for (const mode of ['light', 'dark']) {
    assert.deepEqual(Object.keys(SUPPLIER_OVERRIDES[mode]).filter((k) => !(k in STABLE_COIN_TOKENS[mode])), []);
  }
  assert.ok(STABLE_COIN_CSS.includes("[data-theme='dark'] .sc-root.sc-supplier, [data-theme='dark'] .sc-scope.sc-supplier {"));
});

test('hovering a selected or primary button cannot change its background (it would hide its text)', () => {
  // every hover rule on .sc-btn must exclude the buttons whose text colour is set against their own background
  const hoverRules = STABLE_COIN_CSS.split('\n').filter((l) => /^\.sc-btn[^{]*:hover[^{]*\{[^}]*background/.test(l));
  assert.ok(hoverRules.length > 0);
  for (const rule of hoverRules) {
    if (rule.startsWith('.sc-btn-on') || rule.startsWith('.sc-btn-primary')) continue; // these set no background colour change
    assert.ok(rule.includes(':not(.sc-btn-on)') && rule.includes(':not(.sc-btn-primary)'), `unsafe hover rule: ${rule.slice(0, 90)}`);
  }
});
