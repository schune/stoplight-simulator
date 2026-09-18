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

function clipName(name) {
  return String(name || "Night driver").slice(0, 48);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || "timeout")), ms)),
  ]);
}

function readBoardRow(id, data, index) {
  return {
    uid: id,
    rank: index + 1,
    name: data.displayName || "Night driver",
    photoUrl: data.photoURL || "",
    best: Number(data.best) || 0,
    lights: Number(data.bestLights) || 0,
  };
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
          from: [{ collectionId: "users" }],
          orderBy: [{ field: { fieldPath: "best" }, direction: "DESCENDING" }],
          limit: 10,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`board ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row.document)
    .map((row, index) => {
      const fields = row.document.fields || {};
      const id = String(row.document.name || "").split("/").pop();
      return readBoardRow(
        id,
        {
          displayName: restValue(fields.displayName),
          photoURL: restValue(fields.photoURL),
          best: restValue(fields.best),
          bestLights: restValue(fields.bestLights),
        },
        index
      );
    });
}

export async function loadProfile(uid) {
  const snap = await withTimeout(getDoc(doc(db, "users", uid)), 6000, "profile-timeout");
  return snap.exists() ? snap.data() : null;
}

export async function saveRun(user, { distance, lights, reason, localBest }) {
  const ref = doc(db, "users", user.uid);
  let prev = null;
  try {
    prev = await loadProfile(user.uid);
  } catch {
    prev = null;
  }
  const best = Math.round(Math.max(Number(prev?.best) || 0, Number(localBest) || 0, Number(distance) || 0));
  const fromThisRun = best === Math.round(Number(distance) || 0);
  await withTimeout(
    setDoc(
      ref,
      {
        displayName: clipName(user.name),
        photoURL: user.photoUrl || "",
        best,
        bestLights: fromThisRun ? Math.round(Number(lights) || 0) : Math.round(Number(prev?.bestLights) || 0),
        lastDistance: Math.round(Number(distance) || 0),
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
      getDocs(query(collection(db, "users"), orderBy("best", "desc"), limit(10))),
      4000,
      "board-timeout"
    );
    return snap.docs.map((item, index) => readBoardRow(item.id, item.data(), index));
  } catch {
    return fetchBoardRest();
  }
}
