// Node-only image helpers for tools and tests: decode/encode and simple geometry.
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export function load(path) {
  const buf = fs.readFileSync(path);
  if (path.toLowerCase().endsWith('.png')) {
    const p = PNG.sync.read(buf);
    return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) };
  }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return { width: j.width, height: j.height, data: new Uint8ClampedArray(j.data) };
}

export function savePng(path, img) {
  const p = new PNG({ width: img.width, height: img.height });
  p.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length);
  fs.writeFileSync(path, PNG.sync.write(p));
}

export function saveJpg(path, img, quality = 88) {
  const out = jpeg.encode({ width: img.width, height: img.height, data: Buffer.from(img.data) }, quality);
  fs.writeFileSync(path, out.data);
}

export function blank(width, height, v = 255) {
  const data = new Uint8ClampedArray(width * height * 4).fill(v); for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

/** Sample a rotated rectangle (center cx,cy; size w×h; angle a radians) into an upright w×h image. */
export function warpRect(img, cx, cy, w, h, a) {
  w = Math.round(w); h = Math.round(h);
  const out = blank(w, h, 0);
  const c = Math.cos(a), s = Math.sin(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x - w / 2 + 0.5, v = y - h / 2 + 0.5;
    const sx = cx + u * c - v * s, sy = cy + u * s + v * c;
    const o = (y * w + x) * 4;
    const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    if (ix < 0 || iy < 0 || ix + 1 >= img.width || iy + 1 >= img.height) { out.data[o + 3] = 255; continue; }
    for (let k = 0; k < 3; k++) {
      const p = (yy, xx) => img.data[(yy * img.width + xx) * 4 + k];
      out.data[o + k] = (p(iy, ix) * (1 - fx) + p(iy, ix + 1) * fx) * (1 - fy) + (p(iy + 1, ix) * (1 - fx) + p(iy + 1, ix + 1) * fx) * fy;
    }
    out.data[o + 3] = 255;
  }
  return out;
}

export function crop(img, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(img.width - x, Math.round(w)); h = Math.min(img.height - y, Math.round(h));
  const out = blank(w, h);
  for (let r = 0; r < h; r++) out.data.set(img.data.subarray(((y + r) * img.width + x) * 4, ((y + r) * img.width + x + w) * 4), r * w * 4);
  return out;
}

export function paste(dst, src, x, y) {
  for (let r = 0; r < src.height; r++) {
    const yy = y + r; if (yy < 0 || yy >= dst.height) continue;
    for (let c = 0; c < src.width; c++) {
      const xx = x + c; if (xx < 0 || xx >= dst.width) continue;
      const i = (r * src.width + c) * 4, o = (yy * dst.width + xx) * 4;
      dst.data[o] = src.data[i]; dst.data[o + 1] = src.data[i + 1]; dst.data[o + 2] = src.data[i + 2]; dst.data[o + 3] = 255;
    }
  }
}

export function rect(img, x, y, w, h, [r, g, b]) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue;
    const o = (yy * img.width + xx) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b;
  }
}
