// App shell: loads data, routes between screens (#/scan, #/flash, #/play, #/parent), applies the theme.
import { store } from './store.js';
import { loadSprite, icon } from './icons.js';
import { totalStars } from './games.js';
import * as scan from './ui/scan.js';
import * as flash from './ui/flash.js';
import * as play from './ui/play.js';
import * as parent from './ui/parent.js';

const $ = id => document.getElementById(id);
const screens = { home: null, scan, flash, play, parent };
const titles = { home: 'Talking Cards', scan: 'Scan a card', flash: 'Flash cards', play: 'Find it!', parent: 'Grown-ups' };
export const THEMES = {
  sunny: { label: 'Sunny', bar: '#ffb347' },
  space: { label: 'Space', bar: '#2b2360' },
  jungle: { label: 'Jungle', bar: '#3d9a4b' },
  candy: { label: 'Candy', bar: '#ff8fc7' },
};
let current = null;

function route() {
  const name = (location.hash.match(/^#\/(\w+)/)?.[1]) ?? 'home';
  const next = name in screens ? name : 'home';
  if (next === current) return;
  if (current) screens[current]?.leave?.();
  for (const id of Object.keys(screens)) $(id).hidden = id !== next;
  $('homeBtn').hidden = next === 'home';
  $('titleText').textContent = titles[next];
  $('parentHold').hidden = next === 'parent';
  current = next;
  screens[next]?.enter?.();
}

let shownStars = null;
function showStars() {
  const n = totalStars(store.get().stars), el = $('stars');
  el.querySelector('b').textContent = n;
  if (shownStars !== null && n > shownStars) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  shownStars = n;
}

export function applyTheme(name = store.get().settings.theme) {
  const t = THEMES[name] ? name : 'sunny';
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = THEMES[t].bar;
}

let toastTimer = 0;
export function toast(text, ms = 1800) {
  const t = $('toast'); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** Grown-ups area opens after a 2 second press, so little fingers don't wander in. */
function holdToOpen(btn, ms = 2000) {
  let t0 = 0, raf = 0, opened = false;
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / ms); btn.style.setProperty('--p', p);
    if (p >= 1) { opened = true; reset(); location.hash = '#/parent'; } else raf = requestAnimationFrame(tick);
  };
  const reset = () => { cancelAnimationFrame(raf); raf = 0; btn.style.setProperty('--p', 0); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); opened = false; t0 = performance.now(); raf = requestAnimationFrame(tick); });
  const release = () => {
    if (raf && !opened && performance.now() - t0 < ms) toast('Grown-ups: press and hold ⚙️');
    reset();
  };
  btn.addEventListener('pointerup', release);
  ['pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, reset));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

async function init() {
  // ?theme=space opens the app in that look (handy for comparing looks from a link)
  const asked = new URLSearchParams(location.search).get('theme');
  if (THEMES[asked]) store.setting('theme', asked);
  applyTheme();
  const cards = await (await fetch('./cards.json')).json();
  await loadSprite();
  document.querySelectorAll('[data-icon]').forEach(el => el.replaceChildren(icon(el.dataset.icon)));
  const ctx = { cards, applyTheme, toast, themes: THEMES };
  for (const s of [scan, flash, play, parent]) s.init(ctx);
  $('homeBtn').onclick = () => { location.hash = '#/'; };
  holdToOpen($('parentHold'));
  store.on(showStars); showStars();
  addEventListener('hashchange', route); route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init().catch(e => { document.querySelector('main').textContent = 'Sorry, the app could not start: ' + e.message; });
