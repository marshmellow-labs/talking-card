// "Find it!" game: hear a word, tap the matching picture. No camera needed.
import { makeRound, LEVELS, addStar, CHEERS, pick, withArticle } from '../games.js';
import { store } from '../store.js';
import { say } from '../speech.js';
import { icon } from '../icons.js';

const $ = id => document.getElementById(id);
let cards, round = null, recent = [], busy = false;

function levelChips() {
  const level = store.get().settings.level;
  $('levels').replaceChildren(...Object.entries(LEVELS).map(([k, L]) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = `${L.label} · ${L.choices}`; b.setAttribute('aria-pressed', String(k === level));
    b.onclick = () => { store.setting('level', k); levelChips(); next(); };
    return b;
  }));
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

function next() {
  busy = false;
  const { level } = store.get().settings;
  round = makeRound(cards, { level, stars: store.get().stars, recent });
  recent = [round.answer.id, ...recent].slice(0, 8);
  $('target').textContent = round.answer.name;
  $('cheer').textContent = '';
  const n = round.choices.length;
  $('choices').style.setProperty('--cols', n === 4 ? 2 : 3);
  $('choices').replaceChildren(...round.choices.map(c => {
    const b = document.createElement('button');
    b.className = 'choice'; b.setAttribute('aria-label', c.name);
    const label = document.createElement('small');
    b.append(icon(c.emoji), label);
    b.onclick = e => choose(c, b, label, e);
    return b;
  }));
  ask();
}

async function choose(c, b, label, e) {
  if (busy) return;
  label.textContent = c.name;
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
}
export function enter() { levelChips(); next(); }
export function leave() { speechSynthesis?.cancel(); }
