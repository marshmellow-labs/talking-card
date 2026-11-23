// One-off: decode each reference card's 8-cell code with fixed boundaries and store it in cards.json.
// Cards whose reference strip is glare-damaged are left without a code (teach them in the app).
import fs from 'node:fs';
import { extractAll, refRead } from './extract-cards.mjs';
import { CELLS } from '../src/detect.js';
const UNREADABLE = new Set(['Colosseum', 'Eggplant', 'Fridge']);
const UNVERIFIED = new Set(['Shoes']);
const { main } = extractAll();
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
for (const c of main) {
  const bits = [...refRead(c.img, c.box).bits].map(Number), code = [];
  for (const [a, b] of CELLS) {
    const m = Math.ceil((a + (b - a) * 0.25) * 96), n = Math.floor((b - (b - a) * 0.25) * 96);
    let s = 0; for (let i = m; i <= n; i++) s += bits[i]; code.push(s / (n - m + 1) > 0.5 ? 1 : 0);
  }
  const card = cards.find(x => x.id === c.card.id);
  delete card.code; delete card.verify;
  if (!UNREADABLE.has(card.name)) card.code = parseInt(code.join(''), 2);
  if (UNVERIFIED.has(card.name)) card.verify = true;
}
const seen = {};
for (const c of cards) if (c.code !== undefined) { if (seen[c.code]) throw new Error(`duplicate code ${c.code}: ${seen[c.code]} / ${c.name}`); seen[c.code] = c.name; }
fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2) + '\n');
console.log(`${Object.keys(seen).length} cards have codes`);
