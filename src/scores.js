import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";
import { db } from "./firebase.js";

const BOARD = "board";

function clipName(name) {
  return String(name || "Night driver").slice(0, 48);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || "timeout")), ms)),
  ]);
}

function readBoardRow(id, data) {
  const best = Number(data.best) || 0;
  const storedTotal = Number(data.total);
  return {
    uid: id,
    name: data.displayName || "Night driver",
    photoUrl: data.photoURL || "",
    best,
    total: Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : best,
    lights: Number(data.bestLights) || 0,
  };
}

export function rankBoard(rows, metric) {
  const key = metric === "total" ? "total" : "best";
  return [...rows]
    .sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0) || String(a.name).localeCompare(String(b.name)))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      shown: Math.round(Number(row[key]) || 0),
    }));
}

function restValue(field) {
  if (!field) return undefined;
  if (field.stringValue != null) return field.stringValue;
  if (field.integerValue != null) return Number(field.integerValue);
  if (field.doubleValue != null) return Number(field.doubleValue);
  if (field.timestampValue != null) return Date.parse(field.timestampValue);
  return undefined;
}

async function runQueryRest(parent, structuredQuery) {
  const base = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;
  const res = await fetch(
    `https://firestore.googleapis.com/v1/${base}${parent ? `/${parent}` : ""}:runQuery?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
    }
  );
  if (!res.ok) throw new Error(`query ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row.document)
    .map((row) => {
      const fields = row.document.fields || {};
      const data = {};
      for (const key of Object.keys(fields)) data[key] = restValue(fields[key]);
      return { id: String(row.document.name || "").split("/").pop(), data };
    });
}

async function fetchBoardRest() {
  const docs = await runQueryRest("", { from: [{ collectionId: BOARD }] });
  return docs.map(({ id, data }) => readBoardRow(id, data));
}

function timeOf(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return Number.MAX_SAFE_INTEGER;
}

function readWeekRow(id, data) {
  return {
    uid: id,
    name: data.displayName || "Night driver",
    photoUrl: data.photoURL || "",
    best: Number(data.best) || 0,
    lights: Number(data.lights) || 0,
    at: timeOf(data.at),
  };
}

export function rankWeek(rows) {
  return [...rows]
    .filter((row) => row.best > 0)
    .sort((a, b) => b.best - a.best || a.at - b.at || String(a.name).localeCompare(String(b.name)))
    .map((row, index) => ({ ...row, rank: index + 1, shown: Math.round(row.best) }));
}

function weekRuns(id) {
  return collection(db, "weeks", id, "runs");
}

export async function fetchWeek(id) {
  try {
    const snap = await withTimeout(getDocs(weekRuns(id)), 4000, "week-timeout");
    return snap.docs.map((item) => readWeekRow(item.id, item.data()));
  } catch {
    const docs = await runQueryRest(`weeks/${id}`, { from: [{ collectionId: "runs" }] });
    return docs.map(({ id: uid, data }) => readWeekRow(uid, data));
  }
}

export async function fetchWeekWinner(id) {
  let rows;
  try {
    const snap = await withTimeout(
      getDocs(query(weekRuns(id), orderBy("best", "desc"), limit(8))),
      5000,
      "winner-timeout"
    );
    rows = snap.docs.map((item) => readWeekRow(item.id, item.data()));
  } catch {
    const docs = await runQueryRest(`weeks/${id}`, {
      from: [{ collectionId: "runs" }],
      orderBy: [{ field: { fieldPath: "best" }, direction: "DESCENDING" }],
      limit: 8,
    });
    rows = docs.map(({ id: uid, data }) => readWeekRow(uid, data));
  }
  return rankWeek(rows)[0] || null;
}

export async function saveWeekRun(user, id, { distance, lights }) {
  const ref = doc(db, "weeks", id, "runs", user.uid);
  const snap = await withTimeout(getDoc(ref), 6000, "week-read-timeout");
  const prev = snap.exists() ? snap.data() : null;
  const best = Math.min(5000, Math.round(Number(distance) || 0));
  const name = clipName(user.name);
  const photo = String(user.photoUrl || "").slice(0, 900);
  const prevBest = Number(prev?.best) || 0;
  if (prev && best <= prevBest) {
    if (prev.displayName === name && prev.photoURL === photo) return { best: prevBest, improved: false };
    await withTimeout(
      setDoc(ref, { best: prevBest, lights: Number(prev.lights) || 0, displayName: name, photoURL: photo, at: prev.at }),
      8000,
      "week-save-timeout"
    );
    return { best: prevBest, improved: false };
  }
  if (best <= 0) return { best: prevBest, improved: false };
  await withTimeout(
    setDoc(ref, {
      best,
      lights: Math.min(1000, Math.round(Number(lights) || 0)),
      displayName: name,
      photoURL: photo,
      at: serverTimestamp(),
    }),
    8000,
    "week-save-timeout"
  );
  return { best, improved: true };
}

export async function loadProfile(uid) {
  const snap = await withTimeout(getDoc(doc(db, BOARD, uid)), 6000, "profile-timeout");
  return snap.exists() ? snap.data() : null;
}

export async function saveRun(user, { distance, lights, reason, localBest }) {
  const ref = doc(db, BOARD, user.uid);
  let prev = null;
  try {
    prev = await loadProfile(user.uid);
  } catch {
    prev = null;
  }
  const runDist = Math.round(Number(distance) || 0);
  const best = Math.round(Math.max(Number(prev?.best) || 0, Number(localBest) || 0, runDist));
  const fromThisRun = best === runDist;
  const prevTotal = Number(prev?.total);
  const baseTotal = Number.isFinite(prevTotal) ? Math.max(0, prevTotal) : Math.round(Number(prev?.best) || 0);
  const total = Math.min(
    100000000,
    reason === "sync" ? Math.max(baseTotal, Math.round(Number(localBest) || 0)) : baseTotal + runDist
  );
  await withTimeout(
    setDoc(
      ref,
      {
        displayName: clipName(user.name),
        photoURL: user.photoUrl || "",
        best,
        total,
        bestLights: fromThisRun ? Math.round(Number(lights) || 0) : Math.round(Number(prev?.bestLights) || 0),
        lastDistance: runDist,
        lastLights: Math.round(Number(lights) || 0),
        lastReason: String(reason || ""),
        updatedAt: serverTimestamp(),
        createdAt: prev?.createdAt || serverTimestamp(),
      },
      { merge: true }
    ),
    8000,
    "save-timeout"
  );
  return best;
}

export async function fetchBoard() {
  try {
    const snap = await withTimeout(
      getDocs(collection(db, BOARD)),
      4000,
      "board-timeout"
    );
    return snap.docs.map((item) => readBoardRow(item.id, item.data()));
  } catch {
    return fetchBoardRest();
  }
}
