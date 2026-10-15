// One classic look for everything that deals with stable-coin (ICEC-S) pricing: the admin's
// Stable price tab, the supplier's, the Price Analyst, and the small chips on product cards.
//
// "Classic" here is the portals' own ledger look: ivory + navy ink + antique gold in light, and
// deep green + cream + gold in dark. In this app's dark mode the PAGE stays cream while panels go
// deep green, so every surface here carries its own background and its own text colours instead
// of inheriting them: it reads the same on either page background, and never depends on the
// portal stylesheet's Tailwind remaps (which only cover some colour families).
//
// Everything is driven by the token tables below, which are the single source for the CSS and for
// the contrast test (tests/stableCoinTheme.test.js), so a colour can't be changed without that
// test re-checking it.

export const STABLE_COIN_TOKENS = {
  light: {
    bg: '#fbf8f1', // panel surface (ivory)
    card: '#ffffff',
    ink: '#14213d', // headings, primary button
    text: '#1f2937',
    muted: '#566074',
    line: '#e0d6bd',
    gold: '#785c10', // gold used AS TEXT must stay readable on ivory and on the soft-gold chip
    goldLine: '#b8912f', // decorative rules only; never the only cue
    focus: '#14213d', // keyboard focus ring (needs 3:1)
    goldSoft: '#f4ead0',
    accent: '#17603f', // stable-coin green, as text
    accentSoft: '#e1f1e8',
    chart: '#1f7a50',
    warnBg: '#fdf0d9',
    warnFg: '#7a4204',
    badBg: '#f8e8ea',
    badFg: '#7a1f2b',
    infoBg: '#e6edfb',
    infoFg: '#1e3a8a',
    inputBg: '#ffffff',
    primaryBg: '#14213d',
    primaryFg: '#ffffff',
    onBg: '#f4ead0', // a pressed / selected button
    onFg: '#14213d',
  },
  dark: {
    bg: '#0f2a20',
    card: '#0c231b',
    ink: '#f5ecd0',
    text: '#ecfdf5',
    muted: '#9fb8ad',
    line: '#35503f',
    gold: '#f5dfa0',
    goldLine: '#b8912f',
    focus: '#f5dfa0',
    goldSoft: '#2b3a22',
    accent: '#86efac',
    accentSoft: '#12372a',
    chart: '#4ade80',
    warnBg: '#3a2c10',
    warnFg: '#fcd34d',
    badBg: '#40161c',
    badFg: '#fca5a5',
    infoBg: '#14305a',
    infoFg: '#bfdbfe',
    inputBg: '#0a1f18',
    primaryBg: '#c9a13b',
    primaryFg: '#14213d',
    onBg: '#3a3a1c',
    onFg: '#f5ecd0',
  },
};

// The supplier portal's own classic look is ivory / gold / INDIGO (styles/supplier-classic.css), the admin's is navy.
// Only what differs is listed; `.sc-supplier` on the root switches to it.
export const SUPPLIER_OVERRIDES = {
  light: { bg: '#faf8f3', ink: '#1e1b4b', primaryBg: '#312e81', onBg: '#312e81', onFg: '#ffffff', infoFg: '#3730a3', focus: '#312e81' },
  dark: { primaryBg: '#4338ca', primaryFg: '#ffffff', onBg: '#4338ca', onFg: '#ffffff' },
};

export const resolvedTokens = (mode, supplier = false) => ({ ...STABLE_COIN_TOKENS[mode], ...(supplier ? SUPPLIER_OVERRIDES[mode] : {}) });

const vars = (t) => Object.entries(t).map(([k, v]) => `--sc-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`).join(' ');

export const STABLE_COIN_CSS = `
/* .sc-root is a whole panel; .sc-scope is just the colours, for a button or chip that sits on the page by itself */
.sc-root, .sc-scope { ${vars(STABLE_COIN_TOKENS.light)} }
.sc-root.sc-supplier, .sc-scope.sc-supplier { ${vars(SUPPLIER_OVERRIDES.light)} }
[data-theme='dark'] .sc-root, [data-theme='dark'] .sc-scope { ${vars(STABLE_COIN_TOKENS.dark)} }
[data-theme='dark'] .sc-root.sc-supplier, [data-theme='dark'] .sc-scope.sc-supplier { ${vars(SUPPLIER_OVERRIDES.dark)} }

/* surfaces */
.sc-root { background: var(--sc-bg); color: var(--sc-text); border: 1px solid var(--sc-line); border-top: 2px solid var(--sc-gold-line); border-radius: 4px; }
.sc-card { background: var(--sc-card); color: var(--sc-text); border: 1px solid var(--sc-line); border-top: 2px solid var(--sc-gold-line); border-radius: 3px; }
.sc-flat { background: var(--sc-card); color: var(--sc-text); border: 1px solid var(--sc-line); border-radius: 3px; }
.sc-rule { border-color: var(--sc-line); }
.sc-divide > :not([hidden]) ~ :not([hidden]) { border-top: 1px solid var(--sc-line); }

/* text */
.sc-title { color: var(--sc-ink); }
.sc-text { color: var(--sc-text); }
.sc-muted { color: var(--sc-muted); }
.sc-gold { color: var(--sc-gold); }
.sc-up { color: var(--sc-warn-fg); }
.sc-good { color: var(--sc-accent); }
.sc-bad { color: var(--sc-bad-fg); }
.sc-link { color: var(--sc-ink); text-decoration: underline; background: none; border: 0; cursor: pointer; padding: 0; }

/* fields and buttons */
.sc-input { background: var(--sc-input-bg); color: var(--sc-text); border: 1px solid var(--sc-line); }
.sc-input::placeholder { color: var(--sc-muted); opacity: .8; }
.sc-input:focus { outline: 2px solid var(--sc-focus); outline-offset: 1px; }
.sc-btn { border: 1px solid var(--sc-line); background: var(--sc-card); color: var(--sc-ink); cursor: pointer; transition: background-color .15s, border-color .15s, transform .12s; }
/* hover tints a plain button only: a selected (on) or primary button keeps its own colours, or its text would vanish */
.sc-btn:not(:disabled):not(.sc-btn-on):not(.sc-btn-primary):hover { border-color: var(--sc-gold-line); background: var(--sc-gold-soft); color: var(--sc-ink); }
.sc-btn-on:not(:disabled):hover { border-color: var(--sc-gold-line); filter: brightness(1.06); }
.sc-btn:not(:disabled):active { transform: scale(.98); }
.sc-btn:disabled { opacity: .45; cursor: not-allowed; }
.sc-btn:focus-visible, .sc-link:focus-visible, .sc-check:focus-visible { outline: 2px solid var(--sc-focus); outline-offset: 2px; }
.sc-btn-sm { min-height: 32px; padding: 0 .6rem; font-size: 12.5px; }
.sc-btn-primary { background: var(--sc-primary-bg); color: var(--sc-primary-fg); border-color: var(--sc-primary-bg); }
.sc-btn-primary:not(:disabled):hover { background: var(--sc-primary-bg); border-color: var(--sc-gold-line); filter: brightness(1.08); }
/* phone first: comfortable tap targets, and 16px inputs so iOS doesn't zoom on focus (the supplier portal's rule) */
.sc-btn { min-height: 40px; padding-left: .75rem; padding-right: .75rem; font-weight: 600; font-size: 14px; }
.sc-input { min-height: 40px; font-size: 16px; border-radius: 4px; }
.sc-supplier .sc-btn, .sc-supplier .sc-input { min-height: 44px; }
.sc-supplier .sc-btn { border-radius: 12px; }
.sc-supplier.sc-root { border-radius: 18px; border-top-width: 1px; }
.sc-supplier .sc-card, .sc-supplier .sc-flat { border-radius: 14px; border-top-width: 1px; }
.sc-title-serif { font-family: "Playfair Display", Georgia, "Times New Roman", serif; font-variant-numeric: lining-nums tabular-nums; }
.sc-btn-on { background: var(--sc-on-bg); color: var(--sc-on-fg); border-color: var(--sc-gold-line); }
.sc-check { accent-color: var(--sc-gold-line); }
.sc-range { accent-color: var(--sc-gold-line); }

/* pills: icon + words, never colour alone */
.sc-pill { display: inline-flex; align-items: center; gap: .25rem; border-radius: 999px; padding: .125rem .5rem; font-size: 11px; font-weight: 600; line-height: 1.25; border: 1px solid transparent; white-space: nowrap; }
.sc-pill-ok { background: var(--sc-accent-soft); color: var(--sc-accent); border-color: color-mix(in srgb, var(--sc-accent) 30%, transparent); }
.sc-pill-warn { background: var(--sc-warn-bg); color: var(--sc-warn-fg); border-color: color-mix(in srgb, var(--sc-warn-fg) 30%, transparent); }
.sc-pill-bad { background: var(--sc-bad-bg); color: var(--sc-bad-fg); border-color: color-mix(in srgb, var(--sc-bad-fg) 30%, transparent); }
.sc-pill-info { background: var(--sc-info-bg); color: var(--sc-info-fg); border-color: color-mix(in srgb, var(--sc-info-fg) 30%, transparent); }
.sc-pill-gold { background: var(--sc-gold-soft); color: var(--sc-gold); border-color: color-mix(in srgb, var(--sc-gold) 35%, transparent); }
.sc-pill-plain { background: var(--sc-card); color: var(--sc-muted); border-color: var(--sc-line); }

/* the "something changed" notice */
.sc-notice { background: var(--sc-warn-bg); color: var(--sc-warn-fg); border: 1px solid color-mix(in srgb, var(--sc-warn-fg) 40%, transparent); border-left: 4px solid var(--sc-warn-fg); border-radius: 3px; }
.sc-notice .sc-notice-text { color: var(--sc-warn-fg); }
.sc-notice .sc-notice-sub { color: var(--sc-text); }
.sc-note { background: var(--sc-info-bg); color: var(--sc-info-fg); border: 1px solid color-mix(in srgb, var(--sc-info-fg) 35%, transparent); border-radius: 3px; }
.sc-badge-count { background: #b91c1c; color: #fff; }

/* chart */
.sc-svg-grid { stroke: var(--sc-line); }
.sc-svg-axis { fill: var(--sc-muted); }
.sc-svg-line { stroke: var(--sc-chart); fill: none; }
.sc-svg-dot { fill: var(--sc-chart); stroke: var(--sc-card); }
.sc-svg-cross { stroke: var(--sc-muted); }
.sc-tooltip { background: var(--sc-card); color: var(--sc-text); border: 1px solid var(--sc-line); }

@media (prefers-reduced-motion: reduce) { .sc-btn { transition: none; } }
`;
