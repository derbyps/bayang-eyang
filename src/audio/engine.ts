import type { Cue } from '../choreo/cues';
import { gong, metallophone, playSfx, type Voices } from './instruments';
import { SLENDRO_HZ, patternNotes, type Pattern } from './patterns';
import { planSchedule } from './scheduler';

const LOOKAHEAD = 0.2;
const MUSIC_LEVEL = 0.55;

export interface AudioEngine {
  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): Promise<void>;
  /** Called every frame with the timeline's cues and the current time. */
  sync(cues: Cue[], t: number, playing: boolean): void;
  seek(t: number): void;
  setMuted(muted: boolean): void;
}

export function createAudio(): AudioEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfxVoices: Voices | null = null;
  let musicVoices: Voices | null = null;
  const live = new Set<AudioScheduledSourceNode>();
  let scheduledUntil = 0;
  let musicUntil = 0;
  let wasPlaying = false;
  let muted = false;

  const track = (node: AudioScheduledSourceNode) => {
    live.add(node);
    node.onended = () => live.delete(node);
  };

  function stopAll() {
    for (const node of live) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    live.clear();
  }

  function patternAt(cues: Cue[], t: number): { pattern: Pattern; start: number } {
    let current: { pattern: Pattern; start: number } = { pattern: 'stop', start: 0 };
    for (const c of cues) {
      if (c.t > t) break;
      if (c.kind === 'music') current = { pattern: c.pattern, start: c.t };
    }
    return current;
  }

  return {
    async unlock() {
      if (!ctx) {
        ctx = new AudioContext();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 3;
        comp.connect(ctx.destination);
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.85;
        master.connect(comp);
        music = ctx.createGain();
        music.gain.value = MUSIC_LEVEL;
        music.connect(master);
        sfxVoices = { ctx, out: master, track };
        musicVoices = { ctx, out: music, track };
      }
      if (ctx.state !== 'running') await ctx.resume();
    },

    sync(cues, t, playing) {
      if (!ctx || !sfxVoices || !musicVoices) return;
      if (!playing) {
        if (wasPlaying) stopAll();
        wasPlaying = false;
        scheduledUntil = musicUntil = t;
        return;
      }
      if (!wasPlaying) scheduledUntil = musicUntil = t;
      wasPlaying = true;
      const toAudio = (cueT: number) => ctx!.currentTime + Math.max(0, cueT - t);

      const plan = planSchedule(cues, scheduledUntil, t, LOOKAHEAD);
      for (const cue of plan.due) {
        if (cue.kind === 'sfx') playSfx(sfxVoices, cue.id, toAudio(cue.t));
      }
      scheduledUntil = plan.scheduledUntil;

      const from = Math.max(musicUntil, t);
      const to = t + LOOKAHEAD;
      if (to > from) {
        // A pattern change inside the window starts on its own cue; schedule each segment.
        const changes = cues.filter((c) => c.kind === 'music' && c.t > from && c.t < to).map((c) => c.t);
        const bounds = [from, ...changes, to];
        for (let i = 0; i < bounds.length - 1; i++) {
          const { pattern, start } = patternAt(cues, bounds[i]);
          for (const n of patternNotes(pattern, bounds[i] - start, bounds[i + 1] - start)) {
            const at = toAudio(start + n.t);
            metallophone(musicVoices, at, SLENDRO_HZ[n.degree], n.gong ? 1 : 0.8);
            if (n.gong) gong(musicVoices, at);
          }
        }
        musicUntil = to;
      }
    },

    seek(t) {
      stopAll();
      scheduledUntil = musicUntil = t;
    },

    setMuted(m) {
      muted = m;
      if (!ctx || !master) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(m ? 0 : 0.85, now + 0.15);
    },
  };
}
