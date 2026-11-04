/**
 * Tiny WebAudio synth. Every sound is generated on the fly, so the game
 * ships without any audio files and stays silent until the player has
 * interacted with the page (browsers require that before audio may start).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  if (master) master.gain.value = value ? 0.22 : 0;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** Call from the first click so the audio context is unlocked. */
export function primeAudio(): void {
  ensure();
}

interface ToneOptions {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone({ freq, duration = 0.16, type = 'sine', gain = 0.6, delay = 0, slideTo }: ToneOptions): void {
  const audio = ensure();
  if (!audio || !master || !enabled) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), start + duration);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noise(duration = 0.3, gain = 0.28): void {
  const audio = ensure();
  if (!audio || !master || !enabled) return;
  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying noise burst: reads as dice tumbling on wood.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2.2;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1600;
  filter.Q.value = 0.9;
  const env = audio.createGain();
  env.gain.value = gain;
  source.connect(filter).connect(env).connect(master);
  source.start();
}

export const sfx = {
  dice(): void {
    noise(0.42, 0.3);
    tone({ freq: 220, duration: 0.1, type: 'triangle', gain: 0.25, delay: 0.34 });
  },
  /** A soft wooden tap for each space a piece lands on. */
  step(): void {
    tone({ freq: 560, duration: 0.07, type: 'triangle', gain: 0.16, slideTo: 380 });
  },
  cashIn(): void {
    tone({ freq: 660, duration: 0.12, type: 'triangle', gain: 0.4 });
    tone({ freq: 990, duration: 0.18, type: 'triangle', gain: 0.32, delay: 0.09 });
  },
  cashOut(): void {
    tone({ freq: 420, duration: 0.14, type: 'triangle', gain: 0.35, slideTo: 200 });
  },
  buy(): void {
    tone({ freq: 523, duration: 0.12, type: 'sine', gain: 0.4 });
    tone({ freq: 659, duration: 0.12, type: 'sine', gain: 0.4, delay: 0.1 });
    tone({ freq: 784, duration: 0.22, type: 'sine', gain: 0.42, delay: 0.2 });
  },
  build(): void {
    tone({ freq: 300, duration: 0.09, type: 'square', gain: 0.22 });
    tone({ freq: 440, duration: 0.12, type: 'square', gain: 0.2, delay: 0.08 });
  },
  card(): void {
    tone({ freq: 880, duration: 0.2, type: 'sine', gain: 0.3, slideTo: 1320 });
  },
  jail(): void {
    tone({ freq: 180, duration: 0.34, type: 'sawtooth', gain: 0.3, slideTo: 90 });
  },
  turn(): void {
    tone({ freq: 740, duration: 0.14, type: 'sine', gain: 0.3 });
  },
  error(): void {
    tone({ freq: 190, duration: 0.18, type: 'square', gain: 0.24 });
  },
  bankrupt(): void {
    tone({ freq: 340, duration: 0.5, type: 'sawtooth', gain: 0.3, slideTo: 70 });
  },
  win(): void {
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone({ freq, duration: 0.3, type: 'triangle', gain: 0.38, delay: i * 0.13 });
    });
  },
};
