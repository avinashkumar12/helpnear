importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let _initialized = false;

async function initFirebase() {
  if (_initialized) return;
  try {
    const res = await fetch('/api/v1/public/fcm-config');
    if (!res.ok) return;
    const { data: cfg } = await res.json();
    if (!cfg?.apiKey || !cfg?.projectId) return;
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(payload => {
      const n = payload.notification || {};
      return self.registration.showNotification(n.title || 'HelperNear', {
        body: n.body || '',
        icon: n.icon || '/assets/logo-icon.svg',
        badge: '/assets/logo-icon.svg',
        data: { link: payload.fcmOptions?.link || '/' },
      });
    });
    _initialized = true;
  } catch (_) {}
}

self.addEventListener('install', e => {
  e.waitUntil(initFirebase().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(initFirebase().then(() => self.clients.claim()));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.link || '/app';
  e.waitUntil(clients.openWindow(url));
});
