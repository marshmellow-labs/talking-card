// Finds individual cards lying on a wooden floor (used only to bootstrap patterns from reference photos).
export function cardMask(im) {
  const m = new Uint8Array(im.width * im.height);
  for (let i = 0; i < m.length; i++) {
    const r = im.data[i * 4], g = im.data[i * 4 + 1], b = im.data[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, sat = d / (mx + 1);
    let h = 0;
    if (d > 0) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    if (h < 0) h += 360;
    const woodish = h >= 8 && h <= 48 && sat < 0.42;
    const neutralBright = sat < 0.12 && mx > 165;
    m[i] = (mx > 70 && !woodish) || neutralBright ? 1 : 0;
  }
  return m;
}

function morph(m, w, h, r, erode) {
  // separable square min/max filter
  const tmp = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = erode ? 1 : 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; const p = xx < 0 || xx >= w ? 0 : m[y * w + xx]; v = erode ? v & p : v | p; }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = erode ? 1 : 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; const p = yy < 0 || yy >= h ? 0 : tmp[yy * w + x]; v = erode ? v & p : v | p; }
    out[y * w + x] = v;
  }
  return out;
}

function components(m, w, h) {
  const lab = new Int32Array(m.length).fill(-1), comps = [];
  const stack = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || lab[i] >= 0) continue;
    const pts = []; lab[i] = comps.length; stack.push(i);
    while (stack.length) {
      const j = stack.pop(); pts.push(j);
      const x = j % w, y = (j / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx; if (m[k] && lab[k] < 0) { lab[k] = comps.length; stack.push(k); }
      }
    }
    comps.push(pts);
  }
  return comps;
}

/** Minimal-area rectangle over small angle range. Returns {cx,cy,w,h,a} with w>=h not enforced. */
function minRect(pts, w) {
  let best = null;
  for (let deg = -30; deg <= 30; deg += 0.5) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    // project with robust percentiles to ignore stray leaks
    const us = [], vs = [];
    for (let i = 0; i < pts.length; i += 3) { const x = pts[i] % w, y = (pts[i] / w) | 0; us.push(x * c + y * s); vs.push(-x * s + y * c); }
    us.sort((p, q) => p - q); vs.sort((p, q) => p - q);
    const q = n => Math.floor(n * 0.004);
    const u0 = us[q(us.length)], u1 = us[us.length - 1 - q(us.length)], v0 = vs[q(vs.length)], v1 = vs[vs.length - 1 - q(vs.length)];
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      best = { area, a, w: u1 - u0, h: v1 - v0, cx: uc * c - vc * s, cy: uc * s + vc * c };
    }
  }
  return best;
}

export function findCards(im, { minArea = 6000, maxArea = 30000, single = 14000 } = {}) {
  const W = im.width, H = im.height;
  const mask = cardMask(im);
  const m = morph(morph(mask, W, H, 3, true), W, H, 3, false); // open: cut thin wood leaks
  const out = [];
  for (const p of components(m, W, H)) {
    if (p.length < minArea || p.length > maxArea) continue;
    if (p.length < single * 1.5) { out.push({ ...minRect(p, W), pixels: p.length }); continue; }
    // probably two touching cards: erode harder inside this blob, then grow each part back
    const sub = new Uint8Array(W * H); for (const i of p) sub[i] = 1;
    const er = morph(sub, W, H, 9, true);
    for (const q of components(er, W, H)) {
      if (q.length < 2000) continue;
      const r = minRect(q, W); out.push({ ...r, w: r.w + 18, h: r.h + 18, pixels: (r.w + 18) * (r.h + 18), split: true });
    }
  }
  return out.filter(r => { const ar = Math.max(r.w, r.h) / Math.min(r.w, r.h); return ar > 1.2 && ar < 1.8 && (r.split || r.pixels / (r.w * r.h) > 0.7); });
}
