// Pure game logic (no DOM): easy to test.

export function rng(seed = Date.now() % 2147483647 || 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const LEVELS = {
  easy: { label: 'Easy', choices: 3, sameCategory: false },
  medium: { label: 'Medium', choices: 4, sameCategory: false },
  hard: { label: 'Hard', choices: 6, sameCategory: true },
};

/** Cards in a category ('' = all), in a stable order. */
export function deck(cards, category = '') {
  return cards.filter(c => !category || c.category === category);
}

/**
 * One "Find it!" round. Prefers answers the child has fewer stars for and avoids repeating the
 * recent answers. On hard, distractors come from the answer's category when there are enough.
 * @returns {{answer, choices}} choices includes answer exactly once, all distinct.
 */
export function makeRound(cards, { level = 'easy', category = '', stars = {}, recent = [], rand = Math.random } = {}) {
  const L = LEVELS[level] ?? LEVELS.easy, pool = deck(cards, category);
  if (pool.length === 0) throw new Error('no cards to play with');
  const fresh = pool.filter(c => !recent.includes(c.id));
  const cand = fresh.length ? fresh : pool;
  const minStars = Math.min(...cand.map(c => stars[c.id] ?? 0));
  const weakest = cand.filter(c => (stars[c.id] ?? 0) <= minStars + 1);
  const answer = weakest[Math.floor(rand() * weakest.length)];
  const others = cards.filter(c => c.id !== answer.id && c.emoji !== answer.emoji);
  // hard: same-category distractors first, topped up from other categories if there aren't enough
  const ordered = L.sameCategory
    ? [...shuffle(others.filter(c => c.category === answer.category), rand), ...shuffle(others.filter(c => c.category !== answer.category), rand)]
    : shuffle(others, rand);
  const picked = [];
  for (const c of ordered) {
    if (picked.length >= L.choices - 1) break;
    if (!picked.some(p => p.emoji === c.emoji)) picked.push(c);
  }
  return { answer, choices: shuffle([answer, ...picked], rand) };
}

export function addStar(stars, id) { return { ...stars, [id]: (stars[id] ?? 0) + 1 }; }
export function totalStars(stars) { return Object.values(stars).reduce((a, b) => a + b, 0); }

export const CHEERS = ['Great job!', 'Yay!', 'You found it!', 'Awesome!', 'Super!', 'Well done!', 'Hooray!'];
export const pick = (arr, rand = Math.random) => arr[Math.floor(rand() * arr.length)];

/** Pick a natural article: "a duck", "an owl", no article for places/names/colors. */
export function withArticle(card) {
  if (['place', 'color', 'family', 'nature'].includes(card.category) || /^the /i.test(card.name)) return card.name;
  return (/^[aeiou]/i.test(card.name) ? 'an ' : 'a ') + card.name;
}
