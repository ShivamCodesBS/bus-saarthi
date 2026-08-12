self.addEventListener('install', function(event) {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim()); // Tell the active service worker to take control of the page immediately.
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/bus-icon-192.png', // The main image shown next to the notification
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (event.notification.data.url) {
        let client = null;
        for (let i = 0; i < clientList.length; i++) {
          let c = clientList[i];
          if (c.url.includes(event.notification.data.url) && 'focus' in c) {
            client = c;
            break;
          }
        }
        if (client) {
          return client.focus();
        }
        if (clients.openWindow) {
          // ensure the full url is opened or relative
          const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
          return clients.openWindow(urlToOpen);
        }
      }
    })
  );
});
