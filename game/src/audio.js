// Procedural sound, all synthesized with WebAudio — no audio files.
// Engine hum, wind rush, a chime for rings and a thud for crashes.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      // Engine: two detuned saws through a low-pass, pitch follows the throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55.7;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass, loudness follows airspeed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, at, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + at);
    gain.gain.linearRampToValueAtTime(vol || 0.16, ctx.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.05);
  }

  return {
    start,
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = value ? 0 : engineGain.gain.value;
    },
    isMuted() {
      return muted;
    },
    /** Called every frame with the live flight state. */
    update(throttle, speed, flying) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const engineTarget = flying ? 0.05 + throttle * 0.075 : 0;
      engineGain.gain.setTargetAtTime(engineTarget, t, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(48 + throttle * 62, t, 0.1);
      if (engineFilter) engineFilter.frequency.setTargetAtTime(280 + throttle * 620, t, 0.15);
      const windTarget = flying ? Math.min(0.16, (speed / 75) * 0.16) : 0;
      windGain.gain.setTargetAtTime(windTarget, t, 0.2);
      if (windFilter) windFilter.frequency.setTargetAtTime(380 + speed * 9, t, 0.2);
    },
    ringChime() {
      tone(660, 0, 0.22, 'sine', 0.2);
      tone(880, 0.09, 0.28, 'sine', 0.2);
      tone(1320, 0.18, 0.4, 'sine', 0.16);
    },
    crashThud() {
      if (!ctx || muted) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.4);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    },
    fanfare() {
      tone(523, 0, 0.3, 'triangle', 0.2);
      tone(659, 0.12, 0.3, 'triangle', 0.2);
      tone(784, 0.24, 0.4, 'triangle', 0.22);
      tone(1047, 0.38, 0.7, 'triangle', 0.22);
    },
  };
}
