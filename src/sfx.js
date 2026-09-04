// ─── Sound Effects ────────────────────────────────────────────────────────────

// Synthesized via Web Audio API — no external audio assets required.
// AudioContext starts suspended until resumed inside a user-gesture call stack,
// which _ensureCtx() does on every call (cheap no-op once already running).
class SFX {
  constructor() {
    this.ctx = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  _tone({ freq, startFreq, endFreq, duration, type = "sine", gain = 0.15, delay = 0 }) {
    const ctx = this._ensureCtx();
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    if (startFreq != null && endFreq != null) {
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
    } else {
      osc.frequency.setValueAtTime(freq, now);
    }
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Sheep step — light, bright blip
  sheepStep() {
    this._tone({ freq: 520, duration: 0.08, type: "sine", gain: 0.12 });
  }

  // Wolf step — lower, heavier blip so it reads as a different piece type
  wolfStep() {
    this._tone({ freq: 220, duration: 0.09, type: "triangle", gain: 0.14 });
  }

  // Sheep placement — light pop, slightly higher than a sheep step
  place() {
    this._tone({ freq: 660, duration: 0.07, type: "sine", gain: 0.1 });
  }

  // Wolf capture — descending growl
  capture() {
    this._tone({ startFreq: 320, endFreq: 90, duration: 0.18, type: "sawtooth", gain: 0.09 });
  }

  // Piece has no legal action (e.g. a blocked wolf) — low double-buzz "denied" cue
  stuck() {
    this._tone({ freq: 160, duration: 0.07, type: "square", gain: 0.1 });
    this._tone({ freq: 130, duration: 0.09, type: "square", gain: 0.1, delay: 0.08 });
  }
}

export { SFX };
