import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeRound, LEVELS, rng, shuffle, deck, addStar, totalStars, withArticle } from '../src/games.js';

const cards = JSON.parse(fs.readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));

test('shuffle keeps all items', () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.deepEqual([...shuffle(a, rng(3))].sort(), a);
});

test('deck filters by category', () => {
  assert.ok(deck(cards, 'animal').every(c => c.category === 'animal'));
  assert.equal(deck(cards).length, cards.length);
});

for (const level of Object.keys(LEVELS)) {
  test(`${level} rounds: right count, answer once, no duplicate pictures`, () => {
    const rand = rng(5);
    for (let i = 0; i < 300; i++) {
      const { answer, choices } = makeRound(cards, { level, rand });
      assert.equal(choices.length, LEVELS[level].choices);
      assert.equal(choices.filter(c => c.id === answer.id).length, 1);
      assert.equal(new Set(choices.map(c => c.emoji)).size, choices.length);
      assert.equal(new Set(choices.map(c => c.id)).size, choices.length);
    }
  });
}

test('hard rounds stay in the answer category when it has enough cards', () => {
  const rand = rng(9);
  for (let i = 0; i < 200; i++) {
    const { answer, choices } = makeRound(cards, { level: 'hard', rand });
    if (cards.filter(c => c.category === answer.category).length >= 6)
      assert.ok(choices.every(c => c.category === answer.category), answer.name);
  }
});

test('category filter limits answers', () => {
  const rand = rng(2);
  for (let i = 0; i < 50; i++) assert.equal(makeRound(cards, { category: 'fruit', rand }).answer.category, 'fruit');
});

test('recent answers are avoided', () => {
  const pool = deck(cards, 'shape'), recent = pool.slice(0, pool.length - 1).map(c => c.id);
  const { answer } = makeRound(cards, { category: 'shape', recent, rand: rng(4) });
  assert.equal(answer.id, pool.at(-1).id);
});

test('stars favour cards the child knows least', () => {
  const pool = deck(cards, 'family');
  const stars = Object.fromEntries(pool.slice(1).map(c => [c.id, 5]));
  assert.equal(makeRound(cards, { category: 'family', stars, rand: rng(8) }).answer.id, pool[0].id);
});

test('stars accumulate', () => {
  let s = {}; s = addStar(s, 3); s = addStar(s, 3); s = addStar(s, 4);
  assert.equal(s[3], 2); assert.equal(totalStars(s), 3);
});

test('articles read naturally', () => {
  assert.equal(withArticle({ name: 'Owl', category: 'animal' }), 'an Owl');
  assert.equal(withArticle({ name: 'Duck', category: 'animal' }), 'a Duck');
  assert.equal(withArticle({ name: 'Taj Mahal', category: 'place' }), 'Taj Mahal');
});
