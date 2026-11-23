// App shell: loads data, routes between screens (#/scan, #/flash, #/play, #/parent).
import { store } from './store.js';
import { loadSprite } from './icons.js';
import { totalStars } from './games.js';
import * as scan from './ui/scan.js';
import * as flash from './ui/flash.js';
import * as play from './ui/play.js';
import * as parent from './ui/parent.js';

const $ = id => document.getElementById(id);
const screens = { home: null, scan, flash, play, parent };
const titles = { home: 'Talking Cards', scan: 'Scan a card', flash: 'Flash cards', play: 'Find it!', parent: 'Grown-ups' };
let current = null;

function route() {
  const name = (location.hash.match(/^#\/(\w+)/)?.[1]) ?? 'home';
  const next = name in screens ? name : 'home';
  if (next === current) return;
  if (current) screens[current]?.leave?.();
  for (const id of Object.keys(screens)) $(id).hidden = id !== next;
  $('homeBtn').hidden = next === 'home';
  $('title').textContent = titles[next];
  current = next;
  screens[next]?.enter?.();
  window.scrollTo(0, 0);
}

function showStars() { $('stars').querySelector('b').textContent = totalStars(store.get().stars); }

/** Grown-ups area opens after a 2 second press, so little fingers don't wander in. */
function holdToOpen(btn, ms = 2000) {
  let t0 = 0, raf = 0;
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / ms); btn.style.setProperty('--p', p);
    if (p >= 1) { reset(); location.hash = '#/parent'; } else raf = requestAnimationFrame(tick);
  };
  const reset = () => { cancelAnimationFrame(raf); btn.style.setProperty('--p', 0); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(tick); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, reset));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

async function init() {
  const cards = await (await fetch('./cards.json')).json();
  await loadSprite();
  const ctx = { cards };
  for (const s of [scan, flash, play, parent]) s.init(ctx);
  $('homeBtn').onclick = () => { location.hash = '#/'; };
  holdToOpen($('parentHold'));
  store.on(showStars); showStars();
  addEventListener('hashchange', route); route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init().catch(e => { document.querySelector('main').textContent = 'Sorry, the app could not start: ' + e.message; });
