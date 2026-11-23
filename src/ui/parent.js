// Grown-ups area: teach codes for cards the reader doesn't know, card list, voice, data.
import { CardCamera } from '../camera.js';
import { store, codeTable } from '../store.js';
import { say, listVoices } from '../speech.js';
import { icon } from '../icons.js';

const $ = id => document.getElementById(id);
let cards, cam, readCode = null;

function library() {
  const table = codeTable(cards), codeOf = new Map([...table].map(([code, c]) => [c.id, code]));
  const missing = cards.filter(c => !codeOf.has(c.id)).length;
  $('libStats').textContent = `${cards.length} cards · ${cards.length - missing} readable by the camera` + (missing ? ` · ${missing} need teaching` : '');
  $('lib').replaceChildren(...[...cards].sort((a, b) => (codeOf.get(a.id) ?? 999) - (codeOf.get(b.id) ?? 999)).map(c => {
    const d = document.createElement('button');
    d.className = `lib-item ${c.color}` + (codeOf.has(c.id) ? '' : ' nocode');
    const p = document.createElement('div'); p.className = 'p'; p.append(icon(c.emoji));
    const n = document.createElement('b'); n.textContent = c.name;
    const s = document.createElement('small'); s.textContent = codeOf.has(c.id) ? `code ${codeOf.get(c.id)}` : 'not taught yet';
    d.append(p, n, s); d.onclick = () => say(c.name);
    return d;
  }));
}

function teachOptions() {
  $('teachCard').replaceChildren(...[...cards].sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; return o;
  }));
}

function voices() {
  const vs = listVoices(), cur = store.get().settings.voice;
  $('voice').replaceChildren(new Option('Automatic', ''), ...vs.map(v => new Option(`${v.name} (${v.lang})`, v.name, false, v.name === cur)));
  $('rate').value = store.get().settings.rate;
}

function stopTeach() { cam?.stop(); $('teachStart').textContent = '▶ Start camera'; }

export function init(ctx) {
  cards = ctx.cards;
  teachOptions();
  const view = $('teachCam');
  cam = new CardCamera(view, {
    known: null, // raw codes: a parent may be teaching a card the reader has never seen
    needed: 4,
    onState: s => { view.dataset.state = s === 'unknown' ? 'reading' : s; },
    onResult: res => {
      readCode = res.code;
      const card = codeTable(cards).get(res.code);
      $('teachRead').textContent = card ? `Read code ${res.code}: ${card.name} ✓` : `Read code ${res.code}: not known yet. Choose the card and tap Save.`;
      if (card) $('teachCard').value = card.id;
      $('teachSave').disabled = false;
      navigator.vibrate?.(60);
    },
  });
  $('teachStart').onclick = async () => {
    if (cam.running) return stopTeach();
    try { await cam.start(); $('teachStart').textContent = '⏹ Stop camera'; }
    catch (e) { $('teachRead').textContent = 'Camera unavailable: ' + e.message; }
  };
  $('teachSave').onclick = () => {
    if (readCode === null) return;
    const id = Number($('teachCard').value), card = cards.find(c => c.id === id);
    // one code per card: drop any older taught code for this card
    const learned = Object.fromEntries(Object.entries(store.get().learned).filter(([, v]) => v !== id));
    learned[readCode] = id;
    store.set({ learned });
    $('teachRead').textContent = `Saved: code ${readCode} is ${card.name}.`;
    say(card.name); library();
  };

  $('voice').onchange = e => store.setting('voice', e.target.value);
  $('rate').oninput = e => store.setting('rate', Number(e.target.value));
  $('testVoice').onclick = () => say('Hello! Let us learn some words.');
  speechSynthesis?.addEventListener?.('voiceschanged', voices);

  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify({ version: 4, learned: store.get().learned }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'talking-cards-taught.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('import').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    try {
      const j = JSON.parse(await e.target.files[0].text()), ids = new Set(cards.map(c => c.id));
      const ok = Object.entries(j.learned ?? {}).filter(([k, v]) => /^\d+$/.test(k) && +k > 0 && +k < 256 && ids.has(v));
      store.set({ learned: { ...store.get().learned, ...Object.fromEntries(ok) } });
      alert(`Imported ${ok.length} taught cards.`); library();
    } catch (err) { alert('Could not import: ' + err.message); }
    e.target.value = '';
  };
  $('resetStars').onclick = () => { if (confirm('Reset all stars?')) store.set({ stars: {} }); };
  $('resetLearned').onclick = () => { if (confirm('Forget all cards taught on this device?')) { store.set({ learned: {} }); library(); } };
}

export function enter() { library(); voices(); }
export function leave() { stopTeach(); }
