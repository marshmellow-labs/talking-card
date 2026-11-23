// Strip reader: pure functions over {width, height, data: RGBA bytes}. Runs in browser and Node.
// Input is an image roughly containing ONE upright card (portrait), code strip at the bottom.
// The strip is a white band along the card's bottom edge with black blocks at fixed positions.
// We locate the band, find the card's left/right edges, and sample the band across the card's
// full width, so the resulting bit profile is relative to the card (not to where the bars are).

export const BITS = 96;

// The strip encodes an 8-bit number. Cell boundaries as fractions of the card's width, measured from
// the reference photos (a white lead-in covers the left ~19%). Bit 0 (most significant) is leftmost.
const EDGES = [18, 27, 35.5, 47.5, 60, 68, 76.5, 86, 95].map(v => v / 96);
export const CELLS = EDGES.slice(0, 8).map((a, k) => [a, EDGES[k + 1]]);
// Where the card's left/right edges are expected, as fractions of the image width (the app crops the
// camera frame to the on-screen guide plus a small margin).
// y1 = where the card's bottom edge (the strip end) is expected and h = the card's height, both as
// fractions of the image height.
export const DEFAULT_EXPECT = { x0: 0.08, x1: 0.92, y1: 0.94, h: 0.88 };

const lumAt = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
// saturation with a floor on the denominator so near-black noise (3,1,0) doesn't look colorful
const satAt = (d, i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return (mx - mn) / Math.max(mx, 80); };

export function rotate180(img) {
  const { width: w, height: h, data } = img, out = new Uint8ClampedArray(data.length);
  for (let p = 0, q = (w * h - 1) * 4; p < data.length; p += 4, q -= 4) { out[q] = data[p]; out[q + 1] = data[p + 1]; out[q + 2] = data[p + 2]; out[q + 3] = data[p + 3]; }
  return { width: w, height: h, data: out };
}

export function otsu(values) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = t + 0.5; }
  }
  return thr;
}

/** Per-image luminance stats used for relative "white" and "black". */
function lumStats(img) {
  const { width: w, height: h, data } = img, vals = [];
  const step = Math.max(1, Math.floor(Math.sqrt(w * h / 20000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) vals.push(lumAt(data, (y * w + x) * 4));
  vals.sort((a, b) => a - b);
  return { p05: vals[Math.floor(vals.length * 0.05)], p95: vals[Math.floor(vals.length * 0.95)] };
}

/** Classify pixels of a row segment: counts of neutral-white and true-black pixels. */
function levels(img) {
  const { p05, p95 } = lumStats(img), span = Math.max(30, p95 - p05);
  return { hi: p05 + span * 0.45, lo: p05 + span * 0.3, span };
}

/**
 * The strip is the LOWEST horizontal band that is mostly bright neutral paper and contains some
 * true-black bar pixels. (Pale picture boxes have no true black; pictures are higher up.)
 */
export function findStripBand(img, expect = DEFAULT_EXPECT) {
  const { width: w, height: h, data } = img, { hi, lo } = levels(img);
  const x0 = Math.floor(w * 0.04), x1 = Math.ceil(w * 0.96), xs = Math.max(1, Math.floor((x1 - x0) / 200));
  const ok = [];
  for (let y = 0; y < h; y++) {
    let white = 0, black = 0, n = 0;
    for (let x = x0; x < x1; x += xs) {
      const i = (y * w + x) * 4, L = lumAt(data, i), S = satAt(data, i); n++;
      if (L > hi && S < 0.2) white++; else if (L < lo && S < 0.5) black++;
    }
    ok.push(white / n >= 0.2 && (white + black) / n >= 0.5 && black / n >= 0.02);
  }
  const L = (expect.h ?? DEFAULT_EXPECT.h) * h; // expected card height in pixels
  const minLen = Math.max(3, Math.round(L * 0.025));
  let bottom = -1;
  // search for the strip's bottom near where the guide says the card ends
  for (let y = Math.min(h - 1, Math.round(expect.y1 * h + 0.05 * L)); y >= expect.y1 * h - 0.2 * L && bottom < 0; y--) {
    let k = 0; while (k < minLen && y - k >= 0 && (ok[y - k] || ok[y - k - 1])) k++;
    if (k >= minLen) bottom = y + 1;
  }
  if (bottom < 0) return null;
  // Strip top = strongest horizontal edge (row-to-row color change) a little above the bottom.
  const lo2 = Math.max(2, Math.floor(bottom - L * 0.17)), hi2 = Math.floor(bottom - L * 0.03);
  let top = -1, bestD = 0;
  for (let y = lo2 + 1; y <= hi2; y++) {
    let d = 0, n = 0;
    for (let x = x0; x < x1; x += xs) { const i = (y * w + x) * 4, j = ((y - 2) * w + x) * 4; d += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]); n++; }
    d /= n; if (d > bestD) { bestD = d; top = y; }
  }
  if (top < 0) return null;
  // the bottom row found may include a blurred card edge; trim rows that stop being strip-like
  let y1 = bottom; while (y1 - 1 > top && !ok[y1 - 1]) y1--;
  return { y0: top, y1, score: 1 };
}

/** Median luminance and mean saturation of each pixel column across the middle rows of the band. */
function bandColumns(img, band) {
  const { width: w, data } = img, bh = band.y1 - band.y0;
  const ya = band.y0 + Math.floor(bh * 0.3), yb = Math.max(ya + 1, band.y0 + Math.ceil(bh * 0.7));
  const lum = new Array(w), sat = new Array(w);
  for (let x = 0; x < w; x++) {
    const v = []; let s = 0;
    for (let y = ya; y < yb; y++) { const i = (y * w + x) * 4; v.push(lumAt(data, i)); s += satAt(data, i); }
    v.sort((a, b) => a - b); lum[x] = v[v.length >> 1]; sat[x] = s / v.length;
  }
  return { lum, sat };
}

/** Classify band columns as paper-white / printed-black relative to a fitted paper-white line. */
export function classifyColumns({ lum, sat }) {
  const w = lum.length, c0 = Math.floor(w * 0.15), c1 = Math.ceil(w * 0.85), mid = lum.slice(c0, c1), t0 = otsu(mid);
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let x = c0; x < c1; x++) if (lum[x] > t0 && sat[x] < 0.3) { n++; sx += x; sy += lum[x]; sxx += x * x; sxy += x * lum[x]; }
  if (n < 3) return null;
  const den = n * sxx - sx * sx, slope = den ? (n * sxy - sx * sy) / den : 0, icpt = (sy - slope * sx) / n;
  const black = [...mid].sort((a, b) => a - b)[Math.floor(mid.length * 0.03)];
  const white = new Uint8Array(w), dark = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    const wl = icpt + slope * x, r = (lum[x] - black) / Math.max(20, wl - black);
    white[x] = r > 0.7 && r < 1.3 && sat[x] < 0.3 ? 1 : 0;
    dark[x] = r < 0.4 ? 1 : 0;
  }
  return { white, dark, contrast: icpt + slope * (w / 2) - black };
}

/**
 * Fit the card's left edge x0 and width W along the band by brute force, scoring each candidate by
 * how well the code structure fits: every cell clearly dark or clear, white lead-in, and no paper
 * just outside either edge. Then decode the 8 cells. bh = band height (bounds plausible widths).
 */
export function fitAndDecode(cls, bh, expect, known) {
  const { white, dark } = cls, w = white.length;
  const pw = new Float64Array(w + 1), pd = new Float64Array(w + 1), pc = new Float64Array(w + 1);
  for (let x = 0; x < w; x++) { pw[x + 1] = pw[x] + white[x]; pd[x + 1] = pd[x] + dark[x]; pc[x + 1] = pc[x] + (white[x] || dark[x] ? 1 : 0); }
  const frac = (p, a, b) => { a = Math.max(0, Math.round(a)); b = Math.min(w, Math.round(b)); return b > a ? (p[b] - p[a]) / (b - a) : -1; };
  // expected card span (from the on-screen guide); the fit may deviate by ~±14% width / ±10% position
  const eW = (expect.x1 - expect.x0) * w, eX = expect.x0 * w;
  let best = null;
  for (let W = eW * 0.86; W <= eW * 1.14; W += Math.max(1, w / 250)) {
    for (let x0 = eX - eW * 0.1; x0 <= eX + eW * 0.1; x0 += Math.max(1, w / 300)) {
      // nearly whole cells: a misaligned fit puts bar edges inside cells and loses clarity
      const fills = CELLS.map(([a, b]) => frac(pd, x0 + (a + (b - a) * 0.1) * W, x0 + (b - (b - a) * 0.1) * W));
      if (fills.some(f => f < 0)) continue;
      const clar = fills.map(f => Math.abs(f - 0.5) * 2), minC = Math.min(...clar), meanC = clar.reduce((a, b) => a + b) / 8;
      const lead = frac(pd, x0 + 0.03 * W, x0 + 0.16 * W);
      // the card ends at the fitted edges: printed strip just inside, background just outside
      const inL = frac(pw, x0 + 0.01 * W, x0 + 0.05 * W), inR = frac(pc, x0 + 0.95 * W, x0 + 0.99 * W);
      const outL = Math.max(0, frac(pc, x0 - 0.05 * W, x0 - 0.01 * W)), outR = Math.max(0, frac(pc, x0 + 1.01 * W, x0 + 1.05 * W));
      const ones = fills.filter(f => f > 0.5).length;
      // stay close to the guide: 5% off costs 0.25
      const prior = 100 * (((x0 - eX) / eW) ** 2 + ((W - eW) / eW) ** 2);
      const code = fills.reduce((c, f) => c * 2 + (f > 0.5 ? 1 : 0), 0);
      const isKnown = known ? (known.has(code) ? 0.6 : 0) : 0;
      const score = meanC + minC + inL + inR - outL - outR - 2 * lead - (ones ? 0 : 2) - prior + isKnown;
      if (!best || score > best.score) best = { score, x0, W, fills, minC, lead, outL, outR };
    }
  }
  if (!best) return null;
  // final read from the cell centres of the best fit
  best.fills = CELLS.map(([a, b]) => frac(pd, best.x0 + (a + (b - a) * 0.28) * best.W, best.x0 + (b - (b - a) * 0.28) * best.W));
  best.minC = Math.min(...best.fills.map(f => Math.abs(f - 0.5) * 2));
  const code = best.fills.reduce((c, f) => c * 2 + (f > 0.5 ? 1 : 0), 0);
  const confident = best.minC >= 0.5 && best.lead < 0.15 && code > 0 && cls.contrast > 40 && (!known || known.has(code));
  return { code, confident, known: known ? known.has(code) : undefined, fills: best.fills, margin: best.minC, lead: best.lead, score: best.score,
    edges: { x0: Math.round(best.x0), x1: Math.round(best.x0 + best.W) } };
}

function readUpright(img, expect, known) {
  const band = findStripBand(img, expect); if (!band) return null;
  const cls = classifyColumns(bandColumns(img, band)); if (!cls) return null;
  const d = fitAndDecode(cls, band.y1 - band.y0, expect, known); if (!d) return null;
  return { ...d, band: { y0: band.y0, y1: band.y1 } };
}

/**
 * Read a card's code from an image roughly containing one upright card (strip at the bottom).
 * Also tries the image upside down. `expect` is where the on-screen guide puts the card; `known` is
 * the Set of codes printed on real cards (a fit landing on an unused code is likely misaligned).
 * Returns { code, confident, known, fills, band, edges, flipped } or null.
 */
export function readCard(img, { tryFlip = true, expect = DEFAULT_EXPECT, known = null } = {}) {
  const a = readUpright(img, expect, known);
  const b = tryFlip ? readUpright(rotate180(img), { ...expect, x0: 1 - expect.x1, x1: 1 - expect.x0 }, known) : null;
  const rank = r => (r ? (r.confident ? 10 : 0) + r.score : -1e9);
  if (b && rank(b) > rank(a)) return { ...b, flipped: true };
  return a ? { ...a, flipped: false } : null;
}
