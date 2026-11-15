// Sound, all synthesised with WebAudio — no audio files, no network. A tiny
// oscillator-and-gain helper builds every effect: the ember pickup blips higher
// as the combo grows, a meteor hit thuds low, a power-up chimes, a level-up
// plays a rising arpeggio and game over falls away. The context is created on
// the first user gesture, so browsers never block it.

export function createSoundBank() {
  let context = null;
  let muted = false;

  function ensureContext() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (muted) return;
    const audio = ensureContext();
    if (audio === null) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const start = audio.currentTime + when;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  return {
    /** Create (or wake) the context from a user gesture. */
    resume() {
      ensureContext();
    },
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    click() {
      tone(520, 0.07, 'triangle', 0.12);
    },
    /** Higher pitch the bigger the combo: catching embers in a row sounds better. */
    pickup(combo) {
      const base = 540 + Math.min(combo, 8) * 70;
      tone(base, 0.12, 'sine', 0.16);
      tone(base * 1.5, 0.1, 'sine', 0.1, 0.05);
    },
    hit() {
      tone(160, 0.28, 'sawtooth', 0.2, 0, 55);
      tone(70, 0.3, 'square', 0.12, 0, 40);
    },
    shieldBreak() {
      tone(880, 0.16, 'triangle', 0.14, 0, 220);
    },
    power() {
      tone(660, 0.1, 'sine', 0.14);
      tone(880, 0.1, 'sine', 0.14, 0.08);
      tone(1320, 0.16, 'sine', 0.12, 0.16);
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone(frequency, 0.14, 'triangle', 0.12, index * 0.07);
      });
    },
    dash() {
      tone(300, 0.14, 'sine', 0.08, 0, 720);
    },
    /** The splitter cracks open mid-fall. */
    split() {
      tone(700, 0.08, 'square', 0.1, 0, 200);
      tone(520, 0.1, 'square', 0.08, 0.05, 160);
    },
    /** A low rumble as the giant rock arrives. */
    boss() {
      tone(90, 0.6, 'sawtooth', 0.2, 0, 45);
      tone(60, 0.6, 'square', 0.1, 0.1, 30);
    },
    /** Surviving the boss: a rising fanfare. */
    bossDodge() {
      [523, 659, 784, 1047, 1319].forEach((frequency, index) => {
        tone(frequency, 0.16, 'triangle', 0.13, index * 0.08);
      });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((frequency, index) => {
        tone(frequency, 0.26, 'triangle', 0.13, index * 0.16);
      });
    },
  };
}
