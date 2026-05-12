// public/firebase-messaging-sw.js
// Service worker para receber notificações push em background

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// 🔧 SUBSTITUA com as mesmas credenciais do src/firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyApU-DIViYMF0jyz6mL2Gok89n-i446bvs",
  authDomain: "airbnb-manager-f4646.firebaseapp.com",
  projectId: "airbnb-manager-f4646",
  storageBucket: "airbnb-manager-f4646.firebasestorage.app",
  messagingSenderId: "913378737899",
  appId: "1:913378737899:web:573bc7a8f15c2a58ff08ae"
};

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: "/airbnb/icon-192.png",
    badge: "/airbnb/icon-192.png",
    data: { url: "/airbnb/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/airbnb/"));
});
