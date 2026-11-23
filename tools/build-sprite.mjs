// Builds assets/emoji.svg: an SVG sprite of the Twemoji graphics used by cards.json.
// Twemoji graphics © Twitter, Inc and other contributors, CC-BY 4.0 (https://github.com/jdecked/twemoji).
// Run after changing emoji in cards.json:  node tools/build-sprite.mjs
import fs from 'node:fs';
import { emojiKey } from '../src/icons.js';

const VERSION = '16.0.1';
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const extra = ['⭐', '🎉', '📷', '🎴', '🎮', '🔊', '⚙️', '🏠', '👍', '🤔'];
const keys = [...new Set([...cards.map(c => c.emoji), ...extra].map(emojiKey))];

let out = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n';
for (const key of keys) {
  const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${VERSION}/assets/svg/${key}.svg`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('missing', key, res.status); continue; }
  const svg = await res.text();
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 36 36';
  out += `<symbol id="e-${key}" viewBox="${viewBox}">${body}</symbol>\n`;
}
out += '</svg>\n';
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/emoji.svg', out);
console.log(`assets/emoji.svg: ${keys.length} symbols, ${(out.length / 1024).toFixed(0)} KB`);
