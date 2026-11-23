// Text to speech with a chosen English voice.
import { store } from './store.js';

const synth = globalThis.speechSynthesis;
let voices = [];
function loadVoices() { voices = synth?.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang)) ?? []; }
loadVoices();
synth?.addEventListener?.('voiceschanged', loadVoices);

export const listVoices = () => voices;

function pickVoice() {
  const want = store.get().settings.voice;
  return voices.find(v => v.name === want)
    ?? voices.find(v => v.lang.replace('_', '-') === navigator.language)
    ?? voices.find(v => v.default) ?? voices[0];
}

/** Speak text; resolves when finished (or immediately when speech is unavailable). */
export function say(text, { interrupt = true } = {}) {
  return new Promise(resolve => {
    if (!synth || !text) return resolve();
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = store.get().settings.rate; u.pitch = 1.05;
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}
