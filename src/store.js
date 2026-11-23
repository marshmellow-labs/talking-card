// Small localStorage-backed state: stars, codes taught by a parent, and settings.
const KEY = 'talking-cards-v4';
const defaults = { stars: {}, learned: {}, settings: { rate: 0.85, voice: '', level: 'easy', theme: 'sunny', findNames: true, findColors: true } };

function read() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { ...defaults, ...s, settings: { ...defaults.settings, ...s.settings } }; }
  catch { return structuredClone(defaults); }
}
let state = read();
const listeners = new Set();

export const store = {
  get: () => state,
  set(patch) { state = { ...state, ...patch }; localStorage.setItem(KEY, JSON.stringify(state)); listeners.forEach(f => f(state)); },
  setting(k, v) { this.set({ settings: { ...state.settings, [k]: v } }); },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
};

/** Card lookup by printed code: codes a parent taught on this device win over cards.json. */
export function codeTable(cards) {
  const byId = new Map(cards.map(c => [c.id, c])), table = new Map();
  for (const c of cards) if (c.code !== undefined) table.set(c.code, c);
  for (const [code, id] of Object.entries(state.learned)) if (byId.has(id)) table.set(Number(code), byId.get(id));
  return table;
}
