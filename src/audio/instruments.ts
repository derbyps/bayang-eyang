// Synthesized wayang sounds. Every voice registers its nodes so a seek can silence them.
import type { SfxBeat } from '../script/schema';

export interface Voices {
  ctx: AudioContext;
  out: AudioNode;
  track(node: AudioScheduledSourceNode): void;
}

let noise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let s = 99;
  for (let i = 0; i < data.length; i++) data[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return noise;
}

function envelope(v: Voices, at: number, peak: number, decay: number): GainNode {
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  g.connect(v.out);
  return g;
}

function tone(v: Voices, type: OscillatorType, freq: number, at: number, peak: number, decay: number) {
  const o = v.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.connect(envelope(v, at, peak, decay));
  o.start(at);
  o.stop(at + decay + 0.05);
  v.track(o);
}

function burst(v: Voices, at: number, filter: BiquadFilterType, freq: number, q: number, peak: number, decay: number) {
  const src = v.ctx.createBufferSource();
  src.buffer = noiseBuffer(v.ctx);
  const f = v.ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(envelope(v, at, peak, decay));
  src.start(at);
  src.stop(at + decay + 0.05);
  v.track(src);
}

/** The dalang's wooden knocker against the puppet chest: a dry tap with a body thump. */
function knock(v: Voices, at: number, accent = 1) {
  burst(v, at, 'bandpass', 1000, 4, 0.9 * accent, 0.06);
  tone(v, 'sine', 180, at, 0.5 * accent, 0.08);
}

/** Keprak: bronze plates rattled by the dalang's foot. */
function keprak(v: Voices, at: number) {
  for (const [f, g] of [[3100, 0.12], [4250, 0.09], [5600, 0.06]] as const) tone(v, 'triangle', f, at, g, 0.15);
  burst(v, at, 'highpass', 4000, 0.7, 0.35, 0.12);
  tone(v, 'triangle', 3300, at + 0.045, 0.06, 0.1);
}

export function gong(v: Voices, at: number) {
  tone(v, 'sine', 52, at, 0.45, 4);
  tone(v, 'sine', 52.6, at, 0.35, 4);
  tone(v, 'sine', 104.5, at, 0.08, 2.2);
}

/** A gamelan metallophone (saron/gender) strike: inharmonic bronze partials. */
export function metallophone(v: Voices, at: number, freq: number, velocity = 1) {
  tone(v, 'sine', freq, at, 0.16 * velocity, 1.6);
  tone(v, 'sine', freq * 2.76, at, 0.05 * velocity, 0.7);
  tone(v, 'sine', freq * 5.4, at, 0.018 * velocity, 0.3);
}

export function playSfx(v: Voices, id: SfxBeat['sfx'], at: number) {
  switch (id) {
    case 'cempala-1':
      knock(v, at);
      break;
    case 'cempala-2':
      knock(v, at);
      knock(v, at + 0.12, 0.8);
      break;
    case 'cempala-roll':
      for (let i = 0, t = at; i < 6; i++, t += 0.11 - i * 0.012) knock(v, t, 0.6 + i * 0.07);
      break;
    case 'keprak':
      keprak(v, at);
      break;
    case 'gong':
      gong(v, at);
      break;
  }
}
