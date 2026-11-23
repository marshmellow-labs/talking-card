// Filter chips shared by flash cards: categories ("All", "Animals", ...) and card colors.
export const CATEGORY_LABELS = {
  animal: '🐒 Animals', fruit: '🍊 Fruits', vegetable: '🥕 Vegetables', food: '🍕 Food', drink: '☕ Drinks',
  transport: '🚗 Vehicles', place: '🏛️ Places', object: '🪑 Things', family: '👵 Family', shape: '⭐ Shapes',
  nature: '☀️ Nature', color: '🎨 Colors',
};
export const COLOR_LABELS = { green: 'Green', yellow: 'Yellow', blue: 'Blue', pink: 'Pink' };

/** Single-choice chip group. options: [{value, label, html?}]. Returns {set(value)}. */
export function chipGroup(el, options, value, onPick) {
  const buttons = options.map(o => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    if (o.dot) { const d = document.createElement('span'); d.className = 'dot'; d.style.background = `var(--${o.dot})`; b.append(d); }
    b.append(o.label);
    b.dataset.value = o.value;
    b.onclick = () => { set(o.value); onPick(o.value); };
    return b;
  });
  const set = v => buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  el.replaceChildren(...buttons); set(value);
  return { set };
}

export function categoryOptions(cards) {
  const counts = {};
  for (const c of cards) counts[c.category] = (counts[c.category] ?? 0) + 1;
  return [{ value: '', label: '🌈 All' }, ...Object.keys(CATEGORY_LABELS).filter(k => counts[k]).map(k => ({ value: k, label: CATEGORY_LABELS[k] }))];
}

export function colorOptions() {
  return [{ value: '', label: 'Any' }, ...Object.entries(COLOR_LABELS).map(([k, v]) => ({ value: k, label: v, dot: k }))];
}
