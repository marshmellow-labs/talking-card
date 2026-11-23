// Flash cards: one big card at a time, tap to hear, swipe or arrows to move, optional auto-play.
import { deck, shuffle } from '../games.js';
import { say } from '../speech.js';
import { icon } from '../icons.js';
import { categoryChips } from './chips.js';

const $ = id => document.getElementById(id);
let cards, list = [], i = 0, category = '', auto = null;

function render(dir = 0) {
  const c = list[i], el = $('flashCard');
  el.className = 'flashcard ' + c.color;
  $('fcPic').replaceChildren(icon(c.emoji));
  $('fcWord').textContent = c.name;
  $('fcCat').textContent = c.category;
  $('fcCount').textContent = `${i + 1} / ${list.length}`;
  if (dir) { el.style.setProperty('--dir', `${dir * 40}px`); el.classList.remove('slide'); void el.offsetWidth; el.classList.add('slide'); }
}
function go(d) { i = (i + d + list.length) % list.length; render(d); say(list[i].name); }
function setDeck(cat) { category = cat; list = deck(cards, cat); i = 0; render(); }
function stopAuto() { clearInterval(auto); auto = null; $('fcAuto').textContent = '⏯ Auto'; }

export function init(ctx) {
  cards = ctx.cards;
  categoryChips($('flashCats'), cards, cat => { stopAuto(); setDeck(cat); say(list[0].name); });
  setDeck('');
  const el = $('flashCard');
  el.onclick = () => say(list[i].name);
  el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); say(list[i].name); } };
  $('fcPrev').onclick = () => { stopAuto(); go(-1); };
  $('fcNext').onclick = () => { stopAuto(); go(1); };
  $('fcShuffle').onclick = () => { stopAuto(); list = shuffle(list); i = 0; render(1); say(list[0].name); };
  $('fcAuto').onclick = () => {
    if (auto) return stopAuto();
    $('fcAuto').textContent = '⏸ Stop'; say(list[i].name);
    auto = setInterval(() => go(1), 3500);
  };
  // swipe
  let x0 = null;
  el.addEventListener('pointerdown', e => { x0 = e.clientX; });
  el.addEventListener('pointerup', e => {
    if (x0 === null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { stopAuto(); go(dx < 0 ? 1 : -1); }
  });
  addEventListener('keydown', e => {
    if ($('flash').hidden) return;
    if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
  });
}

export function enter() { render(); }
export function leave() { stopAuto(); }
