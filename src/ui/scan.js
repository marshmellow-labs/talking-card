// Scan screen: live camera, reads cards continuously and says the word.
import { CardCamera } from '../camera.js';
import { codeTable } from '../store.js';
import { say } from '../speech.js';
import { icon } from '../icons.js';
import { withArticle } from '../games.js';

const $ = id => document.getElementById(id);
let cam, cards, last = null;

function show(card, sub) {
  $('resPic').replaceChildren(card ? icon(card.emoji) : icon('🤔'));
  $('resWord').textContent = card ? card.name : 'Hmm…';
  $('resSub').textContent = sub;
  $('sayAgain').hidden = !card;
  const r = $('scanResult'); r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop');
}

export function init(ctx) {
  cards = ctx.cards;
  const view = $('cam');
  cam = new CardCamera(view, {
    known: () => new Set(codeTable(cards).keys()),
    onState: s => { view.dataset.state = s; },
    onResult: res => {
      const card = codeTable(cards).get(res.code);
      if (card) { last = card; show(card, `${card.category}`); say(`${card.name}!`); }
      else { last = null; show(null, "I don't know this card yet. Ask a grown-up to teach me."); say("Hmm, I don't know this card yet."); }
    },
  });
  $('camStart').onclick = async () => {
    if (cam.running) { stop(); return; }
    try {
      $('camMsg').textContent = 'Starting camera…';
      await cam.start();
      $('camMsg').textContent = ''; $('camStart').textContent = '⏹ Stop';
      $('torch').hidden = !cam.hasTorch;
    } catch (e) { $('camMsg').textContent = 'Camera unavailable: ' + e.message; }
  };
  let torch = false;
  $('torch').onclick = async () => { torch = !torch; await cam.setTorch(torch).catch(() => {}); $('torch').textContent = torch ? '🔦 Light off' : '🔦 Light'; };
  $('sayAgain').onclick = () => last && say(`This is ${withArticle(last)}.`);
}

function stop() { cam.stop(); $('camStart').textContent = '▶ Start'; $('camMsg').textContent = 'Tap Start to use the camera'; $('cam').dataset.state = ''; $('torch').hidden = true; }

export function enter() { if (!cam.running) $('camStart').click(); }
export function leave() { stop(); }
