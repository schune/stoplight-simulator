import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase.js";

const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: "select_account" });

export const authState = {
  ready: false,
  user: null,
  pending: false,
  error: "",
};

const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(authState);
}

function toUser(user) {
  return {
    uid: user.uid,
    name: user.displayName || "Night driver",
    email: user.email || "",
    photoUrl: user.photoURL || "",
  };
}

function messageFor(error) {
  const code = error && typeof error === "object" ? String(error.code || "") : "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/unauthorized-domain") return "This domain isn’t allowed for Google sign-in yet.";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn’t enabled on this project yet.";
  if (code === "auth/network-request-failed") return "Network drop. Check the connection and try again.";
  return "Could not sign in with Google. Try again.";
}

export function onAuthChange(fn) {
  listeners.add(fn);
  fn(authState);
  return () => listeners.delete(fn);
}

export async function startAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const redirected = await getRedirectResult(auth);
    if (redirected?.user) {
      authState.user = toUser(redirected.user);
      authState.pending = false;
      authState.error = "";
    }
  } catch (error) {
    authState.error = messageFor(error);
    authState.pending = false;
  }

  onAuthStateChanged(auth, (user) => {
    authState.ready = true;
    authState.user = user ? toUser(user) : null;
    authState.pending = false;
    emit();
  });
}

export async function signInWithGoogle() {
  authState.pending = true;
  authState.error = "";
  emit();
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, google);
    authState.pending = false;
    emit();
  } catch (error) {
    const code = error && typeof error === "object" ? String(error.code || "") : "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      try {
        await signInWithRedirect(auth, google);
        return;
      } catch (redirectError) {
        authState.pending = false;
        authState.error = messageFor(redirectError) || messageFor(error);
        emit();
        return;
      }
    }
    authState.pending = false;
    authState.error = messageFor(error);
    emit();
  }
}

export async function signOut() {
  authState.pending = true;
  emit();
  try {
    await firebaseSignOut(auth);
    authState.user = null;
    authState.pending = false;
    authState.error = "";
    emit();
  } catch {
    authState.pending = false;
    authState.error = "Could not sign out. Try again.";
    emit();
  }
}
