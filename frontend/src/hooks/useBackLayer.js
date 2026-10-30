import { useEffect, useRef } from 'react';

// Phone Back button support for screens that aren't routes (sub-tabs, menu
// sheets, modals, dialogs).
//
// Every such "deeper" screen is a *layer*: while it is showing it owns one
// browser-history entry. The phone's Back button (or the browser's) pops that
// entry and the layer closes itself instead of the whole page navigating away.
// When the app closes a layer by itself (an X button, an in-app back arrow) its
// entry is removed again so history never drifts out of step with the screen.
//
// Routes are left to React Router: it pushes its own entries on top of ours, so
// a layer whose screen unmounts because the route changed is simply left behind
// as a hidden entry, and Back skips over it.

// Date-seeded so ids from before a page reload (still stored in history.state) are always older than new ones.
let nextId = Date.now();
const stack = [];
const pending = [];
let ignorePops = 0;
let ignoreTimer;
let listening = false;

const stateId = () => {
  const s = window.history.state;
  return s && typeof s.mbgLayer === 'number' ? s.mbgLayer : 0;
};

function push(layer) {
  window.history.pushState({ ...(window.history.state ?? {}), mbgLayer: layer.id }, '');
  stack.push(layer);
}

function flushPending() {
  while (pending.length && ignorePops === 0) push(pending.shift());
}

// Move history back n entries *without* treating the popstate as a user Back press.
function silentBack(n) {
  if (n <= 0) return;
  ignorePops++;
  window.history.go(-n);
  // If the browser never reports the pop (nothing to go back to), don't wedge new layers forever.
  clearTimeout(ignoreTimer);
  ignoreTimer = setTimeout(() => { ignorePops = 0; flushPending(); }, 600);
}

function onPopState() {
  if (ignorePops > 0) {
    ignorePops--;
    if (ignorePops === 0) { clearTimeout(ignoreTimer); flushPending(); }
    return;
  }
  const target = stateId();
  const top = stack[stack.length - 1];

  // Forward onto an entry that no longer has a layer — bounce straight back.
  if (target > (top ? top.id : 0)) { silentBack(1); return; }

  // Close every layer opened after the entry we landed on (a multi-step Back closes several).
  const closing = [];
  while (stack.length && stack[stack.length - 1].id > target) closing.push(stack.pop());
  closing.forEach((l) => { if (!l.dead) l.close(); });

  // Landed on an entry whose layer was already closed by the app: keep going back.
  const landed = stack[stack.length - 1];
  if (landed && landed.id === target && landed.dead) { stack.pop(); window.history.back(); }
}

function makeLayer(close) {
  return { id: nextId++, close, dead: false };
}

function open(layer) {
  if (!listening) { window.addEventListener('popstate', onPopState); listening = true; }
  if (ignorePops > 0) pending.push(layer); else push(layer);
}

function shut(layer) {
  const queued = pending.indexOf(layer);
  if (queued !== -1) { pending.splice(queued, 1); return; }
  const i = stack.indexOf(layer);
  if (i === -1) return; // already popped by the user's Back
  const above = stack.slice(i + 1);
  // We may only step back if the entry we are standing on is this stack's newest one.
  // If the router pushed a route on top meanwhile, stepping back would undo that navigation.
  if (above.every((l) => l.dead) && stateId() === stack[stack.length - 1].id) {
    // Nothing visible above it: remove its entry, any invisible ones above, and any invisible
    // ones now exposed beneath, in one silent step.
    stack.splice(i);
    let n = 1 + above.length;
    while (stack.length && stack[stack.length - 1].dead) { stack.pop(); n++; }
    silentBack(n);
  } else {
    layer.dead = true; // its entry is left behind, hidden
  }
}

/**
 * While `active` is true the phone/browser Back button calls `onBack` (which
 * should set `active` to false) instead of leaving the page.
 */
export function useBackLayer(active, onBack) {
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!active) return undefined;
    const layer = makeLayer(() => handler.current());
    open(layer);
    return () => shut(layer);
  }, [active]);
}
