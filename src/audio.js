export function createAudio() {
  const MUTE_KEY = "stoplight-sim-mute";
  let ctx = null;
  let master = null;
  let engine = null;
  let rumble = null;
  let filter = null;
  let engineGain = null;
  let noiseGain = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  const listeners = new Set();

  function emit() {
    for (const fn of listeners) fn(muted);
  }

  function ensure() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 2.8;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      master.gain.value = muted ? 0.0001 : 0.24;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function now() {
    return ensure().currentTime;
  }

  function envGain(gain, attack, dur) {
    const ac = ensure();
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), ac.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    g.connect(master);
    return g;
  }

  function beep(freq, dur, type = "square", gain = 0.08, slide = 0) {
    const ac = ensure();
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ac.currentTime + dur);
    osc.connect(envGain(gain, 0.008, dur));
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  }

  function chord(freqs, dur, type = "triangle", gain = 0.04) {
    for (const freq of freqs) beep(freq, dur, type, gain);
  }

  function noiseBurst(dur, gain = 0.2, freq = 400, type = "lowpass") {
    const ac = ensure();
    const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filterNode = ac.createBiquadFilter();
    filterNode.type = type;
    filterNode.frequency.setValueAtTime(freq, ac.currentTime);
    filterNode.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.35), ac.currentTime + dur);
    src.connect(filterNode);
    filterNode.connect(envGain(gain, 0.01, dur));
    src.start();
  }

  function makeNoiseLoop() {
    const ac = ensure();
    const seconds = 2;
    const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      data[i] = last;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  return {
    onMuteChange(fn) {
      listeners.add(fn);
      fn(muted);
      return () => listeners.delete(fn);
    },
    isMuted() {
      return muted;
    },
    setMuted(next) {
      muted = Boolean(next);
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      ensure();
      if (master) master.gain.setTargetAtTime(muted ? 0.0001 : 0.24, now(), 0.04);
      emit();
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    unlock() {
      ensure();
    },
    startEngine() {
      const ac = ensure();
      if (engine) return;
      engine = ac.createOscillator();
      rumble = ac.createOscillator();
      engine.type = "sawtooth";
      rumble.type = "square";
      engine.frequency.value = 52;
      rumble.frequency.value = 26;
      filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 240;
      filter.Q.value = 0.8;
      engineGain = ac.createGain();
      engineGain.gain.value = 0.0001;
      engine.connect(filter);
      rumble.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      const noise = makeNoiseLoop();
      const noiseFilter = ac.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 170;
      noiseFilter.Q.value = 1.1;
      noiseGain = ac.createGain();
      noiseGain.gain.value = 0.0001;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      engine.start();
      rumble.start();
      noise.start();
    },
    setEngine(speed, holding, live) {
      if (!engine || !ctx) return;
      const t = ctx.currentTime;
      if (!live) {
        engineGain.gain.setTargetAtTime(0.0001, t, 0.12);
        if (noiseGain) noiseGain.gain.setTargetAtTime(0.0001, t, 0.12);
        return;
      }
      const freq = 46 + speed * 6.4 + (holding ? 4 : 0);
      engine.frequency.setTargetAtTime(freq, t, 0.05);
      rumble.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
      if (filter) filter.frequency.setTargetAtTime(200 + speed * 22 + (holding ? 90 : 0), t, 0.08);
      const vol = speed < 0.35 ? 0.0001 : 0.018 + speed * 0.0038;
      engineGain.gain.setTargetAtTime(vol, t, 0.07);
      if (noiseGain) noiseGain.gain.setTargetAtTime(speed < 0.35 ? 0.0001 : 0.01 + speed * 0.0016, t, 0.08);
    },
    ui() {
      beep(620, 0.05, "triangle", 0.04);
      beep(880, 0.07, "triangle", 0.03);
    },
    gas() {
      beep(92, 0.1, "sine", 0.05, -20);
      noiseBurst(0.08, 0.05, 280);
    },
    count(n) {
      if (n === "GO") {
        chord([392, 523, 784], 0.22, "triangle", 0.055);
        noiseBurst(0.12, 0.06, 900, "highpass");
        return;
      }
      const map = { 3: 392, 2: 330, 1: 262 };
      beep(map[n] || 330, 0.12, "square", 0.05);
    },
    yellow() {
      beep(740, 0.09, "triangle", 0.04);
      setTimeout(() => beep(740, 0.07, "triangle", 0.028), 90);
    },
    pass() {
      beep(523, 0.06, "sine", 0.035);
      beep(784, 0.1, "triangle", 0.04);
    },
    brake() {
      noiseBurst(0.16, 0.09, 1400, "bandpass");
      beep(180, 0.12, "sawtooth", 0.03, -90);
    },
    crash() {
      noiseBurst(0.5, 0.3, 700);
      noiseBurst(0.28, 0.12, 2400, "highpass");
      beep(110, 0.55, "sawtooth", 0.14, -70);
      beep(880, 0.08, "square", 0.04, 400);
    },
    meteor() {
      const ac = ensure();
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(2200, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ac.currentTime + 0.8);
      osc.connect(envGain(0.08, 0.02, 0.84));
      osc.start();
      osc.stop(ac.currentTime + 0.86);
      setTimeout(() => {
        noiseBurst(0.7, 0.36, 480);
        noiseBurst(0.4, 0.18, 2600, "highpass");
        beep(58, 0.8, "sawtooth", 0.2, -24);
        beep(140, 0.35, "square", 0.06, -80);
      }, 740);
    },
    sinkhole() {
      noiseBurst(0.55, 0.16, 140, "lowpass");
      beep(78, 0.7, "sine", 0.09, -40);
      setTimeout(() => {
        noiseBurst(0.45, 0.22, 220, "lowpass");
        noiseBurst(0.28, 0.1, 1600, "highpass");
        beep(46, 0.85, "sawtooth", 0.14, -18);
      }, 380);
    },
    tornado() {
      noiseBurst(1.35, 0.15, 520, "bandpass");
      noiseBurst(1.5, 0.12, 240, "lowpass");
      beep(190, 1.2, "sawtooth", 0.045, 120);
      setTimeout(() => {
        noiseBurst(0.9, 0.14, 880, "highpass");
        beep(140, 0.7, "triangle", 0.05, 90);
      }, 480);
      setTimeout(() => noiseBurst(0.7, 0.16, 400, "bandpass"), 900);
    },
    timeup() {
      chord([440, 554], 0.14, "triangle", 0.045);
      setTimeout(() => chord([349, 523], 0.22, "triangle", 0.05), 140);
    },
    best() {
      chord([523, 659], 0.12, "triangle", 0.05);
      setTimeout(() => chord([659, 784], 0.14, "triangle", 0.05), 110);
      setTimeout(() => chord([784, 1046], 0.22, "triangle", 0.055), 230);
    },
  };
}
