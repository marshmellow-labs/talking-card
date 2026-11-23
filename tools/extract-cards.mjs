// Extracts every card from the local reference floor photos (ref-images/raw, not committed).
// Cards are segmented, straightened (strip at the bottom) and labelled by their known layout order
// in cards.json. Because every card is the same physical size and we know where each card is, the
// reference strip is read from FIXED card geometry, independent of the app's general reader.
// Used by tools/assign-codes.mjs (codes in cards.json), tools/eval.mjs and tools/make-fixtures.mjs.
// Run directly to print each card's strip and write contact sheets to tools/out/ for checking.
import fs from 'node:fs';
import { load, savePng, blank, paste, warpRect, rect } from './img.mjs';
import { findCards } from './segment.mjs';
import { BITS, otsu } from '../src/detect.js';

const cards = JSON.parse(fs.readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));
const deg = d => d * Math.PI / 180;
const MARGIN = 0.12;        // crop margin around the card, as a fraction of card length
const STRIP = [0.06, 0.025]; // strip sampling rows: from 6% to 2.5% of card length above the bottom edge

function clusters(items, key, gap) {
  const s = [...items].sort((a, b) => key(a) - key(b)), out = [];
  for (const it of s) { const last = out.at(-1); if (last && key(it) - key(last.at(-1)) < gap) last.push(it); else out.push([it]); }
  return out;
}

const PHOTOS = {
  'floor-a': {
    stripAt: 'left',
    extra: [{ cx: 655, cy: 645, w: 142, h: 97, a: deg(-4) }], // Frog: merged with a wood reflection
    fix: [{ near: [432, 1056], rect: { cx: 424, cy: 1062, w: 146, h: 98, a: deg(-12) } }], // Crocodile, partly under Shoes
    order: rs => clusters(rs, r => r.cx, 60).reverse().flatMap(col => col.sort((p, q) => p.cy - q.cy)),
    skip: [],
  },
  'floor-b': {
    stripAt: 'top',
    extra: [{ cx: 335, cy: 154, w: 96, h: 143, a: deg(3) }], // Great Wall: dark photo picture breaks the mask
    fix: [],
    order: rs => clusters(rs, r => r.cy, 70).reverse().flatMap(row => row.sort((p, q) => q.cx - p.cx)),
    skip: [6, 15], // second "Black" and "Candy" cards; kept out of the main set, used as checks
  },
};

/**
 * Straighten a card into a portrait crop with the strip at the bottom. The card's length is fixed to
 * the photo's median card length and anchored at the NON-strip end (the strip end of the color mask
 * is unreliable: black bars and dim white paper drop out of it).
 * Returns { img, box } where box is the card's rectangle inside the crop.
 */
export function cardImage(im, r, stripAt, L, S) {
  const land = r.w > r.h, long = Math.max(r.w, r.h);
  let a = land ? r.a + Math.PI / 2 : r.a;
  let d = [-Math.sin(a), Math.cos(a)]; // image direction of crop +y
  const want = stripAt === 'left' ? [-1, 0] : [0, -1];
  if (d[0] * want[0] + d[1] * want[1] < 0) { a += Math.PI; d = [-d[0], -d[1]]; }
  const top = [r.cx - d[0] * long / 2, r.cy - d[1] * long / 2], bottom = [r.cx + d[0] * long / 2, r.cy + d[1] * long / 2];
  // if the top end runs into the photo border the card is cut off there: anchor at the strip end instead
  const cut = top[0] < 8 || top[1] < 8 || top[0] > im.width - 8 || top[1] > im.height - 8;
  const c = cut ? [bottom[0] - d[0] * L / 2, bottom[1] - d[1] * L / 2] : [top[0] + d[0] * L / 2, top[1] + d[1] * L / 2];
  const W = S + 2 * MARGIN * L, H = L * (1 + 2 * MARGIN);
  const img = warpRect(im, c[0], c[1], W, H, a);
  return { img, box: { x0: MARGIN * L, x1: MARGIN * L + S, y0: MARGIN * L, y1: MARGIN * L + L } };
}

/** Read a strip with known card box. Returns bits + per-cell values. */
export function refRead(img, box) {
  const { width: w, data } = img, L = box.y1 - box.y0;
  const ya = Math.round(box.y1 - STRIP[0] * L), yb = Math.round(box.y1 - STRIP[1] * L);
  const cw = (box.x1 - box.x0) / BITS, cols = [];
  for (let k = 0; k < BITS; k++) {
    const vals = [];
    for (let x = Math.floor(box.x0 + (k + 0.2) * cw); x <= Math.floor(box.x0 + (k + 0.8) * cw); x++)
      for (let y = ya; y <= yb; y++) { const i = (y * w + x) * 4; vals.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]); }
    vals.sort((p, q) => p - q); cols.push(vals[vals.length >> 1]);
  }
  const t = otsu(cols);
  return { bits: cols.map(v => (v < t ? '1' : '0')).join(''), cols, rows: [ya, yb] };
}

export function extractAll() {
  const out = [];
  for (const [name, cfg] of Object.entries(PHOTOS)) {
    const im = load(new URL(`../ref-images/raw/${name}.jpg`, import.meta.url).pathname);
    const found = findCards(im).map(r => cfg.fix.find(f => Math.hypot(f.near[0] - r.cx, f.near[1] - r.cy) < 20)?.rect ?? r);
    const rs = cfg.order([...found, ...cfg.extra]);
    const med = arr => [...arr].sort((p, q) => p - q)[arr.length >> 1];
    const L = med(rs.map(r => Math.max(r.w, r.h))), S = med(rs.map(r => Math.min(r.w, r.h)));
    rs.forEach((r, k) => { const { img, box } = cardImage(im, r, cfg.stripAt, L, S); out.push({ photo: name, index: k, rect: r, img, box, skipped: cfg.skip.includes(k) }); });
  }
  const main = out.filter(c => !c.skipped);
  main.forEach((c, k) => { c.card = cards[k]; });
  return { all: out, main };
}

const show = b => b.replace(/0/g, '·').replace(/1/g, '█');

function contact(list, file) {
  const cw = 120, ch = 205, per = 10;
  const sheet = blank(cw * per, ch * Math.ceil(list.length / per), 40);
  list.forEach((c, k) => {
    const s = Math.min(cw / c.img.width, 175 / c.img.height), t = blank(Math.round(c.img.width * s), Math.round(c.img.height * s));
    for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
      const i = (Math.min(c.img.height - 1, Math.floor(y / s)) * c.img.width + Math.min(c.img.width - 1, Math.floor(x / s))) * 4;
      t.data.set(c.img.data.subarray(i, i + 4), (y * t.width + x) * 4);
    }
    const ox = (k % per) * cw, oy = Math.floor(k / per) * ch; paste(sheet, t, ox, oy);
    const r = refRead(c.img, c.box), bx = Math.round(c.box.x0 * s), bw = Math.round((c.box.x1 - c.box.x0) * s);
    for (const y of r.rows) rect(sheet, ox + bx, oy + Math.round(y * s), bw, 1, [255, 0, 0]);
    for (let b = 0; b < BITS; b++) rect(sheet, ox + 4 + Math.floor(b * (cw - 8) / BITS), oy + 180, Math.ceil((cw - 8) / BITS), 18, r.bits[b] === '1' ? [0, 0, 0] : [255, 255, 255]);
    if (c.skipped) rect(sheet, ox, oy, cw, 4, [255, 0, 255]);
  });
  savePng(file, sheet);
}

/** Zoomed strip crops (card bottom 14%), 4x, with decoded bits underneath: for eyeballing reads. */
function stripSheets(list, per = 16) {
  for (let p = 0; p * per < list.length; p++) {
    const part = list.slice(p * per, p * per + per), Z = 4, rowH = 70;
    const sheet = blank(520, rowH * part.length, 60);
    part.forEach((c, k) => {
      const L = c.box.y1 - c.box.y0, y0 = Math.round(c.box.y1 - 0.14 * L), x0 = Math.round(c.box.x0 - 4);
      const sw = Math.round(c.box.x1 - c.box.x0 + 8), sh = Math.round(0.17 * L);
      for (let y = 0; y < sh * Z && y < 46; y++) for (let x = 0; x < sw * Z && x < 500; x++) {
        const sx = x0 + Math.floor(x / Z), sy = y0 + Math.floor(y / Z); if (sx < 0 || sy < 0 || sx >= c.img.width || sy >= c.img.height) continue;
        const i = (sy * c.img.width + sx) * 4; rect(sheet, 10 + x, k * rowH + y, 1, 1, [c.img.data[i], c.img.data[i + 1], c.img.data[i + 2]]);
      }
      const r = refRead(c.img, c.box), span = (c.box.x1 - c.box.x0) * Z;
      for (let b = 0; b < BITS; b++) rect(sheet, 10 + 4 * Z + Math.floor(b * span / BITS), k * rowH + 50, Math.ceil(span / BITS), 14, r.bits[b] === '1' ? [0, 0, 0] : [255, 255, 255]);
    });
    savePng(`tools/out/strips-${p}.png`, sheet);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync('tools/out', { recursive: true });
  const { all, main } = extractAll();
  console.log(`found ${all.length} cards (${main.length} labelled, expected ${cards.length})`);
  if (main.length !== cards.length) { process.exitCode = 1; }
  const patterns = main.map(c => ({ id: c.card.id, bits: refRead(c.img, c.box).bits }));
  main.forEach((c, k) => console.log(`${String(c.card.id).padStart(2)} ${c.card.name.padEnd(26)} ${show(patterns[k].bits)}`));
  for (const c of all.filter(c => c.skipped)) console.log(`duplicate ${c.photo}#${c.index}`.padEnd(29), show(refRead(c.img, c.box).bits));
  for (const p of Object.keys(PHOTOS)) contact(all.filter(c => c.photo === p), `tools/out/contact-${p}.png`);
  stripSheets(main);
}
