import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// 🔧 SUBSTITUA com suas credenciais do Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyApU-DIViYMF0jyz6mL2Gok89n-i446bvs",
  authDomain: "airbnb-manager-f4646.firebaseapp.com",
  projectId: "airbnb-manager-f4646",
  storageBucket: "airbnb-manager-f4646.firebasestorage.app",
  messagingSenderId: "913378737899",
  appId: "1:913378737899:web:573bc7a8f15c2a58ff08ae"
};

// 🔧 SUBSTITUA com sua VAPID key (Firebase Console > Cloud Messaging > Web Push certificates)
export const VAPID_KEY = "BEmYMLfI58VSSu5-LTXihjLThQD-pOLx29ptrh6IJlIi3db6WWt7lnAbXDdybecAYgICkaPQfDjt1fCQE1qyh3U";

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

// ── Salva token FCM do dispositivo ──────────────────────────────────────────
export async function saveFCMToken(token) {
  await setDoc(doc(db, "tokens", "device"), { token, updatedAt: new Date().toISOString() });
}

// ── Salva reserva no Firestore (para notificações) ──────────────────────────
export async function saveReservaRemota(reserva) {
  await setDoc(doc(db, "reservas", String(reserva.id)), {
    flatName:  reserva.flatName,
    checkin:   reserva.checkin,
    guestNames: reserva.guests.join(", "),
    authorized: reserva.authorized,
  });
}

// ── Remove reserva do Firestore ──────────────────────────────────────────────
export async function deleteReservaRemota(id) {
  await deleteDoc(doc(db, "reservas", String(id)));
}

// ── Pede permissão e retorna token FCM ──────────────────────────────────────
export async function requestNotificationPermission() {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) await saveFCMToken(token);
    return token;
  } catch (e) {
    console.error("Erro ao obter token FCM:", e);
    return null;
  }
}

export function getNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

// ── Listener de mensagens em foreground ─────────────────────────────────────
export function onForegroundMessage(callback) {
  if (!messaging) return;
  onMessage(messaging, callback);
}
