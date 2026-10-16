/* ============================================
   AUTH — Firebase Auth (FULL FIXED)
   ============================================ */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { FIREBASE_CONFIG } from "./config.js";

let app, auth;

export function initFirebase() {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
  }
  return { app, auth };
}

// === EXPORT INI DIPERLUKAN OLEH app.js ===
export function getAuthInstance() {
  if (!auth) initFirebase();
  return auth;
}

// Ekspor juga variabel auth agar bisa dipakai langsung
export { auth };

// ============================================
// WATCH AUTH STATE
// ============================================
export function watchAuth(callback) {
  const { auth } = initFirebase();
  return onAuthStateChanged(auth, callback);
}

// ============================================
// LOGIN / REGISTER
// ============================================
export async function loginUser(email, password) {
  const { auth } = initFirebase();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerUser(email, password, displayName) {
  const { auth } = initFirebase();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred;
}

// ============================================
// GOOGLE LOGIN
// ============================================
export async function loginWithGoogle() {
  const { auth } = initFirebase();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

// ============================================
// LOGOUT
// ============================================
export async function logoutUser() {
  const { auth } = initFirebase();
  return signOut(auth);
}

// ============================================
// ANONYMOUS LOGIN
// ============================================
export async function loginAnon() {
  const { auth } = initFirebase();
  return signInAnonymously(auth);
}

// ============================================
// FORMAT ERROR
// ============================================
export function formatAuthError(err) {
  if (!err || !err.code) return err?.message || "Terjadi kesalahan";
  const map = {
    "auth/invalid-email": "Email tidak valid",
    "auth/user-not-found": "Akun tidak ditemukan",
    "auth/wrong-password": "Password salah",
    "auth/email-already-in-use": "Email sudah terdaftar",
    "auth/weak-password": "Password minimal 6 karakter",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti",
    "auth/popup-closed-by-user": "Popup ditutup",
    "auth/operation-not-allowed": "Metode login belum di-enable di Firebase",
    "auth/network-request-failed": "Koneksi internet bermasalah",
    "auth/invalid-credential": "Email atau password salah"
  };
  return map[err.code] || err.message;
}