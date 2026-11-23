// Writes small strip-only crops (bottom of the card + a little background) to test/fixtures/strips/,
// with labels.json. Only these crops are committed; the full reference photos stay local.
import fs from 'node:fs';
import { extractAll } from './extract-cards.mjs';
import { CLOSEUPS } from './eval.mjs';
import { load, crop, saveJpg } from './img.mjs';
import { readCard } from '../src/detect.js';

const ABOVE = 0.14, BELOW = 0.05; // fractions of card height kept above / below the card's bottom edge
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const known = new Set(cards.filter(c => c.code !== undefined).map(c => c.code));
const PICK = ['Black', 'Sky', 'Father', 'Star', 'Fox', 'Whale', 'Pizza', 'Doll', 'Taj Mahal', 'Train', 'Jeep', 'Corn', 'Lychee', 'Coconut'];
const dir = 'test/fixtures/strips';
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) fs.unlinkSync(`${dir}/${f}`);

const out = [];
function add(name, src, img, card /* {x0,x1,y0,y1} px in img */) {
  const L = card.y1 - card.y0, mx = (card.x1 - card.x0) * 0.08;
  const x = card.x0 - mx, y = card.y1 - ABOVE * L, w = card.x1 - card.x0 + 2 * mx, h = (ABOVE + BELOW) * L;
  const strip = crop(img, x, y, w, h);
  const expect = { x0: mx / w, x1: (w - mx) / w, y1: ABOVE * L / h, h: L / h };
  const file = `${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${src}.jpg`;
  saveJpg(`${dir}/${file}`, strip, 90);
  const want = cards.find(c => c.name === name).code;
  const got = readCard(load(`${dir}/${file}`), { expect, known, tryFlip: false });
  const ok = got?.confident && got.code === want;
  console.log(ok ? 'ok  ' : 'FAIL', file, want, got?.code, got?.confident);
  if (ok) out.push({ file, name, code: want, expect: Object.fromEntries(Object.entries(expect).map(([k, v]) => [k, +v.toFixed(4)])) });
  else fs.unlinkSync(`${dir}/${file}`);
}

const { main } = extractAll();
for (const name of PICK) {
  const c = main.find(c => c.card.name === name);
  if (c) add(name, 'floor', c.img, c.box);
}
for (const t of CLOSEUPS) {
  const im = load(`ref-images/raw/${t.file}`);
  const [x0, y0, x1, y1] = t.card;
  add(t.name, t.file.replace('.jpg', ''), im, { x0, y0, x1, y1 });
}
fs.writeFileSync(`${dir}/labels.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} fixtures written`);
