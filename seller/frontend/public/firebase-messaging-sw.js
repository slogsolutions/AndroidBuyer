// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Replace with same config you used in src/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyB8ZUOwfnZvnKmrbfMT0F6fzqkkaZkERWM",
  authDomain: "parkvech.firebaseapp.com",
  projectId: "parkvech",
  // storageBucket: "parkvech.firebasestorage.app",
   storageBucket: "parkvech.appspot.com",
  messagingSenderId: "113484775657",
  appId: "1:113484775657:web:111eb6bcd375c9b7a63078",
  measurementId: "G-8Z12P6H2T4"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();


//Background Notify
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const title = payload.notification?.title || 'Background Message';
  const options = {
    body: payload.notification?.body || (payload.data && payload.data.body) || '',
    icon: '/logo192.png', // adjust as needed
    data: payload.data || {}
  };

  self.registration.showNotification(title, options);
});


// optional: handle notification click to focus/open the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
