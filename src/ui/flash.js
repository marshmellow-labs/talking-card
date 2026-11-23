// Flash cards: one big card at a time, tap to hear, swipe or arrows to move.
// Category, card color, mix-up and auto-play live in the Filters sheet.
import { shuffle } from '../games.js';
import { say } from '../speech.js';
import { icon } from '../icons.js';
import { chipGroup, categoryOptions, colorOptions, CATEGORY_LABELS, COLOR_LABELS } from './chips.js';

const $ = id => document.getElementById(id);
let cards, list = [], i = 0, auto = null;
const filter = { category: '', color: '', mixed: false };

function render(dir = 0) {
  if (!list.length) return;
  const c = list[i], el = $('flashCard');
  el.className = 'flashcard ' + c.color;
  $('fcPic').replaceChildren(icon(c.emoji));
  $('fcWord').textContent = c.name;
  $('fcCat').textContent = c.category;
  $('fcCount').textContent = `${i + 1}/${list.length}`;
  if (dir) { el.style.setProperty('--dir', `${dir * 40}px`); el.classList.remove('slide'); void el.offsetWidth; el.classList.add('slide'); }
}

function summary() {
  const parts = [filter.category ? CATEGORY_LABELS[filter.category] : '🌈 All cards'];
  if (filter.color) parts.push(COLOR_LABELS[filter.color]);
  if (filter.mixed) parts.push('🔀');
  if (auto) parts.push('⏯');
  $('fcSummary').textContent = parts.join(' · ');
}

function rebuild() {
  let l = cards.filter(c => (!filter.category || c.category === filter.category) && (!filter.color || c.color === filter.color));
  if (!l.length) l = cards; // never show an empty deck
  list = filter.mixed ? shuffle(l) : l; i = 0; render(); summary();
}

function go(d) { if (!list.length) return; i = (i + d + list.length) % list.length; render(d); say(list[i].name); }
function setAuto(on) {
  clearInterval(auto); auto = null;
  if (on) auto = setInterval(() => go(1), 3500);
  $('fcAuto').setAttribute('aria-pressed', String(!!auto)); summary();
}

export function init(ctx) {
  cards = ctx.cards;
  chipGroup($('flashCats'), categoryOptions(cards), '', v => { filter.category = v; rebuild(); });
  chipGroup($('flashColors'), colorOptions(), '', v => { filter.color = v; rebuild(); });
  $('fcShuffle').onclick = () => { filter.mixed = !filter.mixed; $('fcShuffle').setAttribute('aria-pressed', String(filter.mixed)); rebuild(); };
  $('fcAuto').onclick = () => setAuto(!auto);
  $('fcFilters').onclick = () => $('fcSheet').showModal();
  $('fcSheet').addEventListener('close', () => { if (list.length) say(list[i].name); });
  // tap outside the sheet closes it
  $('fcSheet').addEventListener('click', e => { if (e.target === $('fcSheet')) $('fcSheet').close(); });
  rebuild();

  const el = $('flashCard');
  el.onclick = () => say(list[i].name);
  el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); say(list[i].name); } };
  $('fcSay').onclick = () => say(list[i].name);
  $('fcPrev').onclick = () => { setAuto(false); go(-1); };
  $('fcNext').onclick = () => { setAuto(false); go(1); };
  let x0 = null;
  el.addEventListener('pointerdown', e => { x0 = e.clientX; });
  el.addEventListener('pointerup', e => {
    if (x0 === null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { setAuto(false); go(dx < 0 ? 1 : -1); }
  });
  addEventListener('keydown', e => {
    if ($('flash').hidden || $('fcSheet').open) return;
    if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
  });
}

export function enter() { render(); summary(); }
export function leave() { setAuto(false); if ($('fcSheet').open) $('fcSheet').close(); }
