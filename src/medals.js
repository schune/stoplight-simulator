import { fetchWeekWinner } from "./scores.js";
import { FIRST_WEEK, shiftWeek, weekEnd, weekId, weeksBetween } from "./weeks.js";

const CACHE_KEY = "stoplight-sim-champs-v1";
const SETTLE_MS = 2 * 3600000;

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export const medals = {
  champions: [],
  byUid: new Map(),
};

let inflight = null;
let loadedAt = 0;

function index(champions) {
  const byUid = new Map();
  for (const champ of champions) {
    const list = byUid.get(champ.uid) || [];
    list.push(champ);
    byUid.set(champ.uid, list);
  }
  medals.champions = champions;
  medals.byUid = byUid;
}

index(
  Object.entries(readCache())
    .filter(([, champ]) => champ && champ.uid)
    .map(([week, champ]) => ({ week, ...champ }))
    .sort((a, b) => (a.week < b.week ? 1 : -1))
);

export function medalsFor(uid) {
  return medals.byUid.get(uid) || [];
}

export function loadMedals({ force = false } = {}) {
  if (inflight) return inflight;
  if (!force && Date.now() - loadedAt < 60000) return Promise.resolve(medals);
  const now = Date.now();
  const last = shiftWeek(weekId(now), -1);
  if (last < FIRST_WEEK) {
    loadedAt = now;
    return Promise.resolve(medals);
  }
  inflight = (async () => {
    const cache = readCache();
    const unsettled = {};
    const weeks = weeksBetween(FIRST_WEEK, last);
    await Promise.all(
      weeks
        .filter((week) => !(week in cache))
        .map(async (week) => {
          try {
            const winner = await fetchWeekWinner(week);
            const champ = winner
              ? { uid: winner.uid, name: winner.name, photoUrl: winner.photoUrl, best: winner.best }
              : null;
            if (now > weekEnd(week) + SETTLE_MS) cache[week] = champ;
            else unsettled[week] = champ;
          } catch (error) {
            console.warn(error);
          }
        })
    );
    const champions = weeks
      .map((week) => {
        const champ = week in cache ? cache[week] : unsettled[week];
        return champ && champ.uid ? { week, ...champ } : null;
      })
      .filter(Boolean)
      .reverse();
    writeCache(cache);
    index(champions);
    loadedAt = Date.now();
    return medals;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
