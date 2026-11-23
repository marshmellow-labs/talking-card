// Category filter chips ("All", "Animals", ...), shared by flash cards and the game.
const LABELS = {
  animal: '🐒 Animals', fruit: '🍊 Fruits', vegetable: '🥕 Vegetables', food: '🍕 Food', drink: '☕ Drinks',
  transport: '🚗 Vehicles', place: '🏛️ Places', object: '🪑 Things', family: '👵 Family', shape: '⭐ Shapes',
  nature: '☀️ Nature', color: '🎨 Colors',
};

export function categoryChips(el, cards, onPick, { min = 1 } = {}) {
  const counts = {};
  for (const c of cards) counts[c.category] = (counts[c.category] ?? 0) + 1;
  const cats = ['', ...Object.keys(LABELS).filter(k => (counts[k] ?? 0) >= min)];
  const buttons = cats.map(cat => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = cat ? LABELS[cat] : '🌈 All';
    b.setAttribute('aria-pressed', String(cat === ''));
    b.onclick = () => { buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b))); onPick(cat); };
    return b;
  });
  el.replaceChildren(...buttons);
}
