import "./style.css";
import { createAudio } from "./audio.js";
import { authState, onAuthChange, signInWithGoogle, signOut, startAuth } from "./auth.js";
import { loadMedals, medals, medalsFor } from "./medals.js";
import { fetchBoard, fetchWeek, loadProfile, rankBoard, rankWeek, saveRun, saveWeekRun } from "./scores.js";
import { countdown, shiftWeek, weekEnd, weekId, weekLabel } from "./weeks.js";

const GHOST_PAGE = /^\/ghost\/?$/.test(location.pathname);

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const audio = createAudio();

const BEST_KEY = "stoplight-sim-best-v2";
const CAR_KEY = "stoplight-sim-car-v1";
const SPORT_FEET = 4000;
const TOP_KEY = "stoplight-sim-tops-v2";
const BOARD_METRIC_KEY = "stoplight-sim-board-tab-v2";
const MEDAL_SEEN_KEY = "stoplight-sim-medal-seen";
const BOARD_METRICS = ["week", "best", "total"];
const SHARE_URL = "https://stoplightsimulator.com/";
const GOLD_ODDS = 0.075;
const GOLD_FEET = 100;
const WAVE_TIERS = [
  { min: 10, color: "#ff5ad5", name: "rainbow" },
  { min: 7, color: "#ff5ad5", name: "hot" },
  { min: 4, color: "#ffc01a", name: "warm" },
  { min: 0, color: "#22e38a", name: "cool" },
];
const GHOST_HZ = 10;
const RUN_SECONDS = 60;
const MAX_SPEED = 34;
const ACCEL = 16;
const BRAKE = 24;
const FT_PER_M = 3.280839895;
const MPH_PER_MS = 2.236936292;
const CAR_LENGTH = 4.2;
const ROAD_HALF = 4.6;
const DEPTH_K = 26;
const ROAD_NEAR = 0.48;
const ROAD_FAR = 0.11;
const STOP_LINE = 2.2;
const BOX = 7.2;
const LIGHT_HIDE = 2;
const LIGHT_FADE = 2.4;
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
  timeFuse: document.getElementById("time-fuse-bar"),
  timeFill: document.getElementById("time-fill"),
  countdown: document.getElementById("countdown"),
  wave: document.getElementById("wave"),
  waveN: document.getElementById("wave-n"),
  toast: document.getElementById("toast"),
  flash: document.getElementById("flash"),
  titleBest: document.getElementById("title-best"),
  resultKicker: document.getElementById("result-kicker"),
  resultTitle: document.getElementById("result-title"),
  resultNew: document.getElementById("result-new"),
  resultFlavor: document.getElementById("result-flavor"),
  resultHero: document.getElementById("result-hero"),
  resultDist: document.getElementById("result-dist"),
  resultHeroSub: document.getElementById("result-hero-sub"),
  resultMiss: document.getElementById("result-miss"),
  resultLeft: document.getElementById("result-left"),
  resultPace: document.getElementById("result-pace"),
  resultTops: document.getElementById("result-tops"),
  btnShare: document.getElementById("btn-share"),
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
  authMedals: document.getElementById("auth-medals"),
  titleWeek: document.getElementById("title-week"),
  board: document.getElementById("board"),
  boardFlavor: document.getElementById("board-flavor"),
  boardList: document.getElementById("board-list"),
  boardEmpty: document.getElementById("board-empty"),
  boardMeta: document.getElementById("board-meta"),
  boardEnds: document.getElementById("board-ends"),
  boardLast: document.getElementById("board-last"),
  tabs: {
    week: document.getElementById("tab-week"),
    best: document.getElementById("tab-best"),
    total: document.getElementById("tab-total"),
  },
  profile: document.getElementById("profile"),
  profilePhoto: document.getElementById("profile-photo"),
  profileName: document.getElementById("profile-name"),
  profileMedalCount: document.getElementById("profile-medal-count"),
  profileMedals: document.getElementById("profile-medals"),
  profileMedalEmpty: document.getElementById("profile-medal-empty"),
  profileWeek: document.getElementById("profile-week"),
  profileWeekRank: document.getElementById("profile-week-rank"),
  profileBest: document.getElementById("profile-best"),
  profileBestRank: document.getElementById("profile-best-rank"),
  profileTotal: document.getElementById("profile-total"),
  profileTotalRank: document.getElementById("profile-total-rank"),
  btnProfileClose: document.getElementById("btn-profile-close"),
  mute: document.getElementById("btn-mute"),
  pause: document.getElementById("pause"),
  btnPause: document.getElementById("btn-pause"),
  btnResume: document.getElementById("btn-resume"),
  btnRestart: document.getElementById("btn-restart"),
  btnExit: document.getElementById("btn-exit"),
  garage: document.getElementById("garage"),
  cars: {
    taxi: document.getElementById("car-taxi"),
    sport: document.getElementById("car-sport"),
    moto: document.getElementById("car-moto"),
  },
};

const flavorRed = [
  "The light saw you. The light won.",
  "Yellow is a suggestion. Red is a wall.",
  "You gambled. The city collected.",
  "Next time, maybe try brakes.",
  "That one was never going to stay yellow.",
];

const flavorTime = [
  "Red never caught you. The clock did.",
  "Sixty seconds. Zero tickets.",
  "The lights blinked. You didn't.",
  "The city let you keep this one.",
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
  colorblind: false,
  colorblindAt: 0,
  disasterType: null,
  disasterT: 0,
  resumeMode: null,
  belt: 0,
  ftMark: 0,
  ghostTape: [],
  car: "taxi",
  sportAnnounced: false,
};

let width = 390;
let height = 844;
let horizon = 280;
let dpr = 1;
let boardRows = [];
let boardMetric = BOARD_METRICS.includes(localStorage.getItem(BOARD_METRIC_KEY))
  ? localStorage.getItem(BOARD_METRIC_KEY)
  : "week";
const week = { id: weekId(), rows: [], loadedAt: 0, loading: null };
let boardLoadedAt = 0;
let boardLoading = null;
let profileUid = "";
let profileFrom = "";
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

function toFeet(meters) {
  return Math.round((Number(meters) || 0) * FT_PER_M);
}

function runScore() {
  return state.carY + state.bonus;
}

function projectedMeters(dist, remaining) {
  const left = Math.max(0, Number(remaining) || 0);
  const elapsed = RUN_SECONDS - left;
  const skip = 1;
  const road = state.carY;
  const startDist = Math.min(road, Number(state.ghostTape[Math.round(skip * GHOST_HZ)]) || 0);
  const pace =
    elapsed >= skip + 0.25 ? Math.max(0, road - startDist) / (elapsed - skip) : Math.max(0, state.speed);
  return Math.max(dist, Math.round(dist + pace * left));
}

function formatFt(meters, { miles = false } = {}) {
  const feet = toFeet(meters);
  if (miles && feet >= 5280) {
    return `${(feet / 5280).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} mi`;
  }
  return `${feet.toLocaleString("en-US")} ft`;
}

function toMph(mps) {
  return Math.round((Number(mps) || 0) * MPH_PER_MS);
}

const GAUGE_MAX = 80;
const GAUGE_SWEEP = 270;
const gaugeNeedle = document.getElementById("gauge-needle");
let gaugeAngle = -GAUGE_SWEEP / 2;

function gaugeAngleFor(mph) {
  return -GAUGE_SWEEP / 2 + (clamp(mph, 0, GAUGE_MAX) / GAUGE_MAX) * GAUGE_SWEEP;
}

function buildGauge() {
  const ticks = document.getElementById("gauge-ticks");
  if (!ticks) return;
  const ns = "http://www.w3.org/2000/svg";
  for (let mph = 0; mph <= GAUGE_MAX; mph += 2) {
    const major = mph % 10 === 0;
    const mid = !major && mph % 5 === 0;
    if (!major && !mid && mph % 2 !== 0) continue;
    const a = ((gaugeAngleFor(mph) - 90) * Math.PI) / 180;
    const outer = 42.5;
    const inner = major ? 35.5 : mid ? 38 : 39.6;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(50 + Math.cos(a) * inner));
    line.setAttribute("y1", String(50 + Math.sin(a) * inner));
    line.setAttribute("x2", String(50 + Math.cos(a) * outer));
    line.setAttribute("y2", String(50 + Math.sin(a) * outer));
    line.setAttribute("class", `gauge-tick ${major ? "major" : "minor"}`);
    ticks.appendChild(line);
    if (major && mph % 20 === 0) {
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(50 + Math.cos(a) * 28.5));
      label.setAttribute("y", String(50 + Math.sin(a) * 28.5));
      label.setAttribute("class", "gauge-num");
      label.textContent = String(mph);
      ticks.appendChild(label);
    }
  }
}

function updateGauge(dt) {
  if (!gaugeNeedle) return;
  const mph = (Number(state.speed) || 0) * MPH_PER_MS;
  const shake = state.holding && mph > 4 && !REDUCE ? Math.sin(state.time * 38) * 0.6 : 0;
  const target = gaugeAngleFor(mph) + shake;
  gaugeAngle += (target - gaugeAngle) * Math.min(1, dt * 14);
  gaugeNeedle.style.transform = `rotate(${gaugeAngle.toFixed(2)}deg)`;
}

function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgb(c, a) {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

const BELTS = [
  {
    y: 0,
    sky: [[5, 6, 15], [12, 16, 36], [26, 21, 40], [58, 36, 24]],
    haze: [255, 132, 62],
    lamp: [255, 226, 168],
    window: [255, 214, 130],
  },
  {
    y: 400,
    sky: [[12, 5, 18], [32, 10, 38], [52, 16, 40], [74, 28, 38]],
    haze: [255, 72, 124],
    lamp: [255, 168, 214],
    window: [255, 150, 210],
  },
  {
    y: 820,
    sky: [[6, 12, 22], [10, 24, 44], [16, 40, 56], [28, 52, 58]],
    haze: [72, 168, 210],
    lamp: [176, 220, 255],
    window: [150, 210, 255],
  },
  {
    y: 1280,
    sky: [[8, 8, 14], [20, 16, 20], [42, 32, 22], [78, 54, 28]],
    haze: [214, 164, 72],
    lamp: [255, 214, 150],
    window: [255, 206, 130],
  },
];

function beltAt(y) {
  let i = 0;
  while (i < BELTS.length - 1 && y >= BELTS[i + 1].y) i += 1;
  const cur = BELTS[i];
  const next = BELTS[Math.min(i + 1, BELTS.length - 1)];
  const span = Math.max(1, next.y - cur.y);
  const t = cur === next ? 1 : clamp((y - cur.y) / span, 0, 1);
  const ease = t * t * (3 - 2 * t);
  return { i, cur, next, t: ease };
}

let look = null;

function nightLook() {
  const travel = beltAt(state.carY);
  const clock = clamp(1 - state.remaining / RUN_SECONDS, 0, 1);
  const late = clock * clock;
  const sky = travel.cur.sky.map((c, idx) => mix3(c, travel.next.sky[idx], travel.t));
  return {
    sky: [
      mix3(sky[0], [20, 16, 34], late * 0.5),
      mix3(sky[1], [44, 28, 50], late * 0.58),
      mix3(sky[2], [96, 50, 44], late * 0.72),
      mix3(sky[3], [168, 92, 50], late * 0.88),
    ],
    haze: mix3(mix3(travel.cur.haze, travel.next.haze, travel.t), [255, 150, 88], late * 0.4),
    lamp: mix3(travel.cur.lamp, travel.next.lamp, travel.t),
    window: mix3(travel.cur.window, travel.next.window, travel.t),
    star: 0.3 + travel.i * 0.08 + travel.t * 0.1 + late * 0.1,
    moonY: 0.34 + late * 0.26,
    moonA: clamp(1 - late * 0.62, 0.28, 1),
    cityScale: 1.08 - clamp(state.carY / 1700, 0, 1) * 0.42,
    late,
    clock,
    belt: travel.i,
  };
}

function getBest() {
  return Number(localStorage.getItem(BEST_KEY) || 0);
}

const CAR_IDS = ["taxi", "sport", "moto"];
const PENDING_CAR_KEY = "stoplight-sim-pending-car";

function savedCar() {
  const id = localStorage.getItem(CAR_KEY);
  return CAR_IDS.includes(id) ? id : "taxi";
}

function carUnlocked(id) {
  if (id === "moto") return Boolean(authState.user);
  if (id === "sport") return toFeet(getBest()) >= SPORT_FEET;
  return id === "taxi";
}

function activeCar() {
  const id = savedCar();
  if (id === "moto" && !authState.ready) return state.car === "moto" ? "moto" : "taxi";
  return carUnlocked(id) ? id : "taxi";
}

function syncGarage() {
  const pending = sessionStorage.getItem(PENDING_CAR_KEY);
  if (pending && carUnlocked(pending)) {
    localStorage.setItem(CAR_KEY, pending);
    sessionStorage.removeItem(PENDING_CAR_KEY);
  }
  if (authState.ready && !carUnlocked(savedCar())) localStorage.setItem(CAR_KEY, "taxi");
  state.car = activeCar();
  audio.setCar(state.car);
  for (const id of CAR_IDS) {
    const btn = els.cars[id];
    if (!btn) continue;
    const open = id === "moto" && !authState.ready ? false : carUnlocked(id);
    const on = state.car === id;
    btn.classList.toggle("is-on", on);
    btn.classList.toggle("is-locked", !open);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const label = btn.querySelector(".car-label");
    if (!label) continue;
    if (id === "taxi") label.textContent = "TAXI";
    if (id === "sport") label.textContent = open ? "SPORT" : "4,000 FT";
    if (id === "moto") label.textContent = open ? "MOTO" : "SIGN IN";
  }
}

function chooseCar(id) {
  if (!carUnlocked(id)) return;
  localStorage.setItem(CAR_KEY, id);
  syncGarage();
}

function maybeUnlockSport() {
  if (state.sportAnnounced || state.mode !== "play") return;
  if (toFeet(getBest()) >= SPORT_FEET) return;
  if (toFeet(runScore()) < SPORT_FEET) return;
  state.sportAnnounced = true;
  toast("SPORT UNLOCKED", "place");
  syncGarage();
}

function stampGhost() {
  const elapsed = Math.max(0, RUN_SECONDS - state.remaining);
  const idx = Math.max(0, Math.floor(elapsed * GHOST_HZ));
  while (state.ghostTape.length <= idx) state.ghostTape.push(state.carY);
  state.ghostTape[idx] = state.carY;
}

function boardName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return parts[0] || "Night driver";
  const initial = [...parts[0]][0];
  if (!initial) return parts.slice(1).join(" ");
  return `${initial.toUpperCase()}. ${parts.slice(1).join(" ")}`;
}

function sharePayload(run) {
  if (!run) {
    return {
      title: "Stoplight Simulator",
      text: "How far can you get in 60 seconds?",
      url: SHARE_URL,
    };
  }
  const feet = formatFt(run.distance);
  const lights = `${run.lights} light${run.lights === 1 ? "" : "s"}`;
  if (run.reason === "red") {
    const left = Math.max(0, Number(run.remaining) || 0).toFixed(1);
    return {
      title: "Stoplight Simulator",
      text: `Caught red at ${feet} (${lights}) with ${left}s left.`,
      url: SHARE_URL,
    };
  }
  const omen = OMEN[run.reason];
  if (omen) {
    return {
      title: "Stoplight Simulator",
      text: `${omen.title}. ${feet}. ${lights}.`,
      url: SHARE_URL,
    };
  }
  return {
    title: "Stoplight Simulator",
    text: `${feet}. ${lights}. How far can you get?`,
    url: SHARE_URL,
  };
}

async function shareRun() {
  audio.ui();
  const payload = sharePayload(state.lastRun);
  const joined = `${payload.text}\n${payload.url}`;
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(joined);
    toast("COPIED");
    return;
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = joined;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    toast(ok ? "COPIED" : "COPY FAILED");
  } catch {
    toast("COPY FAILED");
  }
}

function setBest(n) {
  const best = Math.max(getBest(), Math.round(n));
  localStorage.setItem(BEST_KEY, String(best));
  return best;
}

function getTops() {
  try {
    const raw = JSON.parse(localStorage.getItem(TOP_KEY) || "[]");
    if (Array.isArray(raw) && raw.length) {
      return raw.map(Number).filter((n) => n > 0).sort((a, b) => b - a).slice(0, 5);
    }
  } catch {
    /* ignore */
  }
  const best = getBest();
  if (best > 0) {
    localStorage.setItem(TOP_KEY, JSON.stringify([best]));
    return [best];
  }
  return [];
}

function recordTop(n) {
  const dist = Math.round(n);
  const prev = getTops();
  const prevBest = prev[0] || 0;
  if (dist <= 0) return { tops: prev, rank: 0, isNewBest: false };
  const tagged = prev.map((d) => ({ d, cur: false }));
  tagged.push({ d: dist, cur: true });
  tagged.sort((a, b) => b.d - a.d || (a.cur ? -1 : 1));
  const kept = tagged.slice(0, 5);
  const tops = kept.map((row) => row.d);
  localStorage.setItem(TOP_KEY, JSON.stringify(tops));
  setBest(dist);
  return {
    tops,
    rank: kept.findIndex((row) => row.cur) + 1,
    isNewBest: dist > prevBest,
  };
}

function ordinal(n) {
  return n === 1 ? "1ST" : n === 2 ? "2ND" : n === 3 ? "3RD" : `${n}TH`;
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
    const green = rand(2.8, 5.2) - late * 0.2;
    const yellow = rand(0.85, 1.25);
    const red = rand(1.05, 2.5);
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
  for (const light of lights) light.lucky = Math.random() < GOLD_ODDS;
  const buildings = [];
  for (let i = 0; i < 120; i++) {
    const z = i * 26 + rand(0, 16);
    const band = clamp(z / 1800, 0, 1);
    const side = i % 2 === 0 ? -1 : 1;
    buildings.push({
      z,
      side,
      w: rand(6, 14) * (1 - band * 0.22),
      d: rand(8, 18),
      h: rand(8, 28) * (1.18 - band * 0.62),
      shade: rand(0.04, 0.12),
      neon: Math.random() < 0.3 - band * 0.2 ? pick(["#22e38a", "#ff2d4a", "#7aa2ff", "#ffc01a", "#ff5ad5"]) : null,
    });
  }

  const lamps = [];
  for (let i = 0; i < 88; i++) {
    lamps.push({
      z: 18 + i * 36 + rand(-8, 8),
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
  state.colorblind = false;
  state.colorblindAt = 0;
  state.disasterType = null;
  state.disasterT = 0;
  state.resumeMode = null;
  state.belt = 0;
  state.ftMark = 0;
  state.ghostTape = [];
  state.sportAnnounced = false;
  state.wave = 0;
  state.waveBest = 0;
  state.gold = 0;
  state.bonus = 0;
  state.stopArmed = false;
  state.runBest = getBest();
  state.bestCrossed = false;
  state.weekLead = 0;
  state.leadCrossed = false;
  state.lastTick = 0;
  state.redBy = -1;
  syncWave();
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
  els.flash.className = ["go", "good", "omen", "best"].includes(kind) ? `${kind} on` : "on";
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
  if (Math.random() >= 0.1) {
    state.omen = null;
    state.omenAt = 0;
    return;
  }
  state.omen = pick(["meteor", "sinkhole", "tornado"]);
  state.omenAt = rand(12, 47);
}

function rollColorblind() {
  if (Math.random() >= 1 / 30) {
    state.colorblindAt = 0;
    return;
  }
  state.colorblindAt = 30;
}

function beginColorblind() {
  state.colorblind = true;
  state.colorblindAt = 0;
  toast("COLOR BLIND LMAO", "egg");
  rumble(16);
}

function beginDisaster(type) {
  if (state.mode === "title" || state.mode === "result" || state.mode === "crash" || state.mode === "disaster" || state.mode === "pause") return;
  const kind = OMEN[type] ? type : pick(["meteor", "sinkhole", "tornado"]);
  if (state.mode === "countdown") hide(els.countdown);
  hide(els.pause);
  hide(els.btnPause);
  state.mode = "disaster";
  state.disasterType = kind;
  state.disasterT = 0;
  state.holding = false;
  state.omen = null;
  syncWave();
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

function waveTier(n = state.wave) {
  return WAVE_TIERS.find((tier) => n >= tier.min);
}

function syncWave(pop = false) {
  const live = state.wave >= 2 && (state.mode === "play" || state.mode === "countdown");
  els.wave.classList.toggle("hidden", !live);
  if (!live) return;
  const tier = waveTier();
  els.wave.dataset.tier = tier.name;
  els.wave.style.setProperty("--wave", tier.color);
  els.waveN.textContent = `×${state.wave}`;
  if (pop) {
    els.wave.classList.remove("pop", "big");
    void els.wave.offsetWidth;
    els.wave.classList.add("pop");
    if (pop === "big") els.wave.classList.add("big");
  }
}

function glowOdometer(color) {
  const odo = els.dist.parentElement;
  odo.style.setProperty("--glow", color);
  odo.classList.remove("glow");
  void odo.offsetWidth;
  odo.classList.add("glow");
}

function carSparks(colors, n, power = 1) {
  if (REDUCE) return;
  const y = carScreenY() - 20;
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const spd = rand(90, 240) * power;
    spark(width / 2 + rand(-18, 18), y, {
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: rand(0.35, 0.75),
      size: rand(1.6, 3.6),
      color: pick(colors),
      g: 260,
    });
  }
}

function passLight(light) {
  state.wave += 1;
  state.waveBest = Math.max(state.waveBest, state.wave);
  audio.pass(state.wave);
  rumble(8);
  const milestone = state.wave % 5 === 0;
  if (milestone) {
    audio.waveUp(state.wave);
    rumble([12, 30, 12]);
  }
  if (light?.lucky) {
    state.gold += 1;
    state.bonus += GOLD_FEET / FT_PER_M;
    audio.jackpot();
    toast(`+${GOLD_FEET} FT`);
    glowOdometer("#ffc01a");
    carSparks(["#ffc01a", "#fff1b8"], 10, 0.6);
    rumble([12, 20, 12, 40]);
    els.dist.classList.remove("tick");
    void els.dist.offsetWidth;
    els.dist.classList.add("tick");
  }
  syncWave(milestone ? "big" : true);
}

function breakWave() {
  const big = state.wave >= 3;
  state.wave = 0;
  if (!big) {
    syncWave();
    return;
  }
  audio.waveLost();
  els.wave.classList.add("lost");
  setTimeout(() => {
    els.wave.classList.remove("lost");
    if (!state.wave) syncWave();
  }, 380);
}

function closeCall(left) {
  const razor = left < 0.25;
  toast(razor ? "RAZOR CLOSE" : "CLOSE CALL", razor ? "" : "place");
  audio.close(razor);
  rumble(razor ? [16, 20, 16] : 12);
}

function perfectStop() {
  toast("PERFECT STOP", "place");
  audio.perfect();
  rumble([10, 30, 10]);
}

function trackStop(front) {
  if (state.speed > 4) state.stopArmed = true;
  if (state.speed >= 1.2) return;
  if (state.wave) breakWave();
  if (!state.stopArmed) return;
  state.stopArmed = false;
  const light = nextLight();
  if (!light) return;
  const color = colorOf(light, state.time);
  const gap = light.y - STOP_LINE - front;
  if (color !== "green" && gap >= 0 && gap < 1.6) perfectStop();
}

function trackGoals() {
  if (!state.bestCrossed && state.runBest > 30 && runScore() > state.runBest) {
    state.bestCrossed = true;
    toast("NEW BEST");
    audio.best();
    glowOdometer("#ffc01a");
    rumble([20, 40, 30]);
  }
  if (!state.leadCrossed && state.weekLead > 30 && runScore() > state.weekLead) {
    state.leadCrossed = true;
    toast(authState.user ? "WEEKLY LEAD" : "BEAT #1 THIS WEEK");
    audio.lead();
    glowOdometer("#ff5ad5");
    rumble([20, 40, 30]);
  }
  const sec = Math.ceil(state.remaining);
  if (sec <= 5 && sec >= 1 && sec !== state.lastTick) {
    state.lastTick = sec;
    audio.tick(5 - sec);
    rumble(6);
  }
}

let statTok = new WeakMap();
function countUp(el, to, suffix = "", dur = 620, onDone, onStep) {
  const target = Math.round(to);
  if (REDUCE) {
    el.textContent = `${target}${suffix}`;
    if (onDone) onDone();
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
    if (onStep && t < 1) onStep(eased);
    if (t < 1) requestAnimationFrame(tickStat);
    else if (onDone) onDone();
  };
  requestAnimationFrame(tickStat);
}

function syncMuteUi() {
  const muted = audio.isMuted();
  els.mute.classList.toggle("is-muted", muted);
  els.mute.setAttribute("aria-pressed", muted ? "true" : "false");
  els.mute.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
}

const appEl = document.getElementById("app");

function resize() {
  const w = appEl.clientWidth;
  const h = appEl.clientHeight;
  const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
  if (!w || !h) return;
  if (w === width && h === height && nextDpr === dpr && canvas.width === Math.round(w * dpr)) return;
  width = w;
  height = h;
  dpr = nextDpr;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
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
  hide(els.pause);
  hide(els.btnPause);
  state.mode = "crash";
  state.crashLight = light;
  state.redBy = phaseOf(light, state.time) - light.green - light.yellow;
  syncWave();
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

function celebrateTop(rank) {
  if (REDUCE) return;
  const n = rank === 1 ? 46 : rank ? 22 : 0;
  const colors = rank === 1
    ? ["#ffc01a", "#f4efe4", "#22e38a", "#ff8a3d"]
    : ["#ffc01a", "#f4efe4", "#22e38a"];
  for (let i = 0; i < n; i++) {
    spark(width / 2 + rand(-50, 50), height * 0.38 + rand(-20, 20), {
      vx: rand(-160, 160),
      vy: rand(-260, -40),
      life: rand(0.55, 1.2),
      size: rand(2, 5.5),
      color: pick(colors),
      g: 200,
    });
  }
  rumble(rank === 1 ? [20, 40, 30, 70] : [16, 24, 18]);
}

function renderTops(tops, rank) {
  els.resultTops.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const li = document.createElement("li");
    const dist = tops[i];
    li.style.animationDelay = REDUCE ? "0s" : `${0.22 + i * 0.08}s`;
    if (dist == null) {
      li.className = "empty";
      li.innerHTML = `<span class="rank">${ordinal(i + 1)}</span><span class="meters">—</span>`;
    } else {
      if (i === 0) li.classList.add("gold");
      if (rank === i + 1) li.classList.add("now");
      li.innerHTML = `<span class="rank">${ordinal(i + 1)}</span><span class="meters">${formatFt(dist)}</span>`;
    }
    els.resultTops.appendChild(li);
  }
}

function endRun(reason) {
  if (state.mode === "result") return;
  stampGhost();
  const dist = Math.round(runScore());
  const rec = recordTop(dist);
  const best = getBest();
  const omen = OMEN[reason];
  const red = reason === "red";
  const timed = !red && !omen;
  state.mode = "result";
  state.lastRun = {
    distance: dist,
    lights: state.cleared,
    reason,
    remaining: Math.max(0, state.remaining),
    week: weekId(),
  };
  hide(els.hud);
  hide(els.pedalWrap);
  hide(els.countdown);
  hide(els.pause);
  hide(els.btnPause);
  show(els.result);
  show(els.authBar);
  show(els.btnBoard);
  els.result.classList.toggle("is-time", timed);
  els.resultHero.classList.remove("punch", "is-best");
  els.resultNew.classList.remove("place");

  if (omen) {
    const left = Math.max(0, state.remaining);
    els.resultKicker.textContent = omen.kicker;
    els.resultTitle.textContent = omen.title;
    els.resultTitle.className = "omen";
    els.resultLeft.textContent = `${left.toFixed(1)}s LEFT`;
    els.resultPace.textContent = `ON PACE FOR ${formatFt(projectedMeters(dist, left))}`;
    els.resultFlavor.textContent = pick(omen.flavor);
    show(els.resultTitle);
    show(els.resultMiss);
    hide(els.resultHero);
    hide(els.resultHeroSub);
    hide(els.resultTops);
  } else if (red) {
    const left = Math.max(0, state.remaining);
    const projected = projectedMeters(dist, left);
    els.resultKicker.textContent =
      state.redBy >= 0 && state.redBy < 1 ? `RED BY ${Math.max(0.01, state.redBy).toFixed(2)}s` : "YOU RAN IT";
    els.resultTitle.textContent = "CAUGHT RED";
    els.resultTitle.className = "bad";
    els.resultLeft.textContent = `${left.toFixed(1)}s LEFT`;
    els.resultPace.textContent = `ON PACE FOR ${formatFt(projected)}`;
    els.resultFlavor.textContent = pick(flavorRed);
    show(els.resultTitle);
    show(els.resultMiss);
    hide(els.resultHero);
    hide(els.resultHeroSub);
    hide(els.resultTops);
  } else {
    els.resultKicker.textContent = "TIME";
    els.resultTitle.textContent = "TIME";
    els.resultTitle.className = "good";
    els.resultFlavor.textContent = pick(flavorTime);
    hide(els.resultTitle);
    hide(els.resultMiss);
    show(els.resultHero);
    show(els.resultHeroSub);
    show(els.resultTops);
    els.resultHero.classList.toggle("is-best", rec.isNewBest);
    els.resultHeroSub.textContent = runSummary();
    let lastTally = 0;
    countUp(
      els.resultDist,
      toFeet(dist),
      "",
      1080,
      () => {
        els.resultHero.classList.add("punch");
        audio.ding();
      },
      (t) => {
        const now = performance.now();
        if (now - lastTally < 45) return;
        lastTally = now;
        audio.tally(t);
      }
    );
    renderTops(rec.tops, rec.rank);
    celebrateTop(rec.rank);
  }

  if (timed && rec.isNewBest) {
    els.resultNew.textContent = "NEW BEST";
    show(els.resultNew);
    audio.best();
    flashScreen("best", 520);
  } else if (timed && rec.rank > 0) {
    els.resultNew.textContent = `${ordinal(rec.rank)} BEST`;
    els.resultNew.classList.add("place");
    show(els.resultNew);
    audio.top();
    flashScreen("good", 380);
  } else if (rec.isNewBest) {
    els.resultNew.textContent = "NEW BEST";
    show(els.resultNew);
    audio.best();
  } else {
    hide(els.resultNew);
    if (timed) audio.timeup();
  }

  countUp(els.statDist, toFeet(dist), " ft");
  countUp(els.statLights, state.cleared, "", 480);
  els.statBest.textContent = formatFt(best);
  els.titleBest.textContent = String(toFeet(best));
  if (timed && !rec.isNewBest && rec.rank === 0) flashScreen("good", 420);
  els.resultKicker.classList.toggle("near", red && state.redBy >= 0 && state.redBy < 1);
  els.resultFlavor.classList.remove("chase");
  state.lastRun.flavor = els.resultFlavor.textContent;
  applyChase(state.lastRun);
  syncWave();
  syncAuthUi();
  void postRun();
}

function runSummary() {
  const parts = [`${state.cleared} LIGHT${state.cleared === 1 ? "" : "S"}`];
  if (state.waveBest >= 2) parts.push(`WAVE ×${state.waveBest}`);
  if (state.gold) parts.push(`+${(state.gold * GOLD_FEET).toLocaleString("en-US")} GOLD`);
  return parts.join(" · ");
}

function chaseFor(run) {
  const dist = run.distance;
  const uid = authState.user?.uid;
  const options = [];
  if (uid && run.week === week.id) {
    const mine = Math.max(dist, week.rows.find((row) => row.uid === uid)?.best || 0);
    const ranked = rankWeek(week.rows.filter((row) => row.uid !== uid));
    const ahead = ranked.filter((row) => row.best > mine);
    const target = ahead[ahead.length - 1];
    if (target) {
      const gap = target.best - dist + 1;
      if (gap > 0 && gap <= Math.max(60, dist * 0.2)) {
        options.push({ gap, text: `${formatFt(gap).toUpperCase()} FROM #${target.rank} THIS WEEK` });
      }
    }
  }
  const prevBest = state.runBest;
  if (prevBest > 0 && dist < prevBest && dist >= prevBest * 0.75) {
    options.push({ gap: prevBest - dist + 1, text: `${formatFt(prevBest - dist + 1).toUpperCase()} SHORT OF YOUR BEST` });
  }
  options.sort((a, b) => a.gap - b.gap);
  return options[0]?.text || "";
}

function applyChase(run) {
  if (!run || state.lastRun !== run) return;
  const text = chaseFor(run);
  els.resultFlavor.textContent = text || run.flavor;
  els.resultFlavor.classList.toggle("chase", Boolean(text));
}

function toast(text, kind = "") {
  state.toastText = text;
  state.toastAt = performance.now();
  els.toast.textContent = text;
  els.toast.classList.toggle("place", kind === "place");
  els.toast.classList.toggle("egg", kind === "egg");
  els.toast.classList.remove("hidden");
  els.toast.style.animation = "none";
  void els.toast.offsetWidth;
  els.toast.style.animation = "";
  const ms = kind === "egg" ? 1600 : kind === "place" ? 1100 : 700;
  setTimeout(() => {
    if (els.toast.textContent === text) els.toast.classList.add("hidden");
  }, ms);
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
  if (state.colorblindAt && elapsed >= state.colorblindAt) {
    beginColorblind();
  }

  state.time += dt;
  state.remaining -= dt;
  integrate(dt);
  stampGhost();

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
  trackStop(front);
  trackGoals();

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
        state.cleared += 1;
        if (color === "yellow") {
          const left = yellowLeft(light, state.time);
          if (left < 0.6) closeCall(left);
        }
        passLight(light);
      }
    }

    if (rear > clear) light.passed = true;
  }

  const thousands = Math.floor(toFeet(runScore()) / 1000);
  if (thousands > state.belt) {
    toast(`${(thousands * 1000).toLocaleString("en-US")} FT`, "place");
    rumble([10, 24, 10]);
  }
  state.belt = thousands;

  if (state.remaining <= 0) {
    state.remaining = 0;
    state.speed = 0;
    stampGhost();
    endRun("time");
  }
}

function drawSky() {
  const sky = look.sky;
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 50);
  g.addColorStop(0, rgb(sky[0]));
  g.addColorStop(0.42, rgb(sky[1]));
  g.addColorStop(0.78, rgb(sky[2]));
  g.addColorStop(1, rgb(sky[3]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const moonX = width * 0.78;
  const moonY = horizon * look.moonY;
  ctx.globalAlpha = look.moonA;
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
  ctx.fillStyle = rgb(sky[0]);
  ctx.beginPath();
  ctx.arc(moonX + 5, moonY - 3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (const star of STARS) {
    const tw = 0.35 + Math.abs(Math.sin(state.time * star.tw + star.x * 8)) * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${look.star * tw})`;
    const x = star.x * width;
    const y = 8 + star.y * (horizon - 28);
    const s = star.s * (tw > 0.85 ? 1.6 : 1);
    ctx.fillRect(x, y, s, s);
  }

  const haze = ctx.createRadialGradient(width / 2, horizon, 8, width / 2, horizon, width * 0.78);
  haze.addColorStop(0, rgb(look.haze, 0.3));
  haze.addColorStop(0.45, rgb(look.haze, 0.08));
  haze.addColorStop(1, rgb(look.haze, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 90, width, 130);

  if (look.late > 0.5) {
    const a = ((look.late - 0.5) / 0.5) * 0.28;
    const edge = ctx.createRadialGradient(width / 2, height * 0.42, width * 0.18, width / 2, height * 0.42, width * 0.82);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(1, rgb([36, 4, 6], a));
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawCity() {
  const baseY = horizon;
  const scale = look.cityScale;
  for (let i = 0; i < 34; i++) {
    const x = (i / 34) * width - 6;
    const w = width / 15 + ((i * 11) % 10);
    const h = (22 + ((i * 19) % 48)) * scale;
    ctx.fillStyle = i % 4 === 0 ? "#080910" : "#0b0d16";
    ctx.fillRect(x, baseY - h, w - 2, h);
    ctx.fillStyle = rgb(look.window, 0.18);
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
  fade.addColorStop(0, rgb(look.sky[3], 0.72));
  fade.addColorStop(1, rgb(look.sky[3], 0));
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon, width, 90);
}

function drawRoadMark(worldY, text, color, strength) {
  const z = worldY - state.carY;
  if (z < 3 || z >= 190) return;
  const p = project(0, z);
  const size = Math.round(lerp(34, 7, p.t));
  if (size < 7) return;
  ctx.save();
  ctx.globalAlpha = clamp((190 - z) / 60, 0, 1) * strength;
  ctx.fillStyle = color;
  ctx.fillRect(p.x - p.halfPx * 0.92, p.y, p.halfPx * 1.84, Math.max(1, lerp(4, 1, p.t)));
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.translate(p.x, p.y + Math.max(2, lerp(8, 2, p.t)));
  ctx.scale(1, 0.55);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawFootMarkers() {
  const step = 1000 / FT_PER_M;
  const best = getBest();
  const bestFeet = toFeet(best);
  const showBest = bestFeet > 0 && state.mode !== "title";
  const leadAt = state.weekLead > 0 && state.mode !== "title" ? toFeet(state.weekLead) : -1e9;
  const off = state.bonus || 0;
  const first = Math.max(1, Math.ceil((runScore() + 3) / step));
  for (let k = first; k * step - runScore() < 190; k++) {
    if (showBest && Math.abs(k * 1000 - bestFeet) < 60) continue;
    if (Math.abs(k * 1000 - leadAt) < 60) continue;
    drawRoadMark(k * step - off, `${(k * 1000).toLocaleString("en-US")} FT`, "#f4efe4", 0.55);
  }
  if (showBest) drawRoadMark(best - off, `BEST ${bestFeet.toLocaleString("en-US")} FT`, "#ffc01a", 0.8);
  const leadFeet = toFeet(state.weekLead);
  if (state.weekLead > 0 && state.mode !== "title" && (!showBest || Math.abs(leadFeet - bestFeet) >= 60)) {
    drawRoadMark(state.weekLead - off, `#1 THIS WEEK ${leadFeet.toLocaleString("en-US")} FT`, "#ff5ad5", 0.85);
  }
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
    ctx.fillStyle = rgb(look.window, 0.24);
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
    ctx.fillStyle = rgb(look.lamp, 0.16);
    ctx.beginPath();
    ctx.moveTo(p.x - lamp.side * lerp(8, 2, p.t), p.y - h);
    ctx.lineTo(p.x - lamp.side * lerp(36, 9, p.t), p.y + 12);
    ctx.lineTo(p.x + lamp.side * 6, p.y + 12);
    ctx.closePath();
    ctx.fill();
    const r = Math.max(1.8, 3.6 * (1 - p.t * 0.6));
    ctx.fillStyle = rgb(look.lamp);
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
  if (z < 0.5 || z > 220) return;
  const color = colorOf(light, state.time);
  const gray = state.colorblind;
  const col = gray ? "#d4d8e0" : COLORS[color];
  const p = project(0, z);
  const stopZ = z - STOP_LINE;

  if (z < 70 && stopZ > 0.5) {
    const stop = project(0, stopZ);
    ctx.fillStyle = "rgba(244,239,228,0.9)";
    ctx.fillRect(stop.x - stop.halfPx * 0.9, stop.y, stop.halfPx * 1.8, Math.max(2, lerp(5, 2, stop.t)));
  }

  const fade = clamp((z - LIGHT_HIDE) / LIGHT_FADE, 0, 1);
  if (fade <= 0) return;

  const pole = project(light.side * (ROAD_HALF + 1.15), z);
  const boxW = lerp(30, 7, p.t);
  const boxH = lerp(56, 13, p.t);
  const top = p.y - lerp(78, 16, p.t);

  ctx.save();
  ctx.globalAlpha *= fade;

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
  if (light.lucky) drawGoldTrim(p.x, by, boxW, boxH, p.t, light.side);

  const r = Math.max(2.1, boxW * 0.2);
  const lamps = gray
    ? [
        { c: "red", col: "#d4d8e0", dim: "#2c3038" },
        { c: "yellow", col: "#d4d8e0", dim: "#2c3038" },
        { c: "green", col: "#d4d8e0", dim: "#2c3038" },
      ]
    : [
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
      ctx.globalAlpha = fade * pulse;
      ctx.beginPath();
      ctx.arc(p.x, ly, r * 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade;
    }
  });

  if (z > 18) {
    const glow = ctx.createRadialGradient(p.x, p.y + 8, 2, p.x, p.y + 8, lerp(70, 14, p.t));
    glow.addColorStop(0, hexA(col, 0.32));
    glow.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 80, p.y - 30, 160, 80);
  }
  ctx.restore();
}

function drawGoldTrim(cx, by, boxW, boxH, t, side) {
  const pad = Math.max(1.2, lerp(4, 1.2, t));
  ctx.save();
  ctx.strokeStyle = "#ffc01a";
  ctx.lineWidth = Math.max(1, lerp(2, 0.8, t));
  ctx.shadowColor = "#ffc01a";
  ctx.shadowBlur = REDUCE ? 0 : lerp(10, 4, t);
  roundRect(cx - boxW / 2 - pad, by - pad, boxW + pad * 2, boxH + pad * 2, Math.max(3, 8 * (1 - t)));
  ctx.stroke();
  ctx.shadowBlur = 0;
  const orbitX = boxW * 0.9 + pad;
  const orbitY = boxH * 0.58 + pad;
  const cy = by + boxH / 2;
  const size = Math.round(Math.min(15, boxW * 0.62));
  if (size >= 8) {
    const dir = side > 0 ? -1 : 1;
    ctx.fillStyle = "#ffc01a";
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.textAlign = dir > 0 ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${GOLD_FEET}`, cx + dir * (orbitX + 4), cy);
  }
  for (let i = 0; i < 3; i++) {
    const a = state.time * 1.6 + (i / 3) * Math.PI * 2;
    const twinkle = 0.55 + Math.sin(state.time * 6 + i * 2.1) * 0.45;
    ctx.fillStyle = i % 2 ? "#fff1b8" : "#ffc01a";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * orbitX, cy + Math.sin(a) * orbitY, Math.max(0.8, lerp(2.4, 0.8, t)) * twinkle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
function drawPlate(text) {
  ctx.fillStyle = "#2a2e38";
  roundRect(-10, -2, 20, 6, 1);
  ctx.fill();
  ctx.fillStyle = "#d7dce6";
  ctx.font = "6px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 3);
}

function drawBrakeGlow(braking, alpha, y) {
  if (!braking) return;
  ctx.globalAlpha = 0.45 * alpha;
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.ellipse(-22, y, 16, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(22, y, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
}

function drawTaxiBody(ghost, braking, alpha) {
  ctx.fillStyle = ghost ? "#7b8290" : "#c49218";
  ctx.beginPath();
  ctx.moveTo(-42, 6);
  ctx.quadraticCurveTo(-46, -6, -28, -78);
  ctx.lineTo(28, -78);
  ctx.quadraticCurveTo(46, -6, 42, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ghost ? "#a8b0be" : "#f0c12a";
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
  ctx.fillStyle = ghost ? "#d7dce6" : COLORS.yellow;
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
  drawBrakeGlow(braking, alpha, -6);
  drawPlate(ghost ? "BEST" : "NITE");
}

function drawMotoBody(braking, alpha) {
  ctx.fillStyle = "#16181f";
  roundRect(-4, -84, 8, 20, 4);
  ctx.fill();
  ctx.strokeStyle = "#8a92a0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -70);
  ctx.lineTo(-7, -54);
  ctx.moveTo(5, -70);
  ctx.lineTo(7, -54);
  ctx.stroke();

  ctx.fillStyle = "#1f6fb8";
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.quadraticCurveTo(-14, -40, -8, -60);
  ctx.lineTo(8, -60);
  ctx.quadraticCurveTo(14, -40, 10, -12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2f8fd8";
  ctx.beginPath();
  ctx.moveTo(-7, -14);
  ctx.quadraticCurveTo(-10, -38, -5, -58);
  ctx.lineTo(5, -58);
  ctx.quadraticCurveTo(10, -38, 7, -14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#b7c0cc";
  roundRect(10, -20, 7, 24, 3);
  ctx.fill();
  ctx.fillStyle = "#6c7380";
  ctx.beginPath();
  ctx.ellipse(13.5, 3, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f1014";
  roundRect(-8, -10, 16, 24, 7);
  ctx.fill();
  ctx.fillStyle = "#23262e";
  ctx.fillRect(-2, -8, 4, 20);

  ctx.fillStyle = "#1b1d24";
  ctx.beginPath();
  ctx.moveTo(-9, -18);
  ctx.quadraticCurveTo(-18, -34, -15, -50);
  ctx.quadraticCurveTo(0, -56, 15, -50);
  ctx.quadraticCurveTo(18, -34, 9, -18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1b1d24";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-13, -46);
  ctx.lineTo(-19, -58);
  ctx.moveTo(13, -46);
  ctx.lineTo(19, -58);
  ctx.stroke();
  ctx.strokeStyle = "#2c3038";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-22, -60);
  ctx.lineTo(22, -60);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.fillStyle = "#f2f0ea";
  ctx.beginPath();
  ctx.arc(0, -58, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f8fd8";
  ctx.fillRect(-2, -68, 4, 20);

  ctx.fillStyle = braking ? COLORS.red : "#5a1820";
  roundRect(-6, -16, 12, 5, 2);
  ctx.fill();
  if (braking) {
    ctx.globalAlpha = 0.45 * alpha;
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.ellipse(0, -13, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
}

function drawSportBody(braking, alpha) {
  ctx.fillStyle = "#8e1224";
  ctx.beginPath();
  ctx.moveTo(-50, 10);
  ctx.quadraticCurveTo(-54, -10, -34, -46);
  ctx.quadraticCurveTo(-26, -76, 0, -78);
  ctx.quadraticCurveTo(26, -76, 34, -46);
  ctx.quadraticCurveTo(54, -10, 50, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e23a4e";
  ctx.beginPath();
  ctx.moveTo(-44, 6);
  ctx.quadraticCurveTo(-47, -10, -29, -44);
  ctx.quadraticCurveTo(-22, -72, 0, -74);
  ctx.quadraticCurveTo(22, -72, 29, -44);
  ctx.quadraticCurveTo(47, -10, 44, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffd0d6";
  ctx.fillRect(-2, -72, 4, 20);

  ctx.fillStyle = "#111820";
  ctx.beginPath();
  ctx.moveTo(-20, -18);
  ctx.lineTo(-14, -50);
  ctx.lineTo(14, -50);
  ctx.lineTo(20, -18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(170, 210, 255, 0.24)";
  ctx.beginPath();
  ctx.moveTo(-11, -46);
  ctx.lineTo(11, -46);
  ctx.lineTo(9, -38);
  ctx.lineTo(-9, -38);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = braking ? COLORS.red : "#4a121c";
  roundRect(-40, 0, 22, 4, 1);
  ctx.fill();
  roundRect(18, 0, 22, 4, 1);
  ctx.fill();
  drawBrakeGlow(braking, alpha, 2);

  ctx.fillStyle = "#14161c";
  ctx.fillRect(-26, -10, 3, 8);
  ctx.fillRect(23, -10, 3, 8);
  roundRect(-48, -15, 96, 7, 2);
  ctx.fill();
  ctx.fillRect(-48, -18, 4, 12);
  ctx.fillRect(44, -18, 4, 12);

  drawPlate("4K");
}

function drawCar(opts = {}) {
  const ghost = Boolean(opts.ghost);
  const h = 96;
  const x = opts.x ?? width / 2;
  const y = opts.y ?? carScreenY() + 10;
  const extraScale = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  const bob = ghost || REDUCE || state.speed < 8 ? 0 : Math.sin(state.time * 5.2) * Math.min(0.45, (state.speed - 8) * 0.02);
  const braking = ghost ? false : !state.holding && state.speed > 1;
  const pose = ghost ? { x: 0, y: 0, rot: 0, scale: 1, hideCone: true } : carDisasterPose();

  ctx.save();
  ctx.globalAlpha *= alpha;

  const kind = ghost ? "ghost" : state.car;
  const bike = kind === "moto";

  if (!pose.hideCone) {
    const cone = ctx.createLinearGradient(x, y - h, x, horizon + 8);
    cone.addColorStop(0, "rgba(255, 244, 210, 0.28)");
    cone.addColorStop(0.45, "rgba(255, 236, 190, 0.08)");
    cone.addColorStop(1, "rgba(255, 244, 210, 0)");
    const spread = bike ? 0.15 : 0.24;
    const mouth = bike ? 5 : 16;
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - mouth, y - h * 0.5 + bob);
    ctx.lineTo(x - width * spread, horizon + 18);
    ctx.lineTo(x + width * spread, horizon + 18);
    ctx.lineTo(x + mouth, y - h * 0.5 + bob);
    ctx.closePath();
    ctx.fill();
  }

  ctx.translate(x + pose.x, y + bob + pose.y);
  ctx.rotate(pose.rot);
  ctx.scale(pose.scale * extraScale, pose.scale * extraScale);
  if (!ghost && state.mode === "crash") {
    ctx.rotate(-0.14 - state.crashT * 0.05);
    ctx.translate(-12 - state.crashT * 10, 8);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 16, bike ? 24 : 54, bike ? 8 : 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = braking ? "rgba(255, 45, 74, 0.3)" : ghost ? "rgba(200, 210, 230, 0.12)" : "rgba(34, 227, 138, 0.14)";
  ctx.beginPath();
  ctx.ellipse(0, 12, bike ? 26 : 52, bike ? 10 : 16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === "sport") drawSportBody(braking, alpha);
  else if (bike) drawMotoBody(braking, alpha);
  else drawTaxiBody(ghost, braking, alpha);

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

function drawWaveGlow() {
  if (state.wave < 4 || (state.mode !== "play" && state.mode !== "crash")) return;
  const hue = waveTier().color;
  const strength = Math.min(1, (state.wave - 3) / 7) * 0.16;
  const edge = Math.max(26, width * 0.12);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : width;
    const g = ctx.createLinearGradient(x0, 0, x0 - side * edge, 0);
    g.addColorStop(0, hue);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = strength;
    ctx.fillStyle = g;
    ctx.fillRect(side < 0 ? 0 : width - edge, horizon, edge, height - horizon);
  }
  ctx.restore();
}

function drawFx() {
  drawWaveGlow();
  if (state.speed > 6) {
    const n = 8 + Math.floor(state.speed * 0.45);
    const tinted = state.wave >= 3 && state.mode === "play";
    ctx.strokeStyle = tinted
      ? hexA(waveTier().color, 0.12 + state.speed * 0.006)
      : `rgba(244,239,228,${0.06 + state.speed * 0.005})`;
    ctx.lineWidth = tinted ? 1.6 : 1.2;
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
  look = nightLook();
  ctx.save();
  if (state.shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    state.shake *= 0.86;
  }
  drawSky();
  drawCity();
  drawRoad();
  drawFootMarkers();
  drawSinkhole();
  drawBuildings();
  drawStreetLamps();
  const lights = state.lights
    .map((light) => ({ light, z: light.y - state.carY }))
    .filter((x) => x.z > 0.5 && x.z < 230)
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
  const frac = clamp(t / RUN_SECONDS, 0, 1);
  els.time.textContent = t.toFixed(1);
  els.time.className = t < 8 ? "critical" : t < 15 ? "warn" : "";
  els.hud.classList.toggle("is-warn", t < 15 && t >= 8);
  els.hud.classList.toggle("is-critical", t < 8);
  els.timeFuse.style.transform = `scaleX(${frac})`;
  els.timeFill.style.height = `${frac * 100}%`;
  const feet = toFeet(runScore());
  els.dist.textContent = `${feet}`;
  const mark = Math.floor(feet / 500);
  if (mark > state.ftMark && state.mode === "play") {
    state.ftMark = mark;
    els.dist.classList.remove("tick");
    void els.dist.offsetWidth;
    els.dist.classList.add("tick");
  }
  els.speed.textContent = `${toMph(state.speed)}`;
  els.pedal.classList.toggle("held", state.holding);
  els.pedal.classList.toggle("braking", !state.holding && state.speed > 1);
  els.pedalState.textContent = state.holding ? "GO" : "HOLD";
  maybeUnlockSport();
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
  } else if (state.mode === "pause") {
    audio.setEngine(0, false, false);
    render();
    requestAnimationFrame(tick);
    return;
  }
  audio.setEngine(state.speed, state.holding, state.mode === "play" || state.mode === "countdown");
  updateParticles(dt);
  render();
  updateHud();
  updateGauge(dt);
  state.wasHolding = state.holding;
  requestAnimationFrame(tick);
}

function pauseGame() {
  if (state.mode !== "play" && state.mode !== "countdown") return;
  state.resumeMode = state.mode;
  state.mode = "pause";
  state.holding = false;
  hide(els.pedalWrap);
  if (state.resumeMode === "countdown") hide(els.countdown);
  show(els.pause);
  syncWave();
  audio.ui();
}

function resumeGame() {
  if (state.mode !== "pause") return;
  last = performance.now();
  state.mode = state.resumeMode || "play";
  state.resumeMode = null;
  state.holding = false;
  hide(els.pause);
  show(els.pedalWrap);
  if (state.mode === "countdown") show(els.countdown);
  syncWave();
  audio.ui();
}

function startGame() {
  resize();
  audio.unlock();
  audio.startEngine();
  audio.ui();
  rumble(10);
  resetRun("countdown");
  rollOmen();
  rollColorblind();
  const me = authState.user?.uid;
  const leader = week.id === weekId() ? rankWeek(week.rows)[0] : null;
  state.weekLead = leader && leader.uid !== me ? leader.best : 0;
  state.countdown = 3;
  state.holding = false;
  state.countShown = "";
  hide(els.title);
  hide(els.result);
  hide(els.board);
  hide(els.profile);
  hide(els.pause);
  hide(els.authBar);
  hide(els.authError);
  show(els.hud);
  show(els.pedalWrap);
  show(els.btnPause);
  show(els.countdown);
  els.countdown.textContent = "";
  els.countdown.classList.remove("go");
}

function backToTitle() {
  if (GHOST_PAGE) {
    location.href = "/";
    return;
  }
  audio.ui();
  resetRun("title");
  hide(els.result);
  hide(els.board);
  hide(els.profile);
  hide(els.pause);
  hide(els.hud);
  hide(els.pedalWrap);
  hide(els.btnPause);
  hide(els.countdown);
  show(els.title);
  show(els.authBar);
  show(els.btnBoard);
}

function setBestLabel(n) {
  const feet = String(toFeet(n));
  els.titleBest.textContent = feet;
  els.statBest.textContent = formatFt(n);
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
  syncMedalChip();
  syncTitleWeek();
  if (authState.error) {
    els.authError.textContent = authState.error;
    show(els.authError);
  } else {
    hide(els.authError);
  }
  syncGarage();
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
    syncGarage();
  } catch (error) {
    console.warn(error);
    authState.error = "Could not post that run to the board.";
    syncAuthUi();
  }
  await postWeekRun(user, run);
}

async function postWeekRun(user, run) {
  if (run.weekPosted || Date.now() > weekEnd(run.week) + 10 * 60000) return;
  run.weekPosted = true;
  try {
    const saved = await saveWeekRun(user, run.week, { distance: run.distance, lights: run.lights });
    if (!saved.improved || run.week !== week.id) return;
    await track("week", loadWeek({ force: true }));
    if (state.mode === "result") applyChase(run);
    const rank = weekRank(user.uid);
    if (rank > 0 && state.mode === "result" && state.lastRun === run) {
      toast(rank === 1 ? "#1 THIS WEEK" : `#${rank} THIS WEEK`, "place");
      if (rank === 1) audio.top();
    }
    syncTitleWeek();
  } catch (error) {
    run.weekPosted = false;
    console.warn(error);
  }
}

function weekRank(uid) {
  return rankWeek(week.rows).find((row) => row.uid === uid)?.rank || 0;
}

function syncWeekId() {
  const id = weekId();
  if (id === week.id) return false;
  week.id = id;
  week.rows = [];
  week.loadedAt = 0;
  void loadMedals({ force: true }).then(onMedals);
  return true;
}

function loadWeek({ force = false } = {}) {
  syncWeekId();
  if (week.loading) {
    return force ? week.loading.catch(() => {}).then(() => loadWeek({ force: true })) : week.loading;
  }
  if (!force && Date.now() - week.loadedAt < 30000) return Promise.resolve(week.rows);
  const id = week.id;
  week.loading = fetchWeek(id)
    .then((rows) => {
      if (id === week.id) {
        week.rows = rows;
        week.loadedAt = Date.now();
      }
      return week.rows;
    })
    .finally(() => {
      week.loading = null;
    });
  return week.loading;
}

function loadBoardRows({ force = false } = {}) {
  if (boardLoading) return boardLoading;
  if (!force && Date.now() - boardLoadedAt < 30000) return Promise.resolve(boardRows);
  boardLoading = Promise.race([
    fetchBoard(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
  ])
    .then((rows) => {
      boardRows = rows;
      boardLoadedAt = Date.now();
      return rows;
    })
    .finally(() => {
      boardLoading = null;
    });
  return boardLoading;
}

function medalLabel(n) {
  return `${n} weekly medal${n === 1 ? "" : "s"}`;
}

function medalInner(n) {
  return `<i class="medal" aria-hidden="true"></i>${n > 1 ? `<b>${n}</b>` : ""}`;
}

function medalTag(uid) {
  const n = medalsFor(uid).length;
  if (!n) return "";
  return `<span class="medal-tag" title="${medalLabel(n)}" aria-label="${medalLabel(n)}">${medalInner(n)}</span>`;
}

function syncMedalChip() {
  const uid = authState.user?.uid;
  const n = uid ? medalsFor(uid).length : 0;
  els.authMedals.innerHTML = n ? medalInner(n) : "";
  els.authMedals.setAttribute("aria-label", n ? medalLabel(n) : "");
  els.authMedals.classList.toggle("hidden", !n);
}

function syncTitleWeek() {
  syncWeekId();
  const left = countdown(weekEnd(week.id) - Date.now());
  const uid = authState.user?.uid;
  const rank = uid ? weekRank(uid) : 0;
  els.titleWeek.textContent = rank ? `#${rank} THIS WEEK · ENDS IN ${left}` : `WEEKLY MEDAL · ENDS IN ${left}`;
}

function onMedals() {
  syncMedalChip();
  rerenderLeaders();
  announceMedal();
}

function announceMedal() {
  const uid = authState.user?.uid;
  if (!uid) return;
  const lastWeek = shiftWeek(weekId(), -1);
  const won = medalsFor(uid).find((m) => m.week === lastWeek);
  if (!won || localStorage.getItem(MEDAL_SEEN_KEY) === `${uid}:${lastWeek}`) return;
  if (state.mode !== "title" && state.mode !== "result") return;
  localStorage.setItem(MEDAL_SEEN_KEY, `${uid}:${lastWeek}`);
  toast("YOU WON THE WEEK", "place");
  audio.best();
}

async function mergeCloudBest() {
  const user = authState.user;
  if (!user) return;
  try {
    const profile = await loadProfile(user.uid);
    const best = Math.max(getBest(), Number(profile?.best) || 0);
    setBest(best);
    setBestLabel(best);
    syncGarage();
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

const boardStatus = { week: "idle", best: "idle" };

const BOARD_FLAVOR = {
  week: ["Top run by Sunday midnight CT wins a medal.", "Sign in to race for this week’s medal."],
  best: ["Best single run, all time.", "Sign in to save your score on the leaderboard."],
  total: ["Every foot driven, all time.", "Sign in to save your score on the leaderboard."],
};

function boardRanked() {
  if (boardMetric === "week") return rankWeek(week.rows);
  return rankBoard(boardRows, boardMetric);
}

function renderBoardMeta() {
  const weekly = boardMetric === "week";
  els.boardMeta.classList.toggle("hidden", !weekly);
  els.boardFlavor.textContent = BOARD_FLAVOR[boardMetric][authState.user ? 0 : 1];
  if (!weekly) return;
  els.boardEnds.textContent = `${weekLabel(week.id)} · ENDS IN ${countdown(weekEnd(week.id) - Date.now())}`;
  const champ = medals.champions.find((c) => c.week === shiftWeek(week.id, -1));
  if (champ) {
    els.boardLast.innerHTML = `LAST WEEK <i class="medal" aria-hidden="true"></i> ${safeText(boardName(champ.name))}`;
    show(els.boardLast);
  } else {
    hide(els.boardLast);
  }
}

function renderBoard() {
  renderBoardMeta();
  els.boardList.innerHTML = "";
  const me = authState.user?.uid;
  const weekly = boardMetric === "week";
  const rows = boardRanked();
  for (const row of rows) {
    const item = document.createElement("li");
    item.dataset.uid = row.uid;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    if (row.uid === me) item.classList.add("me");
    if (weekly && row.rank === 1) item.classList.add("lead");
    item.innerHTML = `
      <span class="rank">${row.rank}</span>
      <img alt="" referrerpolicy="no-referrer" src="${safePhoto(row.photoUrl)}" />
      <span class="who"><span class="nm">${safeText(boardName(row.name))}</span>${medalTag(row.uid)}</span>
      <span class="meters">${formatFt(row.shown, { miles: boardMetric === "total" })}</span>
    `;
    els.boardList.appendChild(item);
  }
  const status = boardStatus[weekly ? "week" : "best"];
  if (rows.length) hide(els.boardEmpty);
  else {
    if (status === "loading" || status === "idle") els.boardEmpty.textContent = "Loading…";
    else if (status === "error") els.boardEmpty.textContent = "Couldn’t load the leaderboard. Try again.";
    else els.boardEmpty.textContent = weekly ? "No runs yet this week. Take the lead." : "No ranked runs yet.";
    show(els.boardEmpty);
  }
  if (status === "ok" || rows.length) els.boardList.dataset.ready = "1";
}

function syncBoardTabs() {
  for (const id of BOARD_METRICS) els.tabs[id].setAttribute("aria-selected", id === boardMetric ? "true" : "false");
}

function setBoardMetric(metric) {
  boardMetric = BOARD_METRICS.includes(metric) ? metric : "week";
  localStorage.setItem(BOARD_METRIC_KEY, boardMetric);
  syncBoardTabs();
  delete els.boardList.dataset.ready;
  renderBoard();
  audio.ui();
}

function rerenderLeaders() {
  if (!els.board.classList.contains("hidden")) renderBoard();
  if (!els.profile.classList.contains("hidden")) renderProfile();
  syncTitleWeek();
}

function track(key, promise) {
  if (boardStatus[key] !== "ok") boardStatus[key] = "loading";
  return promise
    .then(() => {
      boardStatus[key] = "ok";
    })
    .catch((error) => {
      console.warn(error);
      if (boardStatus[key] !== "ok") boardStatus[key] = "error";
    })
    .finally(rerenderLeaders);
}

function refreshLeaders() {
  return Promise.all([
    track("best", loadBoardRows({ force: true })),
    track("week", loadWeek({ force: true })),
    loadMedals().then(onMedals, (error) => console.warn(error)),
  ]);
}

function openBoard() {
  audio.ui();
  hide(els.title);
  hide(els.result);
  hide(els.profile);
  show(els.board);
  show(els.authBar);
  hide(els.btnBoard);
  syncBoardTabs();
  delete els.boardList.dataset.ready;
  renderBoard();
  void refreshLeaders();
}

function returnHome() {
  if (state.mode === "result") show(els.result);
  else {
    show(els.title);
    state.mode = "title";
  }
  show(els.authBar);
  show(els.btnBoard);
}

function closeBoard() {
  audio.ui();
  hide(els.board);
  returnHome();
}

function rankOf(rows, uid) {
  return rows.find((row) => row.uid === uid) || null;
}

function renderProfile() {
  const uid = profileUid;
  const me = authState.user;
  const own = Boolean(me && me.uid === uid);
  const weekRow = rankOf(rankWeek(week.rows), uid);
  const bestRow = rankOf(rankBoard(boardRows, "best"), uid);
  const totalRow = rankOf(rankBoard(boardRows, "total"), uid);
  const won = medalsFor(uid);
  const champ = won[0];
  const name = (own && me.name) || bestRow?.name || weekRow?.name || champ?.name || "Night driver";
  const photo = (own && me.photoUrl) || bestRow?.photoUrl || weekRow?.photoUrl || champ?.photoUrl || "";
  els.profilePhoto.src = safePhoto(photo);
  els.profileName.textContent = boardName(name).toUpperCase();
  els.profileMedalCount.innerHTML = won.length
    ? `<i class="medal" aria-hidden="true"></i> ${won.length} WEEKLY MEDAL${won.length === 1 ? "" : "S"}`
    : "NO MEDALS YET";
  els.profileMedals.innerHTML = won
    .map(
      (m) =>
        `<li><i class="medal" aria-hidden="true"></i><span>${weekLabel(m.week)}</span><span class="meters">${formatFt(m.best)}</span></li>`
    )
    .join("");
  els.profileMedals.classList.toggle("hidden", !won.length);
  els.profileMedalEmpty.classList.toggle("hidden", Boolean(won.length));
  els.profileMedalEmpty.textContent = own
    ? "Finish a week with the top run to earn a medal."
    : "No weekly wins yet.";
  els.profileWeek.textContent = weekRow ? formatFt(weekRow.best) : "—";
  els.profileWeekRank.textContent = weekRow ? `#${weekRow.rank}` : "";
  const marked = boardRows.some((row) => row.uid === uid && row.voided);
  const best = own && !marked ? Math.max(getBest(), bestRow?.best || 0) : bestRow?.best;
  els.profileBest.textContent = best ? formatFt(best) : "—";
  els.profileBestRank.textContent = bestRow ? `#${bestRow.rank}` : "";
  els.profileTotal.textContent = totalRow ? formatFt(totalRow.total, { miles: true }) : "—";
  els.profileTotalRank.textContent = totalRow ? `#${totalRow.rank}` : "";
  els.btnOut.classList.toggle("hidden", !own);
}

function openProfile(uid, from) {
  if (!uid) return;
  audio.ui();
  profileUid = uid;
  profileFrom = from;
  hide(els.title);
  hide(els.result);
  hide(els.board);
  show(els.profile);
  show(els.authBar);
  hide(els.btnBoard);
  renderProfile();
  void refreshLeaders();
}

function closeProfile() {
  audio.ui();
  hide(els.profile);
  if (profileFrom === "board") {
    show(els.board);
    hide(els.btnBoard);
    renderBoard();
    return;
  }
  returnHome();
}

function overlayOpen() {
  return !els.board.classList.contains("hidden") || !els.profile.classList.contains("hidden");
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
  if (e.code === "Escape" || e.code === "KeyP") {
    e.preventDefault();
    if (state.mode === "play" || state.mode === "countdown") pauseGame();
    else if (state.mode === "pause") resumeGame();
    return;
  }
  if (state.mode === "pause") return;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    if ((state.mode === "title" || state.mode === "result") && !overlayOpen()) startGame();
    else if (state.mode === "play" || state.mode === "countdown") state.holding = true;
  }
  if (e.code === "Enter" && (state.mode === "title" || state.mode === "result") && !overlayOpen()) startGame();
  if (e.code === "KeyR" && state.mode === "result" && !overlayOpen()) startGame();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    state.holding = false;
  }
});

document.getElementById("btn-start").addEventListener("click", startGame);
document.getElementById("btn-retry").addEventListener("click", startGame);
els.btnShare.addEventListener("click", () => void shareRun());
document.getElementById("btn-home").addEventListener("click", backToTitle);
els.btnPause.addEventListener("click", () => {
  if (state.mode === "pause") resumeGame();
  else pauseGame();
});
els.btnResume.addEventListener("click", resumeGame);
els.btnRestart.addEventListener("click", startGame);
els.btnExit.addEventListener("click", backToTitle);
els.btnIn.addEventListener("click", () => void signInWithGoogle());
els.btnSave.addEventListener("click", () => void signInWithGoogle());
els.btnOut.addEventListener("click", () => {
  void signOut();
  closeProfile();
});
els.btnBoard.addEventListener("click", openBoard);
els.btnBoardClose.addEventListener("click", closeBoard);
for (const id of BOARD_METRICS) els.tabs[id].addEventListener("click", () => setBoardMetric(id));
els.boardList.addEventListener("click", (e) => {
  const row = e.target.closest("li[data-uid]");
  if (row) openProfile(row.dataset.uid, "board");
});
els.boardList.addEventListener("keydown", (e) => {
  if (e.code !== "Enter" && e.code !== "Space") return;
  const row = e.target.closest("li[data-uid]");
  if (!row) return;
  e.preventDefault();
  e.stopPropagation();
  openProfile(row.dataset.uid, "board");
});
els.authUser.addEventListener("click", () => {
  if (!authState.user) return;
  if (!els.profile.classList.contains("hidden") && profileUid === authState.user.uid) closeProfile();
  else openProfile(authState.user.uid, els.board.classList.contains("hidden") ? "" : "board");
});
els.btnProfileClose.addEventListener("click", closeProfile);
els.garage.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-car]");
  if (!btn) return;
  const id = btn.dataset.car;
  audio.unlock();
  if (!carUnlocked(id)) {
    if (id === "moto") {
      if (!authState.ready || authState.pending) return;
      sessionStorage.setItem(PENDING_CAR_KEY, "moto");
      toast("SIGN IN TO UNLOCK", "place");
      void signInWithGoogle();
    } else toast("HIT 4,000 FT", "place");
    return;
  }
  chooseCar(id);
  audio.rev();
});
els.mute.addEventListener("click", () => {
  audio.unlock();
  audio.toggleMute();
  syncMuteUi();
});
audio.onMuteChange(syncMuteUi);
syncMuteUi();

function allowBoardScroll(target) {
  return Boolean(target && target.closest && target.closest("#board-list, #profile-medals"));
}

function isPinch(e) {
  return e.touches.length > 1 || (typeof e.scale === "number" && e.scale !== 1);
}

document.addEventListener(
  "touchmove",
  (e) => {
    if (isPinch(e)) {
      e.preventDefault();
      return;
    }
    if (allowBoardScroll(e.target)) return;
    e.preventDefault();
  },
  { passive: false, capture: true }
);
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false, capture: true });
}
document.addEventListener("dblclick", (e) => e.preventDefault(), { capture: true });
for (const type of ["selectstart", "contextmenu"]) {
  document.addEventListener(type, (e) => e.preventDefault(), { capture: true });
}
document.addEventListener("selectionchange", () => {
  const sel = document.getSelection();
  if (sel && !sel.isCollapsed) sel.removeAllRanges();
});
document.addEventListener(
  "click",
  (e) => {
    if (e.detail > 1) e.preventDefault();
  },
  true
);

let lastTapAt = 0;
let lastTapX = 0;
let lastTapY = 0;

function isRepeatTap(touch) {
  const dt = performance.now() - lastTapAt;
  const dx = touch.clientX - lastTapX;
  const dy = touch.clientY - lastTapY;
  return dt < 500 && dx * dx + dy * dy < 4096;
}

function rememberTap(touch) {
  lastTapAt = performance.now();
  lastTapX = touch.clientX;
  lastTapY = touch.clientY;
}

document.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false, capture: true }
);
document.addEventListener(
  "touchend",
  (e) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    if (isRepeatTap(touch)) e.preventDefault();
    rememberTap(touch);
  },
  { passive: false, capture: true }
);
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
window.addEventListener("pageshow", resize);
window.visualViewport?.addEventListener("resize", resize);
if ("ResizeObserver" in window) new ResizeObserver(resize).observe(appEl);

els.titleBest.textContent = String(toFeet(getBest()));
buildGauge();
syncGarage();
resetRun("title");
if (GHOST_PAGE) {
  document.title = "Ghost — Stoplight Simulator";
  const robots = document.querySelector('meta[name="robots"]');
  if (robots) robots.setAttribute("content", "noindex");
}
resize();
syncAuthUi();
onAuthChange((next) => {
  syncAuthUi();
  rerenderLeaders();
  if (next.user) {
    void mergeCloudBest();
    announceMedal();
  }
});
void startAuth();
void loadMedals().then(onMedals, (error) => console.warn(error));
void track("week", loadWeek());
setInterval(() => {
  if (syncWeekId()) void track("week", loadWeek({ force: true }));
  if (state.mode === "title" || state.mode === "result") rerenderLeaders();
}, 30000);

let lampIndex = 0;
setInterval(() => {
  els.lamps.forEach((el, i) => el.classList.toggle("on", i === lampIndex));
  lampIndex = (lampIndex + 1) % 3;
}, 380);

requestAnimationFrame((t) => {
  last = t;
  tick(t);
});

if (GHOST_PAGE) startGame();

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
  window.__colorblind = () => {
    beginColorblind();
  };
  window.__car = (id) => {
    state.car = CAR_IDS.includes(id) ? id : "taxi";
    audio.setCar(state.car);
  };
  window.__gold = () => {
    for (const light of state.lights) light.lucky = true;
  };
  window.__wave = (n, lucky = false) => {
    state.wave = n - 1;
    passLight({ lucky });
  };
  window.__endRun = (reason = "time", dist = 847, left) => {
    hide(els.title);
    hide(els.countdown);
    state.mode = "play";
    state.carY = dist;
    state.cleared = 11;
    if (Number.isFinite(Number(left))) state.remaining = Number(left);
    endRun(reason);
  };
}
