import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  return undefined;
}

async function fetchBoardRest() {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "board" }],
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`board ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row.document)
    .map((row) => {
      const fields = row.document.fields || {};
      const id = String(row.document.name || "").split("/").pop();
      return readBoardRow(id, {
        displayName: restValue(fields.displayName),
        photoURL: restValue(fields.photoURL),
        best: restValue(fields.best),
        total: restValue(fields.total),
        bestLights: restValue(fields.bestLights),
      });
    });
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
