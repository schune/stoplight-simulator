export const WEEK_TZ = "America/Chicago";
export const FIRST_WEEK = "2026-09-28";

const DAY_MS = 86400000;
const WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: WEEK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

function zoned(ms) {
  const out = {};
  for (const part of partsFormat.formatToParts(new Date(ms))) out[part.type] = part.value;
  return {
    y: Number(out.year),
    m: Number(out.month),
    d: Number(out.day),
    h: Number(out.hour),
    dow: WEEKDAYS[out.weekday] ?? 0,
  };
}

function idFromUtcDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function utcDate(id) {
  const [y, m, d] = String(id).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function weekId(ms = Date.now()) {
  const z = zoned(ms);
  return idFromUtcDate(Date.UTC(z.y, z.m - 1, z.d) - z.dow * DAY_MS);
}

export function shiftWeek(id, weeks) {
  return idFromUtcDate(utcDate(id) + weeks * 7 * DAY_MS);
}

function localMidnight(id) {
  const base = utcDate(id);
  for (const hours of [5, 6, 4, 7]) {
    const guess = base + hours * 3600000;
    const z = zoned(guess);
    if (z.h === 0 && idFromUtcDate(Date.UTC(z.y, z.m - 1, z.d)) === id) return guess;
  }
  return base + 6 * 3600000;
}

export function weekStart(id) {
  return localMidnight(id);
}

export function weekEnd(id) {
  return localMidnight(shiftWeek(id, 1));
}

export function weeksBetween(fromId, toId) {
  const out = [];
  for (let id = fromId; utcDate(id) <= utcDate(toId); id = shiftWeek(id, 1)) out.push(id);
  return out;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function weekLabel(id) {
  const a = new Date(utcDate(id));
  const b = new Date(utcDate(id) + 6 * DAY_MS);
  const left = `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()}`;
  const right =
    a.getUTCMonth() === b.getUTCMonth() ? String(b.getUTCDate()) : `${MONTHS[b.getUTCMonth()]} ${b.getUTCDate()}`;
  return `${left} – ${right}`;
}

export function countdown(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${mins % 60}M`;
  return `${Math.max(1, mins)}M`;
}
