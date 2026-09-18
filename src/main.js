import "./style.css";
import { createAudio } from "./audio.js";
import { authState, onAuthChange, signInWithGoogle, signOut, startAuth } from "./auth.js";
import { fetchBoard, loadProfile, saveRun } from "./scores.js";

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const audio = createAudio();

const BEST_KEY = "stoplight-sim-best";
const RUN_SECONDS = 60;
const MAX_SPEED = 34;
const ACCEL = 16;
const BRAKE = 24;
const CAR_LENGTH = 4.2;
const ROAD_HALF = 4.6;
const DEPTH_K = 26;
const ROAD_NEAR = 0.48;
const ROAD_FAR = 0.11;
const STOP_LINE = 2.2;
const BOX = 7.2;
const COLORS = {
  red: "#ff2d4a",
  yellow: "#ffc01a",
  green: "#22e38a",
};

const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const STARS = Array.from({ length: 72 }, (_, i) => ({
  x: ((i * 137.508) % 1),
  y: ((i * 61.803) % 1),
  s: 0.6 + (i % 5) * 0.35,
  tw: 0.4 + (i % 7) * 0.11,
}));

const els = {
  title: document.getElementById("title"),
  result: document.getElementById("result"),
  hud: document.getElementById("hud"),
  pedalWrap: document.getElementById("pedal-wrap"),
  pedal: document.getElementById("pedal"),
  pedalState: document.getElementById("pedal-state"),
  time: document.getElementById("hud-time"),
  dist: document.getElementById("hud-dist"),
  speed: document.getElementById("hud-speed"),
  countdown: document.getElementById("countdown"),
  toast: document.getElementById("toast"),
  flash: document.getElementById("flash"),
  titleBest: document.getElementById("title-best"),
  resultKicker: document.getElementById("result-kicker"),
  resultTitle: document.getElementById("result-title"),
  resultNew: document.getElementById("result-new"),
  resultFlavor: document.getElementById("result-flavor"),
  statDist: document.getElementById("stat-dist"),
  statLights: document.getElementById("stat-lights"),
  statBest: document.getElementById("stat-best"),
  lamps: [...document.querySelectorAll(".logo-lights .lamp")],
  authBar: document.getElementById("auth-bar"),
  authError: document.getElementById("auth-error"),
  btnIn: document.getElementById("btn-in"),
  btnOut: document.getElementById("btn-out"),
  btnSave: document.getElementById("btn-save"),
  btnBoard: document.getElementById("btn-board"),
  btnBoardClose: document.getElementById("btn-board-close"),
  authUser: document.getElementById("auth-user"),
  authName: document.getElementById("auth-name"),
  authPhoto: document.getElementById("auth-photo"),
  board: document.getElementById("board"),
  boardList: document.getElementById("board-list"),
  boardEmpty: document.getElementById("board-empty"),
  mute: document.getElementById("btn-mute"),
};

const flavorRed = [
  "The light saw you. The light won.",
  "Yellow is a suggestion. Red is a wall.",
  "You gambled. The city collected.",
  "Next time, maybe try brakes.",
  "That one was never going to stay yellow.",
];

const flavorTime = [
  "Minute's up. That's the run.",
  "You lived. Barely. That's a score.",
  "Night shift over. Count it.",
  "No reds. Just the clock.",
];

const OMEN = {
  meteor: {
    kicker: "NATURE WINS",
    title: "METEOR",
    flavor: [
      "You beat the light. You did not beat the sky.",
      "Yellow was never the problem.",
      "Hold to drive. Let go to vapor.",
    ],
  },
  sinkhole: {
    kicker: "THE STREET FOLDED",
    title: "SINKHOLE",
    flavor: [
      "You stopped for the light. The pavement did not.",
      "The city collected. Personally.",
      "Hold to drive. Let go to the mantle.",
    ],
  },
  tornado: {
    kicker: "AIR TOOK THE WHEEL",
    title: "TORNADO",
    flavor: [
      "You had the right of way. The air had the car.",
      "Brakes work on pavement. You were not on pavement.",
      "The light is still down there. Probably.",
    ],
  },
};

const state = {
  mode: "title",
  holding: false,
  wasHolding: false,
  carY: 0,
  speed: 0,
  time: 0,
  remaining: RUN_SECONDS,
  lights: [],
  buildings: [],
  lamps: [],
  cleared: 0,
  shake: 0,
  flash: 0,
  countdown: 0,
  crashLight: null,
  lastYellow: -1,
  toastAt: 0,
  toastText: "",
  attractT: 0,
  lastRun: null,
  particles: [],
  kick: 0,
  countShown: "",
  crashT: 0,
  omen: null,
  omenAt: 0,
  disasterType: null,
  disasterT: 0,
};

let width = 390;
let height = 844;
let horizon = 280;
let dpr = 1;
let last = performance.now();

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function getBest() {
  return Number(localStorage.getItem(BEST_KEY) || 0);
}

function setBest(n) {
  const best = Math.max(getBest(), Math.round(n));
  localStorage.setItem(BEST_KEY, String(best));
  return best;
}

function cycleOf(light) {
  return light.green + light.yellow + light.red;
}

function phaseOf(light, t) {
  const c = cycleOf(light);
  return ((t + light.offset) % c + c) % c;
}

function colorOf(light, t) {
  const p = phaseOf(light, t);
  if (p < light.green) return "green";
  if (p < light.green + light.yellow) return "yellow";
  return "red";
}

function yellowLeft(light, t) {
  const p = phaseOf(light, t);
  if (p < light.green || p >= light.green + light.yellow) return 0;
  return light.green + light.yellow - p;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function generateWorld() {
  const lights = [];
  let y = rand(72, 96);
  while (y < 3200) {
    const late = clamp(y / 1800, 0, 1);
    const spacing = rand(26, 56) - late * 8;
    const green = rand(1.5, 3.4) - late * 0.35;
    const yellow = rand(0.85, 1.25);
    const red = rand(1.25, 3.2);
    const pace = 18 + rand(-3, 4);
    const cyc = green + yellow + red;
    const synced = (y / pace) % cyc;
    const offset = Math.random() < 0.42 ? rand(0, cyc) : synced + rand(-0.9, 0.9);
    lights.push({
      y,
      green,
      yellow,
      red,
      offset,
      side: Math.random() < 0.5 ? -1 : 1,
      entered: false,
      legal: false,
      passed: false,
    });
    y += Math.max(22, spacing);
  }

  const buildings = [];
  for (let i = 0; i < 90; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    buildings.push({
      z: i * 32 + rand(0, 18),
      side,
      w: rand(6, 14),
      d: rand(8, 18),
      h: rand(8, 28),
      shade: rand(0.04, 0.12),
      neon: Math.random() < 0.22 ? pick(["#22e38a", "#ff2d4a", "#7aa2ff", "#ffc01a"]) : null,
    });
  }

  const lamps = [];
  for (let i = 0; i < 70; i++) {
    lamps.push({
      z: 20 + i * 38 + rand(-8, 8),
      side: i % 2 === 0 ? -1 : 1,
    });
  }

  return { lights, buildings, lamps };
}

function resetRun(mode) {
  const world = generateWorld();
  state.mode = mode;
  state.carY = 0;
  state.speed = 0;
  state.time = 0;
  state.remaining = RUN_SECONDS;
  state.lights = world.lights;
  state.buildings = world.buildings;
  state.lamps = world.lamps;
  state.cleared = 0;
  state.shake = 0;
  state.flash = 0;
  state.crashLight = null;
  state.lastYellow = -1;
  state.toastAt = 0;
  state.particles = [];
  state.kick = 0;
  state.countShown = "";
  state.crashT = 0;
  state.omen = null;
  state.omenAt = 0;
  state.disasterType = null;
  state.disasterT = 0;
}

const hideTimers = new WeakMap();

function show(el) {
  const pending = hideTimers.get(el);
  if (pending) {
    clearTimeout(pending);
    hideTimers.delete(el);
  }
  el.classList.remove("is-exit");
  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
}

function hide(el) {
  el.setAttribute("aria-hidden", "true");
  const pending = hideTimers.get(el);
  if (pending) {
    clearTimeout(pending);
    hideTimers.delete(el);
  }
  if (el.classList.contains("panel") && !el.classList.contains("hidden") && !REDUCE) {
    el.classList.add("is-exit");
    hideTimers.set(
      el,
      window.setTimeout(() => {
        if (el.getAttribute("aria-hidden") === "true") {
          el.classList.add("hidden");
          el.classList.remove("is-exit");
        }
        hideTimers.delete(el);
      }, 320)
    );
    return;
  }
  el.classList.add("hidden");
}

function rumble(pattern) {
  if (REDUCE) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function flashScreen(kind = "bad", ms = 280) {
  els.flash.className = kind === "go" ? "go on" : kind === "good" ? "good on" : kind === "omen" ? "omen on" : "on";
  setTimeout(() => {
    els.flash.className = "";
  }, ms);
}

function punchCountdown() {
  els.countdown.classList.remove("punch");
  void els.countdown.offsetWidth;
  els.countdown.classList.add("punch");
}

function spark(x, y, { vx, vy, life = 0.4, size = 3, color = "#ff8a3d", g = 90 } = {}) {
  state.particles.push({ x, y, vx, vy, life, size, color, g });
}

function rollOmen() {
  if (Math.random() >= 0.01) {
    state.omen = null;
    state.omenAt = 0;
    return;
  }
  state.omen = pick(["meteor", "sinkhole", "tornado"]);
  state.omenAt = rand(12, 47);
}

function beginDisaster(type) {
  if (state.mode === "title" || state.mode === "result" || state.mode === "crash" || state.mode === "disaster") return;
  const kind = OMEN[type] ? type : pick(["meteor", "sinkhole", "tornado"]);
  if (state.mode === "countdown") hide(els.countdown);
  state.mode = "disaster";
  state.disasterType = kind;
  state.disasterT = 0;
  state.holding = false;
  state.omen = null;
  const play = audio[kind];
  if (typeof play === "function") play.call(audio);
  if (kind === "meteor") rumble([20, 40, 30, 80, 120]);
  if (kind === "sinkhole") rumble([40, 30, 70, 40, 90]);
  if (kind === "tornado") rumble([18, 18, 18, 18, 40, 80]);
  const dur = kind === "meteor" ? 1850 : kind === "sinkhole" ? 1700 : 2050;
  setTimeout(() => {
    if (state.mode === "disaster") endRun(kind);
  }, dur);
}

function burst(kind, n = 10) {
  if (REDUCE) return;
  const x = width / 2;
  const y = carScreenY() + 8;
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0);
    const spd = kind === "crash" ? rand(80, 260) : rand(20, 90);
    state.particles.push({
      kind,
      x: x + rand(-28, 28),
      y: y + rand(-8, 12),
      vx: Math.cos(a) * spd * (kind === "crash" ? 1 : 0.35),
      vy: Math.sin(a) * spd,
      life: kind === "crash" ? rand(0.35, 0.8) : rand(0.18, 0.42),
      max: 1,
      size: kind === "crash" ? rand(2, 5) : rand(1.5, 3.2),
      color: kind === "brake" ? "#ff6b7d" : kind === "gas" ? "#c9b48a" : pick(["#ff2d4a", "#ffc01a", "#f4efe4", "#ff8a3d"]),
      g: 90,
    });
  }
}

let statTok = new WeakMap();
function countUp(el, to, suffix = "", dur = 620) {
  const target = Math.round(to);
  if (REDUCE) {
    el.textContent = `${target}${suffix}`;
    return;
  }
  const id = (statTok.get(el) || 0) + 1;
  statTok.set(el, id);
  const start = performance.now();
  const tickStat = (now) => {
    if (statTok.get(el) !== id) return;
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = `${Math.round(target * eased)}${suffix}`;
    if (t < 1) requestAnimationFrame(tickStat);
  };
  requestAnimationFrame(tickStat);
}

function syncMuteUi() {
  const muted = audio.isMuted();
  els.mute.classList.toggle("is-muted", muted);
  els.mute.setAttribute("aria-pressed", muted ? "true" : "false");
  els.mute.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
}

function resize() {
  const app = document.getElementById("app");
  width = app.clientWidth;
  height = app.clientHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  horizon = height * 0.33;
}

function carScreenY() {
  return height * 0.68;
}

function depthT(z) {
  const depth = Math.max(0.5, z);
  return 1 - DEPTH_K / (DEPTH_K + depth);
}

function roadHalfPx(t) {
  return lerp(width * ROAD_NEAR, width * ROAD_FAR, Math.min(t, 1));
}

function project(x, z) {
  const t = depthT(z);
  const y = lerp(carScreenY(), horizon, t);
  const scale = lerp(36, 4.2, t ** 0.7);
  const halfPx = roadHalfPx(t);
  return {
    x: width / 2 + (x / ROAD_HALF) * halfPx,
    y,
    scale,
    t,
    halfPx,
  };
}

function stoppingDistance(speed) {
  return (speed * speed) / (2 * BRAKE) + 3.5;
}

function nextLight() {
  const front = state.carY + CAR_LENGTH * 0.5;
  for (const light of state.lights) {
    if (!light.passed && light.y + BOX > front) return light;
  }
  return null;
}

function updateAttract(dt) {
  state.attractT += dt;
  state.time += dt;
  const light = nextLight();
  let wantGo = true;
  if (light) {
    const dist = light.y - STOP_LINE - (state.carY + CAR_LENGTH * 0.5);
    const color = colorOf(light, state.time);
    if ((color === "red" || color === "yellow") && dist < stoppingDistance(state.speed) * 1.15) {
      wantGo = false;
    }
    if (color === "green" && dist > 8) wantGo = true;
  }
  state.holding = wantGo;
  integrate(dt);
  if (state.carY > 2200) {
    resetRun("title");
  }
}

function integrate(dt) {
  if (state.holding) {
    state.speed += ACCEL * dt;
  } else {
    state.speed -= BRAKE * dt;
  }
  state.speed = clamp(state.speed, 0, MAX_SPEED);
  state.carY += state.speed * dt;
}

function crash(light) {
  if (state.mode !== "play") return;
  state.mode = "crash";
  state.crashLight = light;
  state.crashT = 0;
  state.speed = 0;
  state.shake = REDUCE ? 0 : 12;
  state.flash = 1;
  audio.crash();
  rumble([30, 40, 70, 40, 120]);
  burst("crash", 28);
  flashScreen("bad", 320);
  setTimeout(() => endRun("red"), 780);
}

function endRun(reason) {
  if (state.mode === "result") return;
  const dist = Math.round(state.carY);
  const prevBest = getBest();
  const best = setBest(dist);
  const isNew = dist > prevBest;
  state.mode = "result";
  state.lastRun = { distance: dist, lights: state.cleared, reason };
  hide(els.hud);
  hide(els.pedalWrap);
  hide(els.countdown);
  show(els.result);
  show(els.authBar);
  const omen = OMEN[reason];
  const red = reason === "red";
  if (omen) {
    els.resultKicker.textContent = omen.kicker;
    els.resultTitle.textContent = omen.title;
    els.resultTitle.className = "omen";
    els.resultFlavor.textContent = pick(omen.flavor);
  } else {
    els.resultKicker.textContent = red ? "YOU RAN IT" : "SHIFT OVER";
    els.resultTitle.textContent = red ? "CAUGHT RED" : "TIME";
    els.resultTitle.className = red ? "bad" : "good";
    els.resultFlavor.textContent = red ? pick(flavorRed) : pick(flavorTime);
  }
  if (isNew) {
    show(els.resultNew);
    audio.best();
  } else {
    hide(els.resultNew);
    if (!red && !omen) audio.timeup();
  }
  countUp(els.statDist, dist, " m");
  countUp(els.statLights, state.cleared, "", 480);
  els.statBest.textContent = `${best} m`;
  els.titleBest.textContent = String(best);
  if (!red && !omen) flashScreen("good", 420);
  syncAuthUi();
  void postRun();
}

function toast(text) {
  state.toastText = text;
  state.toastAt = performance.now();
  els.toast.textContent = text;
  els.toast.classList.remove("hidden");
  els.toast.style.animation = "none";
  void els.toast.offsetWidth;
  els.toast.style.animation = "";
  setTimeout(() => {
    if (els.toast.textContent === text) els.toast.classList.add("hidden");
  }, 700);
}

function updatePlay(dt) {
  if (state.mode === "countdown") {
    state.countdown -= dt;
    state.time += dt;
    const n = Math.ceil(state.countdown);
    const shown = n > 0 ? String(n) : "GO";
    if (shown !== state.countShown) {
      state.countShown = shown;
      els.countdown.textContent = shown;
      els.countdown.classList.toggle("go", shown === "GO");
      punchCountdown();
      audio.count(shown);
      rumble(shown === "GO" ? 24 : 10);
      if (shown === "GO") {
        state.kick = 0;
        flashScreen("go", 220);
      }
    }
    if (state.countdown <= 0) {
      state.mode = "play";
      hide(els.countdown);
    }
    return;
  }

  const elapsed = RUN_SECONDS - state.remaining;
  if (state.omen && elapsed >= state.omenAt) {
    const kind = state.omen;
    state.omen = null;
    beginDisaster(kind);
    return;
  }

  state.time += dt;
  state.remaining -= dt;
  integrate(dt);

  if (state.holding && !state.wasHolding) {
    audio.gas();
    burst("gas", 6);
  }
  if (!state.holding && state.wasHolding && state.speed > 4) {
    audio.brake();
    burst("brake", 10);
  }
  if (state.holding && state.speed > 6 && Math.random() < dt * 8) burst("gas", 1);
  if (!state.holding && state.speed > 10 && Math.random() < dt * 10) burst("brake", 1);

  const front = state.carY + CAR_LENGTH * 0.5;
  const rear = state.carY - CAR_LENGTH * 0.5;

  for (const light of state.lights) {
    if (light.passed) continue;
    const color = colorOf(light, state.time);
    const stop = light.y - STOP_LINE;
    const clear = light.y + BOX;

    if (color === "yellow") {
      const idx = state.lights.indexOf(light);
      if (state.lastYellow !== idx && stop - front < 55 && stop - front > 0) {
        state.lastYellow = idx;
        audio.yellow();
        rumble(12);
      }
    }

    if (front >= stop + 0.12) {
      if (!light.entered) {
        light.entered = true;
        if (color === "red") {
          crash(light);
          return;
        }
        light.legal = true;
        if (color === "yellow" && yellowLeft(light, state.time) < 0.28) {
          toast("CLOSE");
        }
      }
    }

    if (rear > clear) {
      light.passed = true;
      state.cleared += 1;
      audio.pass();
      rumble(8);
    }
  }

  if (state.remaining <= 0) {
    state.remaining = 0;
    state.speed = 0;
    endRun("time");
  }
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 50);
  g.addColorStop(0, "#05060f");
  g.addColorStop(0.42, "#0c1024");
  g.addColorStop(0.78, "#1a1528");
  g.addColorStop(1, "#3a2418");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const moonX = width * 0.78;
  const moonY = horizon * 0.34;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 70);
  moonGlow.addColorStop(0, "rgba(255, 236, 200, 0.55)");
  moonGlow.addColorStop(0.35, "rgba(255, 214, 150, 0.12)");
  moonGlow.addColorStop(1, "rgba(255, 214, 150, 0)");
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4ead2";
  ctx.beginPath();
  ctx.arc(moonX, moonY, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#05060f";
  ctx.beginPath();
  ctx.arc(moonX + 5, moonY - 3, 11, 0, Math.PI * 2);
  ctx.fill();

  for (const star of STARS) {
    const tw = 0.35 + Math.abs(Math.sin(state.time * star.tw + star.x * 8)) * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${0.28 + tw * 0.5})`;
    const x = star.x * width;
    const y = 8 + star.y * (horizon - 28);
    const s = star.s * (tw > 0.85 ? 1.6 : 1);
    ctx.fillRect(x, y, s, s);
  }

  const haze = ctx.createRadialGradient(width / 2, horizon, 8, width / 2, horizon, width * 0.78);
  haze.addColorStop(0, "rgba(255, 132, 62, 0.28)");
  haze.addColorStop(0.45, "rgba(255, 90, 50, 0.08)");
  haze.addColorStop(1, "rgba(255, 90, 50, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 90, width, 130);
}

function drawCity() {
  const baseY = horizon;
  for (let i = 0; i < 34; i++) {
    const x = (i / 34) * width - 6;
    const w = width / 15 + ((i * 11) % 10);
    const h = 22 + ((i * 19) % 48);
    ctx.fillStyle = i % 4 === 0 ? "#080910" : "#0b0d16";
    ctx.fillRect(x, baseY - h, w - 2, h);
    ctx.fillStyle = "rgba(255, 210, 120, 0.16)";
    for (let wdw = 0; wdw < 6; wdw++) {
      if ((i + wdw) % 3 === 0) continue;
      const on = Math.sin(state.time * 0.7 + i * 2 + wdw) > -0.35;
      if (!on) continue;
      ctx.fillRect(x + 3 + (wdw % 3) * 6, baseY - h + 6 + Math.floor(wdw / 3) * 10, 2, 2);
    }
  }
}

function nearCrosswalk(worldZ) {
  for (const light of state.lights) {
    const dz = light.y - STOP_LINE - worldZ;
    if (dz > -1.4 && dz < 4.2) return true;
  }
  return false;
}

function drawRoad() {
  const yn = height;
  const cx = width / 2;
  const span = Math.max(1, carScreenY() - horizon);
  for (let sy = Math.floor(horizon); sy < yn; sy += 2) {
    const t = Math.min(0.985, (carScreenY() - sy) / span);
    const z = DEPTH_K / (1 - t) - DEPTH_K;
    const worldZ = state.carY + z;
    const half = roadHalfPx(t);
    const rumbleStrip = Math.floor(worldZ / 4.2) % 2 === 0;
    const xwalk = z > 0 && nearCrosswalk(worldZ);
    ctx.fillStyle = rumbleStrip ? "#1a171f" : "#141118";
    ctx.fillRect(cx - half - 18, sy, 18, 2);
    ctx.fillRect(cx + half, sy, 18, 2);
    ctx.fillStyle = rumbleStrip ? "#4a3f4c" : "#322c38";
    ctx.fillRect(cx - half - 5, sy, 5, 2);
    ctx.fillRect(cx + half, sy, 5, 2);
    const wet = 0.1 + Math.sin(worldZ * 0.16 + state.time) * 0.04;
    if (xwalk) {
      const stripe = Math.floor(worldZ * 1.7) % 2 === 0;
      ctx.fillStyle = stripe ? `rgb(${48 + wet * 40}, ${48 + wet * 36}, ${54 + wet * 40})` : `rgb(${22 + wet * 40}, ${24 + wet * 36}, ${32 + wet * 48})`;
    } else {
      ctx.fillStyle = `rgb(${14 + wet * 52}, ${16 + wet * 48}, ${24 + wet * 60})`;
    }
    ctx.fillRect(cx - half, sy, half * 2, 2);
    if (!xwalk && z > 8 && Math.floor(worldZ / 5.1) % 2 === 0) {
      ctx.fillStyle = "rgba(236, 214, 118, 0.92)";
      const dw = clamp(lerp(8, 1.1, Math.max(0, t)), 1.1, 8);
      ctx.fillRect(cx - dw / 2, sy, dw, 2);
    }
  }

  const fade = ctx.createLinearGradient(0, horizon, 0, horizon + 90);
  fade.addColorStop(0, "rgba(58, 36, 24, 0.72)");
  fade.addColorStop(1, "rgba(58, 36, 24, 0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon, width, 90);
}

function drawBuildings() {
  const vis = state.buildings
    .map((b) => ({ b, z: b.z - state.carY }))
    .filter((x) => x.z > 6 && x.z < 210)
    .sort((a, b) => b.z - a.z);

  for (const { b, z } of vis) {
    const x = b.side * (ROAD_HALF + 8 + b.w * 0.4);
    const p = project(x, z);
    const bw = Math.max(10, b.w * p.scale * 0.42);
    const bh = Math.max(16, b.h * p.scale * 0.5);
    const x0 = p.x - bw / 2;
    const y0 = p.y - bh;
    const skew = b.side * Math.max(4, bw * 0.18);
    ctx.fillStyle = `rgba(${8 + b.shade * 40}, ${10 + b.shade * 30}, ${18 + b.shade * 40}, 0.92)`;
    ctx.fillRect(x0, y0, bw, bh);
    ctx.fillStyle = "rgba(4, 5, 10, 0.55)";
    ctx.beginPath();
    ctx.moveTo(b.side < 0 ? x0 : x0 + bw, y0);
    ctx.lineTo(b.side < 0 ? x0 + skew : x0 + bw + skew, y0 - bh * 0.04);
    ctx.lineTo(b.side < 0 ? x0 + skew : x0 + bw + skew, p.y);
    ctx.lineTo(b.side < 0 ? x0 : x0 + bw, p.y);
    ctx.closePath();
    ctx.fill();
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.55 + Math.sin(state.time * 4 + b.z) * 0.12;
      ctx.fillRect(x0 + bw * 0.16, y0 + bh * 0.16, bw * 0.68, Math.max(2, bh * 0.07));
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(255, 214, 130, 0.22)";
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if ((r + c + (b.z | 0)) % 3 === 0) continue;
        const flicker = Math.sin(state.time * 1.4 + b.z + r * 3 + c) > -0.7;
        if (!flicker) continue;
        ctx.fillRect(
          x0 + bw * (0.18 + c * 0.24),
          y0 + bh * (0.2 + r * 0.14),
          Math.max(1, bw * 0.08),
          Math.max(1, bh * 0.07)
        );
      }
    }
  }
}

function drawStreetLamps() {
  for (const lamp of state.lamps) {
    const z = lamp.z - state.carY;
    if (z < 4 || z > 180) continue;
    const p = project(lamp.side * (ROAD_HALF + 1.5), z);
    const h = Math.max(10, 30 * (1 - p.t * 0.75));
    ctx.strokeStyle = "#454a58";
    ctx.lineWidth = Math.max(1.5, 3.2 * (1 - p.t));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - h);
    ctx.lineTo(p.x - lamp.side * lerp(10, 3, p.t), p.y - h);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 196, 90, 0.14)";
    ctx.beginPath();
    ctx.moveTo(p.x - lamp.side * lerp(8, 2, p.t), p.y - h);
    ctx.lineTo(p.x - lamp.side * lerp(36, 9, p.t), p.y + 12);
    ctx.lineTo(p.x + lamp.side * 6, p.y + 12);
    ctx.closePath();
    ctx.fill();
    const r = Math.max(1.8, 3.6 * (1 - p.t * 0.6));
    ctx.fillStyle = "#ffe2a8";
    ctx.beginPath();
    ctx.arc(p.x - lamp.side * lerp(8, 2, p.t), p.y - h, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(p.x - lamp.side * lerp(8, 2, p.t), p.y - h, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawLight(light) {
  const z = light.y - state.carY;
  if (z < 2.2 || z > 220) return;
  const color = colorOf(light, state.time);
  const col = COLORS[color];
  const p = project(0, z);
  const pole = project(light.side * (ROAD_HALF + 1.15), z);
  const boxW = lerp(30, 7, p.t);
  const boxH = lerp(56, 13, p.t);
  const top = p.y - lerp(78, 16, p.t);

  ctx.strokeStyle = "#454b5c";
  ctx.lineWidth = Math.max(1.5, lerp(4, 1.2, p.t));
  ctx.beginPath();
  ctx.moveTo(pole.x, pole.y);
  ctx.lineTo(pole.x, top + 6);
  ctx.lineTo(p.x, top + 6);
  ctx.stroke();

  const bx = p.x - boxW / 2;
  const by = top;
  ctx.fillStyle = "#12141c";
  ctx.strokeStyle = "#2c3140";
  roundRect(bx, by, boxW, boxH, Math.max(2, 6 * (1 - p.t)));
  ctx.fill();
  ctx.stroke();

  const r = Math.max(2.1, boxW * 0.2);
  const lamps = [
    { c: "red", col: COLORS.red, dim: "#3a1420" },
    { c: "yellow", col: COLORS.yellow, dim: "#3a3214" },
    { c: "green", col: COLORS.green, dim: "#143a2c" },
  ];
  lamps.forEach((lamp, i) => {
    const ly = by + boxH * (0.2 + i * 0.3);
    const on = lamp.c === color;
    ctx.fillStyle = on ? lamp.col : lamp.dim;
    ctx.beginPath();
    ctx.arc(p.x, ly, r, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      const pulse = color === "yellow" ? 0.5 + Math.sin(state.time * 18) * 0.28 : 0.42;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(p.x, ly, r * 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });

  const glow = ctx.createRadialGradient(p.x, p.y + 8, 2, p.x, p.y + 8, lerp(70, 14, p.t));
  glow.addColorStop(0, hexA(col, 0.32));
  glow.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - 80, p.y - 30, 160, 80);

  if (z < 70) {
    const stop = project(0, Math.max(0.6, z - STOP_LINE));
    ctx.fillStyle = "rgba(244,239,228,0.9)";
    ctx.fillRect(stop.x - stop.halfPx * 0.9, stop.y, stop.halfPx * 1.8, Math.max(2, lerp(5, 2, stop.t)));
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function carDisasterPose() {
  if (state.mode !== "disaster") return { x: 0, y: 0, rot: 0, scale: 1, hideCone: false };
  const t = state.disasterT;
  if (state.disasterType === "sinkhole") {
    const p = clamp(t / 1.65, 0, 1);
    return {
      x: Math.sin(p * 14) * p * 10,
      y: p * p * 120,
      rot: p * 0.62,
      scale: Math.max(0.08, 1 - p * 0.78),
      hideCone: p > 0.18,
    };
  }
  if (state.disasterType === "meteor") {
    if (t < 0.8) return { x: 0, y: 0, rot: 0, scale: 1, hideCone: false };
    const p = clamp((t - 0.8) / 0.9, 0, 1);
    return { x: p * 48, y: -p * 36, rot: p * 1.35, scale: 1 + p * 0.08, hideCone: true };
  }
  const p = clamp(t / 2.0, 0, 1);
  return {
    x: Math.sin(t * 13) * (10 + p * 32),
    y: -p * p * 170,
    rot: t * 7.2,
    scale: Math.max(0.35, 1 - p * 0.28),
    hideCone: p > 0.15,
  };
}

function updateDisaster(dt) {
  state.disasterT += dt;
  state.time += dt * 0.35;
  state.speed = Math.max(0, state.speed - BRAKE * dt * 1.6);
  const cx = width / 2;
  const cy = carScreenY() + 10;
  if (state.disasterType === "meteor") {
    state.shake = REDUCE ? 0 : 2 + state.disasterT * 10;
    if (state.disasterT >= 0.8 && state.disasterT < 0.84) {
      flashScreen("omen", 380);
      burst("crash", 36);
    }
    if (state.disasterT < 0.8 && Math.random() < dt * 18) {
      const p = state.disasterT / 0.8;
      spark(lerp(width * 0.72, cx, p) + rand(-8, 8), lerp(-30, cy - 20, p * p) + rand(-8, 8), {
        vx: rand(-40, 20),
        vy: rand(40, 120),
        life: rand(0.15, 0.35),
        size: rand(2, 5),
        color: pick(["#ff2d4a", "#ff8a3d", "#ffc01a", "#fff3c4"]),
        g: 40,
      });
    }
  } else if (state.disasterType === "sinkhole") {
    state.shake = REDUCE ? 0 : 4 + state.disasterT * 8;
    if (Math.random() < dt * 14) {
      spark(cx + rand(-40, 40), cy + rand(0, 24), {
        vx: rand(-70, 70),
        vy: rand(-40, 10),
        life: rand(0.2, 0.45),
        size: rand(1.5, 4),
        color: pick(["#3a3140", "#1a171f", "#8a6a12", "#c49218"]),
        g: 120,
      });
    }
  } else if (state.disasterType === "tornado") {
    state.shake = REDUCE ? 0 : 3 + Math.sin(state.disasterT * 20) * 4;
    if (Math.random() < dt * 28) {
      const a = rand(0, Math.PI * 2);
      spark(cx + Math.cos(a) * rand(10, 70), cy + Math.sin(a) * rand(-30, 40), {
        vx: Math.cos(a + 1.2) * rand(40, 140),
        vy: Math.sin(a) * rand(-90, 20),
        life: rand(0.2, 0.5),
        size: rand(1.4, 3.4),
        color: pick(["#c9b48a", "#9aa0b2", "#f4efe4", "#6d7384"]),
        g: 20,
      });
    }
  }
}

function drawSinkhole() {
  if (state.mode !== "disaster" || state.disasterType !== "sinkhole") return;
  const p = clamp(state.disasterT / 1.65, 0, 1);
  const x = width / 2;
  const y = carScreenY() + 18;
  ctx.save();
  ctx.strokeStyle = `rgba(244,239,228,${0.22 + p * 0.35})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI + i * 0.42 + p * 0.2;
    const len = lerp(18, 88, p) * (0.7 + (i % 3) * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.45);
    ctx.stroke();
  }
  ctx.fillStyle = "#05060a";
  ctx.beginPath();
  ctx.ellipse(x, y + p * 8, lerp(10, 92, p ** 0.7), lerp(6, 42, p ** 0.7), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.ellipse(x, y + p * 10, lerp(6, 62, p ** 0.7), lerp(4, 28, p ** 0.7), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeteor() {
  if (state.mode !== "disaster" || state.disasterType !== "meteor") return;
  const t = state.disasterT;
  const cx = width / 2;
  const cy = carScreenY() - 8;
  ctx.save();
  if (t < 0.8) {
    const p = t / 0.8;
    const mx = lerp(width * 0.78, cx, p);
    const my = lerp(-40, cy, p * p);
    const trail = ctx.createLinearGradient(mx, my, mx + 70, my - 130);
    trail.addColorStop(0, "rgba(255, 200, 80, 0.85)");
    trail.addColorStop(1, "rgba(255, 80, 40, 0)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = lerp(3, 14, p);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 78, my - 150);
    ctx.stroke();
    const glow = ctx.createRadialGradient(mx, my, 2, mx, my, 28);
    glow.addColorStop(0, "#fff6d2");
    glow.addColorStop(0.35, "#ff8a3d");
    glow.addColorStop(1, "rgba(255,45,74,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4efe4";
    ctx.beginPath();
    ctx.arc(mx, my, lerp(4, 11, p), 0, Math.PI * 2);
    ctx.fill();
  } else {
    const p = clamp((t - 0.8) / 0.5, 0, 1);
    const ring = ctx.createRadialGradient(cx, cy, 4, cx, cy, lerp(20, 220, p));
    ring.addColorStop(0, `rgba(255, 244, 210, ${0.55 * (1 - p)})`);
    ring.addColorStop(0.35, `rgba(255, 138, 61, ${0.35 * (1 - p)})`);
    ring.addColorStop(1, "rgba(255, 45, 74, 0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(20, 220, p), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTornado() {
  if (state.mode !== "disaster" || state.disasterType !== "tornado") return;
  const t = state.disasterT;
  const p = clamp(t / 2, 0, 1);
  const cx = width / 2 + Math.sin(t * 3) * 8;
  const cy = carScreenY() + 8;
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const u = i / 18;
    const rad = lerp(8, 78, u) * (0.45 + p);
    const y = cy - u * lerp(40, 210, p);
    const wobble = Math.sin(t * 9 + i) * 10;
    ctx.strokeStyle = `rgba(201, 180, 138, ${0.08 + (1 - u) * 0.18})`;
    ctx.lineWidth = lerp(10, 2, u);
    ctx.beginPath();
    ctx.ellipse(cx + wobble, y, rad, rad * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function drawCar() {
  const h = 96;
  const x = width / 2;
  const y = carScreenY() + 10;
  const bob = REDUCE || state.speed < 8 ? 0 : Math.sin(state.time * 5.2) * Math.min(0.45, (state.speed - 8) * 0.02);
  const braking = !state.holding && state.speed > 1;
  const pose = carDisasterPose();

  if (!pose.hideCone) {
    const cone = ctx.createLinearGradient(x, y - h, x, horizon + 8);
    cone.addColorStop(0, "rgba(255, 244, 210, 0.28)");
    cone.addColorStop(0.45, "rgba(255, 236, 190, 0.08)");
    cone.addColorStop(1, "rgba(255, 244, 210, 0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 16, y - h * 0.5 + bob);
    ctx.lineTo(x - width * 0.24, horizon + 18);
    ctx.lineTo(x + width * 0.24, horizon + 18);
    ctx.lineTo(x + 16, y - h * 0.5 + bob);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x + pose.x, y + bob + pose.y);
  ctx.rotate(pose.rot);
  ctx.scale(pose.scale, pose.scale);
  if (state.mode === "crash") {
    ctx.rotate(-0.14 - state.crashT * 0.05);
    ctx.translate(-12 - state.crashT * 10, 8);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 54, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = braking ? "rgba(255, 45, 74, 0.3)" : "rgba(34, 227, 138, 0.14)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 52, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c49218";
  ctx.beginPath();
  ctx.moveTo(-42, 6);
  ctx.quadraticCurveTo(-46, -6, -28, -78);
  ctx.lineTo(28, -78);
  ctx.quadraticCurveTo(46, -6, 42, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f0c12a";
  ctx.beginPath();
  ctx.moveTo(-34, 4);
  ctx.quadraticCurveTo(-36, -10, -24, -76);
  ctx.lineTo(24, -76);
  ctx.quadraticCurveTo(36, -10, 34, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#111820";
  roundRect(-24, -70, 48, 30, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(170, 210, 255, 0.16)";
  roundRect(-21, -67, 42, 12, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(-8, -58, 2, 16);

  ctx.fillStyle = "#16181f";
  roundRect(-16, -94, 32, 16, 4);
  ctx.fill();
  ctx.fillStyle = COLORS.yellow;
  roundRect(-11, -90, 22, 8, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-7, -88, 8, 3);

  ctx.fillStyle = "#9aa3b0";
  roundRect(-38, -6, 18, 11, 2);
  ctx.fill();
  roundRect(20, -6, 18, 11, 2);
  ctx.fill();

  ctx.fillStyle = braking ? COLORS.red : "#5a1820";
  roundRect(-30, -10, 16, 7, 2);
  ctx.fill();
  roundRect(14, -10, 16, 7, 2);
  ctx.fill();
  if (braking) {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(-22, -6, 16, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(22, -6, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#2a2e38";
  roundRect(-10, -2, 20, 6, 1);
  ctx.fill();
  ctx.fillStyle = "#d7dce6";
  ctx.font = "6px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText("NITE", 0, 3);

  ctx.restore();
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.g ?? 90) * dt;
    p.vx *= Math.max(0, 1 - 2.4 * dt);
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function drawFx() {
  if (state.speed > 6) {
    const n = 8 + Math.floor(state.speed * 0.45);
    ctx.strokeStyle = `rgba(244,239,228,${0.06 + state.speed * 0.005})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < n; i++) {
      const x = ((i * 89 + state.carY * 52) % (width + 40)) - 20;
      const y = horizon + 30 + ((i * 127 + state.carY * 140) % (height - horizon - 40));
      const len = 10 + state.speed * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function render() {
  horizon = height * 0.33;
  ctx.save();
  if (state.shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    state.shake *= 0.86;
  }
  drawSky();
  drawCity();
  drawRoad();
  drawSinkhole();
  drawBuildings();
  drawStreetLamps();
  const lights = state.lights
    .map((light) => ({ light, z: light.y - state.carY }))
    .filter((x) => x.z > 2 && x.z < 230)
    .sort((a, b) => b.z - a.z);
  for (const item of lights) drawLight(item.light);
  if (state.disasterType !== "sinkhole" || state.disasterT < 1.1) drawCar();
  drawTornado();
  drawMeteor();
  if (state.disasterType === "sinkhole" && state.disasterT >= 1.1) drawCar();
  drawFx();
  ctx.restore();
}

function updateHud() {
  if (state.mode !== "play" && state.mode !== "countdown" && state.mode !== "disaster") return;
  const t = Math.max(0, state.remaining);
  els.time.textContent = t.toFixed(1);
  els.time.className = t < 8 ? "critical" : t < 15 ? "warn" : "";
  els.dist.textContent = `${Math.round(state.carY)}`;
  els.speed.textContent = `${Math.round(state.speed * 3.6)}`;
  els.pedal.classList.toggle("held", state.holding);
  els.pedal.classList.toggle("braking", !state.holding && state.speed > 1);
  els.pedalState.textContent = state.holding ? "GO" : "HOLD";
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === "title") updateAttract(dt);
  else if (state.mode === "play" || state.mode === "countdown") updatePlay(dt);
  else if (state.mode === "crash") {
    state.crashT += dt;
    state.shake *= 0.9;
    state.time += dt * 0.15;
  } else if (state.mode === "disaster") {
    updateDisaster(dt);
  }
  audio.setEngine(state.speed, state.holding, state.mode === "play" || state.mode === "countdown");
  updateParticles(dt);
  render();
  updateHud();
  state.wasHolding = state.holding;
  requestAnimationFrame(tick);
}

function startGame() {
  audio.unlock();
  audio.startEngine();
  audio.ui();
  rumble(10);
  resetRun("countdown");
  rollOmen();
  state.countdown = 3;
  state.holding = false;
  state.countShown = "";
  hide(els.title);
  hide(els.result);
  hide(els.board);
  hide(els.authBar);
  hide(els.authError);
  show(els.hud);
  show(els.pedalWrap);
  show(els.countdown);
  els.countdown.textContent = "";
  els.countdown.classList.remove("go");
}

function backToTitle() {
  audio.ui();
  resetRun("title");
  hide(els.result);
  hide(els.board);
  hide(els.hud);
  hide(els.pedalWrap);
  show(els.title);
  show(els.authBar);
}

function setBestLabel(n) {
  const value = String(Math.round(n));
  els.titleBest.textContent = value;
  els.statBest.textContent = `${value} m`;
}

function syncAuthUi() {
  const user = authState.user;
  els.btnIn.disabled = authState.pending;
  els.btnSave.disabled = authState.pending;
  if (user) {
    hide(els.btnIn);
    show(els.authUser);
    els.authName.textContent = user.name.split(" ")[0].toUpperCase();
    if (user.photoUrl) {
      els.authPhoto.src = user.photoUrl;
      els.authPhoto.classList.remove("hidden");
    } else {
      els.authPhoto.removeAttribute("src");
      els.authPhoto.classList.add("hidden");
    }
    hide(els.btnSave);
  } else {
    show(els.btnIn);
    hide(els.authUser);
    if (state.mode === "result") show(els.btnSave);
    else hide(els.btnSave);
  }
  if (authState.error) {
    els.authError.textContent = authState.error;
    show(els.authError);
  } else {
    hide(els.authError);
  }
}

async function postRun() {
  const user = authState.user;
  const run = state.lastRun;
  if (!user || !run) return;
  try {
    const best = await saveRun(user, {
      distance: run.distance,
      lights: run.lights,
      reason: run.reason,
      localBest: getBest(),
    });
    setBest(best);
    setBestLabel(best);
  } catch (error) {
    console.warn(error);
    authState.error = "Could not post that run to the board.";
    syncAuthUi();
  }
}

async function mergeCloudBest() {
  const user = authState.user;
  if (!user) return;
  try {
    const profile = await loadProfile(user.uid);
    const best = Math.max(getBest(), Number(profile?.best) || 0);
    setBest(best);
    setBestLabel(best);
    if (state.lastRun) await postRun();
    else if (best > (Number(profile?.best) || 0)) {
      await saveRun(user, {
        distance: best,
        lights: Number(profile?.bestLights) || 0,
        reason: "sync",
        localBest: best,
      });
    }
  } catch (error) {
    console.warn(error);
  }
}

function safeText(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function safePhoto(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return parsed.href;
  } catch {
    /* ignore */
  }
  return "/favicon.svg";
}

function renderBoard(rows) {
  els.boardList.innerHTML = "";
  const me = authState.user?.uid;
  for (const row of rows) {
    const item = document.createElement("li");
    if (row.uid === me) item.classList.add("me");
    item.innerHTML = `
      <span class="rank">${row.rank}</span>
      <img alt="" referrerpolicy="no-referrer" src="${safePhoto(row.photoUrl)}" />
      <span class="who">${safeText(row.name)}</span>
      <span class="meters">${Math.round(row.best)} m</span>
    `;
    els.boardList.appendChild(item);
  }
  if (rows.length) hide(els.boardEmpty);
  else {
    els.boardEmpty.textContent = "No ranked runs yet. Sign in and don’t die.";
    show(els.boardEmpty);
  }
}

async function openBoard() {
  audio.ui();
  hide(els.title);
  hide(els.result);
  show(els.board);
  show(els.authBar);
  els.boardEmpty.textContent = "Loading the night shift…";
  show(els.boardEmpty);
  els.boardList.innerHTML = "";
  try {
    const rows = await Promise.race([
      fetchBoard(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
    renderBoard(rows);
  } catch (error) {
    console.warn(error);
    els.boardEmpty.textContent = "Board is dark right now. Try again.";
    show(els.boardEmpty);
  }
}

function closeBoard() {
  audio.ui();
  hide(els.board);
  if (state.mode === "result") show(els.result);
  else {
    show(els.title);
    state.mode = "title";
  }
  show(els.authBar);
}

function isUiButton(target) {
  return Boolean(target && target.closest && target.closest("button"));
}

window.addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (isUiButton(e.target)) return;
  if (state.mode === "play" || state.mode === "countdown") {
    state.holding = true;
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
});

window.addEventListener("pointerup", () => {
  state.holding = false;
});

window.addEventListener("pointercancel", () => {
  state.holding = false;
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    if (state.mode === "title" && els.board.classList.contains("hidden")) startGame();
    else if (state.mode === "result" && els.board.classList.contains("hidden")) startGame();
    else state.holding = true;
  }
  if (e.code === "Enter" && (state.mode === "title" || state.mode === "result") && els.board.classList.contains("hidden")) startGame();
  if (e.code === "KeyR" && state.mode === "result") startGame();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    state.holding = false;
  }
});

document.getElementById("btn-start").addEventListener("click", startGame);
document.getElementById("btn-retry").addEventListener("click", startGame);
document.getElementById("btn-menu").addEventListener("click", () => void openBoard());
els.btnIn.addEventListener("click", () => void signInWithGoogle());
els.btnSave.addEventListener("click", () => void signInWithGoogle());
els.btnOut.addEventListener("click", () => void signOut());
els.btnBoard.addEventListener("click", () => void openBoard());
els.btnBoardClose.addEventListener("click", closeBoard);
els.mute.addEventListener("click", () => {
  audio.unlock();
  audio.toggleMute();
  syncMuteUi();
});
audio.onMuteChange(syncMuteUi);
syncMuteUi();

document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
window.addEventListener("resize", resize);

els.titleBest.textContent = String(Math.round(getBest()));
resetRun("title");
resize();
syncAuthUi();
onAuthChange((next) => {
  syncAuthUi();
  if (next.user) void mergeCloudBest();
});
void startAuth();

let lampIndex = 0;
setInterval(() => {
  els.lamps.forEach((el, i) => el.classList.toggle("on", i === lampIndex));
  lampIndex = (lampIndex + 1) % 3;
}, 380);

requestAnimationFrame((t) => {
  last = t;
  tick(t);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.location.reload();
  });
}

if (import.meta.env.DEV) {
  window.__omen = (type) => {
    state.omen = null;
    beginDisaster(type);
  };
}
