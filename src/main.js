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
const DEPTH_K = 22;
const STOP_LINE = 2.2;
const BOX = 7.2;
const COLORS = {
  red: "#ff2d4a",
  yellow: "#ffc01a",
  green: "#22e38a",
};

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
}

function show(el) {
  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
}

function hide(el) {
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
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
  horizon = height * 0.30;
}

function carScreenY() {
  return height * 0.68;
}

function depthT(z) {
  const depth = Math.max(0.5, z);
  return 1 - DEPTH_K / (DEPTH_K + depth);
}

function project(x, z) {
  const t = depthT(z);
  const y = lerp(carScreenY(), horizon, t);
  const scale = lerp(36, 3.4, t ** 0.7);
  const halfPx = lerp(width * 0.4, width * 0.038, t);
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
  state.mode = "crash";
  state.crashLight = light;
  state.speed = 0;
  state.shake = 18;
  state.flash = 1;
  audio.crash();
  if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  els.flash.classList.add("on");
  setTimeout(() => els.flash.classList.remove("on"), 280);
  setTimeout(() => endRun("red"), 720);
}

function endRun(reason) {
  const dist = Math.round(state.carY);
  const best = setBest(dist);
  state.mode = "result";
  state.lastRun = { distance: dist, lights: state.cleared, reason };
  hide(els.hud);
  hide(els.pedalWrap);
  hide(els.countdown);
  show(els.result);
  show(els.authBar);
  const red = reason === "red";
  els.resultKicker.textContent = red ? "YOU RAN IT" : "SHIFT OVER";
  els.resultTitle.textContent = red ? "CAUGHT RED" : "TIME";
  els.resultTitle.className = red ? "bad" : "good";
  els.resultFlavor.textContent = red ? pick(flavorRed) : pick(flavorTime);
  els.statDist.textContent = `${dist} m`;
  els.statLights.textContent = String(state.cleared);
  els.statBest.textContent = `${best} m`;
  els.titleBest.textContent = String(best);
  if (!red) audio.timeup();
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
    els.countdown.textContent = n > 0 ? String(n) : "GO";
    if (state.countdown <= 0) {
      state.mode = "play";
      hide(els.countdown);
      audio.go();
    }
    return;
  }

  state.time += dt;
  state.remaining -= dt;
  integrate(dt);

  if (state.holding && !state.wasHolding) audio.go();
  if (!state.holding && state.wasHolding && state.speed > 4) audio.brake();

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
        if (navigator.vibrate) navigator.vibrate(12);
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
    }
  }

  if (state.remaining <= 0) {
    state.remaining = 0;
    state.speed = 0;
    endRun("time");
  }
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  g.addColorStop(0, "#070814");
  g.addColorStop(0.55, "#101226");
  g.addColorStop(1, "#2a1c18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97) % width);
    const y = ((i * 53) % (horizon - 20)) + 8;
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }

  const haze = ctx.createRadialGradient(width / 2, horizon, 10, width / 2, horizon, width * 0.7);
  haze.addColorStop(0, "rgba(255, 140, 70, 0.22)");
  haze.addColorStop(1, "rgba(255, 140, 70, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 80, width, 120);
}

function drawCity() {
  const baseY = horizon;
  ctx.fillStyle = "#0b0c14";
  for (let i = 0; i < 28; i++) {
    const x = (i / 28) * width;
    const w = width / 16;
    const h = 18 + ((i * 17) % 42);
    ctx.fillRect(x, baseY - h, w - 3, h);
  }
  ctx.fillStyle = "rgba(255, 196, 80, 0.18)";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 53) % width, baseY - 8 - ((i * 13) % 36), 2, 2);
  }
}

function drawRoad() {
  const yn = carScreenY() + 70;
  const cx = width / 2;
  for (let sy = Math.floor(horizon); sy < yn; sy += 2) {
    const t = clamp((carScreenY() - sy) / (carScreenY() - horizon), 0, 0.985);
    const z = DEPTH_K / (1 - t) - DEPTH_K;
    const worldZ = state.carY + Math.max(0, z);
    const half = lerp(width * 0.4, width * 0.038, t);
    const rumble = Math.floor(worldZ / 4.2) % 2 === 0;
    ctx.fillStyle = rumble ? "#17141c" : "#120f16";
    ctx.fillRect(cx - half - 16, sy, 16, 2);
    ctx.fillRect(cx + half, sy, 16, 2);
    ctx.fillStyle = rumble ? "#3a3140" : "#2c2833";
    ctx.fillRect(cx - half - 5, sy, 5, 2);
    ctx.fillRect(cx + half, sy, 5, 2);
    const wet = 0.12 + Math.sin(worldZ * 0.18) * 0.03;
    ctx.fillStyle = `rgb(${16 + wet * 50}, ${18 + wet * 48}, ${26 + wet * 58})`;
    ctx.fillRect(cx - half, sy, half * 2, 2);
    if (Math.floor(worldZ / 4.6) % 2 === 0 && sy < carScreenY() - 86) {
      ctx.fillStyle = "rgba(232, 212, 120, 0.9)";
      const dw = clamp(lerp(7, 1.2, t), 1.2, 7);
      ctx.fillRect(cx - dw / 2, sy, dw, 2);
    }
  }

  const fade = ctx.createLinearGradient(0, horizon, 0, horizon + 80);
  fade.addColorStop(0, "rgba(42, 28, 24, 0.7)");
  fade.addColorStop(1, "rgba(42, 28, 24, 0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon, width, 80);
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
    ctx.fillStyle = `rgba(9, 11, 18, ${0.78 + b.shade})`;
    ctx.fillRect(x0, y0, bw, bh);
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x0 + bw * 0.18, y0 + bh * 0.18, bw * 0.64, Math.max(2, bh * 0.07));
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(255, 220, 140, 0.18)";
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if ((r + c + (b.z | 0)) % 3 === 0) continue;
        ctx.fillRect(
          x0 + bw * (0.18 + c * 0.24),
          y0 + bh * (0.18 + r * 0.14),
          Math.max(1, bw * 0.08),
          Math.max(1, bh * 0.08)
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
    const h = Math.max(10, 28 * (1 - p.t * 0.75));
    ctx.strokeStyle = "#3a3f4c";
    ctx.lineWidth = Math.max(1.5, 3 * (1 - p.t));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - h);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 196, 90, 0.12)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - lamp.side * lerp(28, 8, p.t), p.y + 10);
    ctx.lineTo(p.x + lamp.side * 4, p.y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd27a";
    ctx.beginPath();
    ctx.arc(p.x, p.y - h, Math.max(1.8, 3.4 * (1 - p.t * 0.6)), 0, Math.PI * 2);
    ctx.fill();
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
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(p.x, ly, r * 2.8, 0, Math.PI * 2);
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

function drawCar() {
  const h = 92;
  const x = width / 2;
  const y = carScreenY() + 8;

  const cone = ctx.createLinearGradient(x, y - h, x, horizon + 10);
  cone.addColorStop(0, "rgba(255,244,210,0.2)");
  cone.addColorStop(1, "rgba(255,244,210,0)");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(x - 14, y - h * 0.55);
  ctx.lineTo(x - width * 0.22, horizon + 16);
  ctx.lineTo(x + width * 0.22, horizon + 16);
  ctx.lineTo(x + 14, y - h * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  if (state.mode === "crash") ctx.rotate(-0.1);

  ctx.fillStyle = !state.holding && state.speed > 1 ? "rgba(255, 45, 74, 0.22)" : "rgba(34, 227, 138, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 50, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f0c12a";
  ctx.beginPath();
  ctx.moveTo(-38, 2);
  ctx.quadraticCurveTo(-40, -8, -30, -80);
  ctx.lineTo(30, -80);
  ctx.quadraticCurveTo(40, -8, 38, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6a12";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#1a2430";
  roundRect(-22, -70, 44, 28, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(-20, -68, 40, 10, 4);
  ctx.fill();

  ctx.fillStyle = "#111218";
  roundRect(-18, -92, 36, 14, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.yellow;
  roundRect(-12, -89, 24, 8, 2);
  ctx.fill();

  ctx.fillStyle = "#cfd6e0";
  roundRect(-30, -8, 16, 10, 2);
  ctx.fill();
  roundRect(14, -8, 16, 10, 2);
  ctx.fill();

  ctx.fillStyle = state.holding || state.speed < 0.4 ? "#5a1820" : COLORS.red;
  ctx.beginPath();
  ctx.arc(-22, -4, 5, 0, Math.PI * 2);
  ctx.arc(22, -4, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFx() {
  if (state.speed > 8) {
    ctx.strokeStyle = `rgba(244,239,228,${0.08 + state.speed * 0.004})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = ((i * 73 + state.carY * 40) % width);
      const y = horizon + 40 + ((i * 97 + state.carY * 120) % (height - horizon));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 8 + state.speed * 0.4);
      ctx.stroke();
    }
  }
}

function render() {
  ctx.save();
  if (state.shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    state.shake *= 0.86;
  }
  drawSky();
  drawCity();
  drawRoad();
  drawBuildings();
  drawStreetLamps();
  const lights = state.lights
    .map((light) => ({ light, z: light.y - state.carY }))
    .filter((x) => x.z > 2 && x.z < 230)
    .sort((a, b) => b.z - a.z);
  for (const item of lights) drawLight(item.light);
  drawCar();
  drawFx();
  ctx.restore();
}

function updateHud() {
  if (state.mode !== "play" && state.mode !== "countdown") return;
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
    state.shake *= 0.9;
    state.time += dt * 0.15;
  }
  audio.setEngine(state.speed, state.holding);
  render();
  updateHud();
  state.wasHolding = state.holding;
  requestAnimationFrame(tick);
}

function startGame() {
  audio.unlock();
  audio.startEngine();
  audio.ui();
  resetRun("countdown");
  state.countdown = 3;
  state.holding = false;
  hide(els.title);
  hide(els.result);
  hide(els.board);
  hide(els.authBar);
  hide(els.authError);
  show(els.hud);
  show(els.pedalWrap);
  show(els.countdown);
  els.countdown.textContent = "3";
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
  if (isUiButton(e.target)) return;
  if (state.mode === "play" || state.mode === "countdown") {
    state.holding = true;
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
document.getElementById("btn-menu").addEventListener("click", backToTitle);
els.btnIn.addEventListener("click", () => void signInWithGoogle());
els.btnSave.addEventListener("click", () => void signInWithGoogle());
els.btnOut.addEventListener("click", () => void signOut());
els.btnBoard.addEventListener("click", () => void openBoard());
els.btnBoardClose.addEventListener("click", closeBoard);

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
