/* Maatram Foundation – Firebase Cloud Messaging Service Worker */
/* FCM requires this file to be named firebase-messaging-sw.js at the root */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDOS7IPk3R1y5XIKCVb0KZZhYSsrSWbb4U',
  authDomain: 'maatram-volunteering-app.firebaseapp.com',
  projectId: 'maatram-volunteering-app',
  storageBucket: 'maatram-volunteering-app.firebasestorage.app',
  messagingSenderId: '253841313122',
  appId: '1:253841313122:web:32605bdfa6d76086dcb03b',
});

const messaging = firebase.messaging();

// Handle background messages (app tab closed or in background)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Maatram Foundation';
  const body = payload.notification?.body || payload.data?.body || '';
  const deepLink = payload.data?.deepLink || '/dashboard';
  const opportunityId = payload.data?.opportunityId || '';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: opportunityId || 'maatram-notification',
    renotify: true,
    data: { deepLink, ...payload.data },
  });
});

// Handle notification click — open or focus the app and navigate to the opportunity
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || '/dashboard';
  const url = new URL(deepLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'navigate', url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
