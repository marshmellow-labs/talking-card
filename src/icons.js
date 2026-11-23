// Card pictures: Twemoji SVGs from assets/emoji.svg, falling back to the device's own emoji.

/** Twemoji file key: code points in hex joined by '-', dropping FE0F unless the sequence has a ZWJ. */
export function emojiKey(emoji) {
  const cps = [...emoji].map(ch => ch.codePointAt(0));
  const keep = cps.includes(0x200d) ? cps : cps.filter(c => c !== 0xfe0f);
  return keep.map(c => c.toString(16)).join('-');
}

let available = null; // Set of symbol keys once the sprite is loaded

export async function loadSprite(url = './assets/emoji.svg') {
  try {
    const res = await fetch(url); if (!res.ok) return;
    const text = await res.text();
    const holder = document.createElement('div');
    holder.innerHTML = text; // our own static asset
    const svg = holder.firstElementChild; svg.setAttribute('aria-hidden', 'true');
    document.body.prepend(svg);
    available = new Set([...svg.querySelectorAll('symbol')].map(s => s.id.slice(2)));
  } catch { /* offline first load: native emoji fallback */ }
}

/** An element showing the emoji as a picture (decorative; the word is spoken/shown elsewhere). */
export function icon(emoji, cls = 'pic') {
  const key = emojiKey(emoji);
  if (available?.has(key)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#e-${key}`); svg.append(use);
    return svg;
  }
  const span = document.createElement('span');
  span.className = cls + ' native'; span.textContent = emoji; span.setAttribute('aria-hidden', 'true');
  return span;
}
