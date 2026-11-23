// Measures the app reader (src/detect.js readCard) against reference codes. Local only (needs ref-images).
import fs from 'node:fs';
import { extractAll } from './extract-cards.mjs';
import { load, crop } from './img.mjs';
import { readCard } from '../src/detect.js';
const cards = JSON.parse(fs.readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));
const byName = n => cards.find(c => c.name === n);
const known = new Set(cards.filter(c => c.code !== undefined).map(c => c.code));
// Guide-style crops of the close-up photos: card edges approximately 7% in from each side.
export const CLOSEUPS = [
  { file: 'fox.jpg', name: 'Fox', card: [230, 190, 878, 1150] },
  { file: 'corn-fox.jpg', name: 'Corn', card: [135, 335, 527, 920] },
  { file: 'corn-fox.jpg', name: 'Fox', card: [620, 345, 1018, 935] },
  { file: 'train.jpg', name: 'Train', card: [230, 405, 840, 1295] },
];
const guideCrop = (im, [x0, y0, x1, y1], m = 0.08) => { const w = x1 - x0, h = y1 - y0, mx = w * m / (1 - 2 * m); return crop(im, x0 - mx, y0 - h * 0.05, w + 2 * mx, h * 1.12); };
// deterministic jitter so runs are comparable
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
export function evaluate({ verbose = false } = {}) {
  const res = [];
  const { main } = extractAll();
  seed = 7;
  for (const c of main) if (c.card.code !== undefined) {
    // the guide is never perfectly aligned: jitter the expected span by up to ±5% of the card width
    const W = c.img.width, cw = (c.box.x1 - c.box.x0) / W, j = () => rnd() * 0.05 * cw;
    const expect = { x0: c.box.x0 / W + j(), x1: c.box.x1 / W + j(), y1: c.box.y1 / c.img.height + j() * 0.5, h: (c.box.y1 - c.box.y0) / c.img.height };
    res.push({ name: c.card.name, want: c.card.code, got: readCard(c.img, { expect, known }), src: 'floor' });
  }
  for (const t of CLOSEUPS) {
    const im = load(new URL(`../ref-images/raw/${t.file}`, import.meta.url).pathname);
    res.push({ name: t.name, want: byName(t.name).code, got: readCard(guideCrop(im, t.card), { known, expect: { x0: 0.08, x1: 0.92, y1: 1.05 / 1.12, h: 1 / 1.12 } }), src: 'closeup' });
  }
  const tally = { right: 0, wrong: 0, unsure: 0, none: 0 };
  for (const r of res) {
    const k = !r.got ? 'none' : !r.got.confident ? 'unsure' : r.got.code === r.want ? 'right' : 'wrong';
    tally[k]++; r.outcome = k;
    if (verbose && k !== 'right') console.log(k.padEnd(6), r.src.padEnd(7), r.name.padEnd(22), 'want', r.want, 'got', r.got?.code, r.got && `fills=${r.got.fills.map(f => f.toFixed(2)).join(',')} lead=${r.got.lead.toFixed(2)} edges=${r.got.edges.x0}-${r.got.edges.x1} band=${r.got.band.y0}-${r.got.band.y1} flip=${r.got.flipped}`);
  }
  return { tally, res };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const { tally } = evaluate({ verbose: true });
  console.log(tally);
}
