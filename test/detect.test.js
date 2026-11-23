import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readCard, rotate180, otsu, CELLS } from '../src/detect.js';
import { load } from '../tools/img.mjs';
import { synthCard, rng } from './synth.js';

const cards = JSON.parse(fs.readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));
const known = new Set(cards.filter(c => c.code !== undefined).map(c => c.code));

test('cards.json: unique names, ids and codes', () => {
  const uniq = k => new Set(cards.map(c => c[k]).filter(v => v !== undefined)).size;
  assert.equal(uniq('id'), cards.length);
  assert.equal(uniq('name'), cards.length);
  const coded = cards.filter(c => c.code !== undefined);
  assert.equal(uniq('code'), coded.length);
  for (const c of coded) assert.ok(Number.isInteger(c.code) && c.code > 0 && c.code < 256, c.name);
});

test('code cells tile the strip left to right', () => {
  assert.equal(CELLS.length, 8);
  for (let k = 1; k < 8; k++) assert.equal(CELLS[k][0], CELLS[k - 1][1]);
  assert.ok(CELLS[0][0] > 0.15, 'white lead-in before the first cell');
});

test('otsu splits a bimodal sample', () => {
  const t = otsu([...Array(50).fill(20), ...Array(50).fill(220)]);
  assert.ok(t > 20 && t < 220);
});

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/strips/labels.json', import.meta.url), 'utf8'));
for (const f of fixtures) {
  test(`fixture ${f.file} reads as ${f.name} (${f.code})`, () => {
    const img = load(new URL(`./fixtures/strips/${f.file}`, import.meta.url).pathname);
    const r = readCard(img, { expect: f.expect, known, tryFlip: false });
    assert.ok(r, 'strip found');
    assert.equal(r.code, f.code);
    assert.ok(r.confident, 'confident');
  });
}

test('synthetic cards: every known code reads back under noise, blur and uneven light', () => {
  const rand = rng(11), colors = [[240, 170, 60], [235, 160, 175], [140, 175, 225], [170, 190, 40]];
  let wrong = 0, unsure = 0;
  for (const code of known) {
    const { img, expect } = synthCard(code, { color: colors[code % 4], noise: 10, gradient: 0.3, tilt: (rand() - 0.5) * 2, rand });
    const r = readCard(img, { expect, known });
    if (!r?.confident) unsure++; else if (r.code !== code) wrong++;
  }
  assert.equal(wrong, 0, 'no confident wrong reads');
  assert.ok(unsure <= known.size * 0.05, `at most 5% unsure (got ${unsure})`);
});

test('synthetic card flipped 180° still reads', () => {
  const { img, expect } = synthCard(161);
  // the app's guide prior stays the same; readCard retries with the image upside down
  const r = readCard(rotate180(img), { expect, known });
  assert.equal(r.code, 161);
  assert.ok(r.flipped);
});

test('an unused code is never reported as confident when known codes are given', () => {
  const ones = c => c.toString(2).split('1').length - 1;
  const unused = [...Array(255).keys()].find(c => c > 64 && !known.has(c) && ones(c) >= 3);
  const { img, expect } = synthCard(unused);
  const r = readCard(img, { expect, known });
  assert.ok(!r?.confident || r.code !== unused);
  // without the known-code table the raw code is still decoded (used by the parent "teach" screen)
  const raw = readCard(img, { expect });
  assert.equal(raw.code, unused);
});

test('blank image yields no confident read', () => {
  const W = 200, H = 300, data = new Uint8ClampedArray(W * H * 4).fill(128);
  const r = readCard({ width: W, height: H, data }, { known });
  assert.ok(!r?.confident);
});
