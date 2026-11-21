'use client';

const SOUND_PREF_KEY = 'tm-lingo-sfx-muted';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

export function isSoundEffectsMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_PREF_KEY) === '1';
}

export function setSoundEffectsMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_PREF_KEY, muted ? '1' : '0');
}

function playTone(
  freq: number,
  durationSec: number,
  delaySec = 0,
  volume = 0.08,
  type: OscillatorType = 'sine'
): void {
  if (isSoundEffectsMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export function playSuccessChime(): void {
  playTone(523.25, 0.16, 0, 0.07, 'triangle'); // C5
  playTone(659.25, 0.18, 0.09, 0.07, 'triangle'); // E5
  playTone(783.99, 0.24, 0.18, 0.08, 'sine'); // G5
}

export function playGentleTryAgain(): void {
  playTone(349.23, 0.14, 0, 0.05, 'sine'); // F4
  playTone(329.63, 0.18, 0.1, 0.045, 'sine'); // E4
}

export function playCardFlip(): void {
  playTone(440, 0.07, 0, 0.04, 'triangle');
}

export function playPageTurn(): void {
  playTone(392, 0.08, 0, 0.035, 'sine');
  playTone(493.88, 0.09, 0.05, 0.035, 'sine');
}

export function playCelebrationFanfare(): void {
  playTone(523.25, 0.15, 0, 0.07, 'triangle');
  playTone(659.25, 0.15, 0.1, 0.07, 'triangle');
  playTone(783.99, 0.15, 0.2, 0.07, 'triangle');
  playTone(1046.5, 0.35, 0.32, 0.08, 'sine');
}
