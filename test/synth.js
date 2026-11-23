// Synthetic card images for tests: a colored card with the code strip at the bottom, on a textured
// background, with optional noise, blur, lighting gradient and tilt.
import { CELLS } from '../src/detect.js';

export function rng(seed = 1) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

/**
 * @returns {{img, expect}} img is RGBA {width,height,data}; expect is the guide prior for readCard.
 */
export function synthCard(code, { W = 240, H = 380, margin = 0.08, color = [240, 170, 60], noise = 8, gradient = 0.25, tilt = 0, blur = 1, rand = rng(3), bg = [120, 105, 90] } = {}) {
  const data = new Uint8ClampedArray(W * H * 4);
  const cx0 = W * margin, cx1 = W * (1 - margin), cy0 = H * 0.05, cy1 = H * 0.94, L = cy1 - cy0, cw = cx1 - cx0;
  const stripTop = cy1 - 0.088 * L, bits = code.toString(2).padStart(8, '0');
  const t = Math.tan(tilt * Math.PI / 180);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // tilt: shear around the card centre
    const u = x - (y - H / 2) * t, v = y + (x - W / 2) * t;
    let c;
    if (u < cx0 || u > cx1 || v < cy0 || v > cy1) {
      const grain = 25 * Math.sin(v * 0.21 + Math.sin(u * 0.05) * 3);
      c = bg.map(k => k + grain);
    } else if (v >= stripTop) {
      const f = (u - cx0) / cw, cell = CELLS.findIndex(([a, b]) => f >= a && f < b);
      c = cell >= 0 && bits[cell] === '1' ? [18, 18, 22] : [235, 235, 228];
    } else c = color;
    const light = 1 - gradient * (x / W);
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) data[i + k] = c[k] * light + (rand() - 0.5) * 2 * noise;
    data[i + 3] = 255;
  }
  const img = { width: W, height: H, data };
  for (let p = 0; p < blur; p++) boxBlur(img);
  return { img, expect: { x0: margin, x1: 1 - margin, y1: 0.94, h: 0.89 } };
}

function boxBlur(img) {
  const { width: w, height: h, data } = img, src = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) for (let k = 0; k < 3; k++) {
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[((y + dy) * w + x + dx) * 4 + k];
    data[(y * w + x) * 4 + k] = s / 9;
  }
}
