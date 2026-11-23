// Live camera with a card-shaped guide. Frames are cropped to the guide (plus margin) and read
// continuously; a result is reported once several frames in a row agree.
import { readCard } from './detect.js';

export const CARD_ASPECT = 0.676; // card width / height
// The crop around the guide: card spans 8%..92% of the crop width; 5% above, 7% below.
const MX = 0.08 / 0.84, TOP = 0.05, H = 1.12;
const EXPECT = { x0: 0.08, x1: 0.92, y1: (1 + TOP) / H, h: 1 / H };
const SCAN_WIDTH = 320;

export class CardCamera {
  /** @param {HTMLElement} view container holding a <video> and a .guide element */
  constructor(view, { onResult, onState, known, needed = 3 }) {
    this.view = view; this.video = view.querySelector('video'); this.guide = view.querySelector('.guide');
    this.onResult = onResult; this.onState = onState ?? (() => {}); this.known = known; this.needed = needed;
    this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.stream = null; this.timer = null; this.history = []; this.announced = null; this.lastSeen = 0;
  }

  get running() { return !!this.stream; }

  async start() {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the camera here. Open the app over https.');
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    this.video.srcObject = this.stream; await this.video.play();
    this.history = []; this.announced = null;
    this.loop();
  }

  stop() {
    clearTimeout(this.timer); this.timer = null;
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    this.video.srcObject = null; this.setTorch(false).catch(() => {});
  }

  get track() { return this.stream?.getVideoTracks()[0]; }
  get hasTorch() { return !!this.track?.getCapabilities?.().torch; }
  async setTorch(on) { if (this.hasTorch) await this.track.applyConstraints({ advanced: [{ torch: on }] }); }

  /** Guide rectangle mapped into video pixel coordinates (video uses object-fit: cover). */
  cropRect() {
    const v = this.video, vw = v.videoWidth, vh = v.videoHeight; if (!vw) return null;
    const vr = this.view.getBoundingClientRect(), gr = this.guide.getBoundingClientRect();
    const s = Math.max(vr.width / vw, vr.height / vh), ox = (vr.width - vw * s) / 2, oy = (vr.height - vh * s) / 2;
    const gx = (gr.left - vr.left - ox) / s, gy = (gr.top - vr.top - oy) / s, gw = gr.width / s, gh = gr.height / s;
    return { x: gx - gw * MX, y: gy - gh * TOP, w: gw * (1 + 2 * MX), h: gh * H };
  }

  /** Read one frame. */
  grab() {
    const r = this.cropRect(); if (!r) return null;
    const scale = SCAN_WIDTH / r.w, W = SCAN_WIDTH, Hh = Math.round(r.h * scale);
    this.canvas.width = W; this.canvas.height = Hh;
    this.ctx.fillStyle = '#808080'; this.ctx.fillRect(0, 0, W, Hh);
    this.ctx.drawImage(this.video, r.x, r.y, r.w, r.h, 0, 0, W, Hh);
    return readCard(this.ctx.getImageData(0, 0, W, Hh), { expect: EXPECT, known: this.known?.() });
  }

  loop() {
    if (!this.stream) return;
    let res = null;
    try { res = this.grab(); } catch (e) { console.warn(e); }
    this.handle(res);
    this.timer = setTimeout(() => this.loop(), 180);
  }

  handle(res) {
    const now = Date.now();
    // a "clear" read: every cell clearly black or white, regardless of whether the code is known
    const clear = res && res.margin >= 0.5 && res.lead < 0.15 && res.code > 0;
    const key = clear ? res.code : null;
    this.history.push(key); if (this.history.length > this.needed) this.history.shift();
    const stable = this.history.length === this.needed && key !== null && this.history.every(k => k === key);
    this.onState(clear ? (res.confident ? 'reading' : 'unknown') : 'searching');
    if (key !== null) this.lastSeen = now;
    // forget the last card once nothing has been read for a moment, so the same card can be re-announced
    if (this.announced !== null && now - this.lastSeen > 1500) this.announced = null;
    if (stable && key !== this.announced) { this.announced = key; this.onResult(res); }
  }
}
