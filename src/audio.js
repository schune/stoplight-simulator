export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let filter = null;
  let rumble = null;

  function ensure() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep(freq, dur, type = "square", gain = 0.08) {
    const ac = ensure();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }

  function noiseBurst(dur, gain = 0.2, freq = 400) {
    const ac = ensure();
    const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filterNode = ac.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    src.connect(filterNode);
    filterNode.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    startEngine() {
      const ac = ensure();
      if (engine) return;
      engine = ac.createOscillator();
      const osc2 = ac.createOscillator();
      engine.type = "sawtooth";
      osc2.type = "triangle";
      engine.frequency.value = 55;
      osc2.frequency.value = 110;
      filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 280;
      engineGain = ac.createGain();
      engineGain.gain.value = 0.0001;
      engine.connect(filter);
      osc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engine.start();
      osc2.start();
      rumble = osc2;
    },
    setEngine(speed, holding) {
      if (!engine || !ctx) return;
      const t = ctx.currentTime;
      const freq = 48 + speed * 6.2;
      engine.frequency.setTargetAtTime(freq, t, 0.05);
      if (rumble) rumble.frequency.setTargetAtTime(freq * 2.02, t, 0.05);
      if (filter) filter.frequency.setTargetAtTime(220 + speed * 18 + (holding ? 80 : 0), t, 0.08);
      const vol = speed < 0.4 ? 0.0001 : 0.02 + speed * 0.004;
      engineGain.gain.setTargetAtTime(vol, t, 0.08);
    },
    ui() {
      beep(520, 0.08, "square", 0.05);
    },
    go() {
      beep(180, 0.12, "sawtooth", 0.05);
    },
    yellow() {
      beep(880, 0.07, "square", 0.045);
    },
    pass() {
      beep(660, 0.05, "triangle", 0.04);
    },
    brake() {
      noiseBurst(0.12, 0.08, 900);
    },
    crash() {
      noiseBurst(0.45, 0.28, 500);
      beep(90, 0.5, "sawtooth", 0.12);
    },
    timeup() {
      beep(440, 0.12, "triangle", 0.06);
      setTimeout(() => beep(330, 0.18, "triangle", 0.06), 120);
    },
  };
}
