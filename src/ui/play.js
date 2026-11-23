// "Find it!" game: hear a word, tap the matching mini card. No camera needed.
// Grown-ups can hide the names and/or card colors once the child knows the pictures.
import { makeRound, addStar, CHEERS, pick, withArticle, bestGrid } from '../games.js';
import { store } from '../store.js';
import { say } from '../speech.js';
import { icon } from '../icons.js';
import { CELLS } from '../detect.js';

const $ = id => document.getElementById(id);
let cards, round = null, recent = [], busy = false;

function layout() {
  const stage = $('choiceStage'), n = $('choices').children.length; if (!n) return;
  const { width, height } = stage.getBoundingClientRect();
  const gap = Math.max(8, Math.min(16, width / 40));
  const { cols, tile } = bestGrid(n, width, height, gap);
  const ch = $('choices');
  ch.style.setProperty('--cols', cols); ch.style.setProperty('--tile', `${Math.min(tile, 260)}px`); ch.style.setProperty('--gap', `${gap}px`);
}

function burst(x, y) {
  for (let k = 0; k < 10; k++) {
    const s = document.createElement('span'); s.className = 'burst';
    s.textContent = pick(['⭐', '🎉', '✨', '🌟']);
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 90;
    s.style.setProperty('--dx', `${Math.cos(a) * r}px`); s.style.setProperty('--dy', `${Math.sin(a) * r}px`);
    document.body.append(s); setTimeout(() => s.remove(), 1000);
  }
}

function ask() { say(`Find ${withArticle(round.answer)}!`); }

/** Decorative copy of the card's printed code strip (white lead-in, then 8 cells). */
function strip(code) {
  const el = document.createElement('div'); el.className = 'cstrip';
  const bits = code === undefined ? '00000000' : code.toString(2).padStart(8, '0');
  CELLS.forEach(([a, b], k) => {
    if (bits[k] !== '1') return;
    const i = document.createElement('i'); i.style.left = `${a * 100}%`; i.style.width = `${(b - a) * 100}%`;
    el.append(i);
  });
  return el;
}

/** A small version of the real card: name on top, picture, code strip along the bottom. */
function miniCard(c, { names, colors }) {
  const b = document.createElement('button');
  b.className = 'choice ' + (colors ? c.color : 'plain'); b.setAttribute('aria-label', c.name);
  const label = document.createElement('small'); label.textContent = names ? c.name : '';
  const p = document.createElement('div'); p.className = 'cp'; p.append(icon(c.emoji));
  b.append(label, p, strip(c.code));
  b.onclick = e => choose(c, b, label, e);
  return b;
}

function next() {
  busy = false;
  const { level, findNames, findColors } = store.get().settings;
  round = makeRound(cards, { level, stars: store.get().stars, recent });
  recent = [round.answer.id, ...recent].slice(0, 8);
  $('target').textContent = round.answer.name;
  $('cheer').textContent = '';
  $('choices').replaceChildren(...round.choices.map(c => miniCard(c, { names: findNames, colors: findColors })));
  layout();
  ask();
}

async function choose(c, b, label, e) {
  if (busy) return;
  label.textContent = c.name; // always reveal the name once tapped
  if (c.id === round.answer.id) {
    busy = true;
    b.classList.add('right');
    store.set({ stars: addStar(store.get().stars, c.id) });
    const cheer = pick(CHEERS); $('cheer').textContent = `⭐ ${cheer}`;
    burst(e.clientX, e.clientY);
    await say(`${cheer} That's ${withArticle(c)}!`);
    setTimeout(next, 500);
  } else {
    b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
    say(`That's ${withArticle(c)}. Find ${withArticle(round.answer)}!`);
  }
}

export function init(ctx) {
  cards = ctx.cards;
  $('repeat').onclick = ask;
  new ResizeObserver(layout).observe($('choiceStage'));
}
export function enter() { next(); }
export function leave() { globalThis.speechSynthesis?.cancel(); }
