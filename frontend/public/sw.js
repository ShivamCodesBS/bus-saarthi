self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Bus Saarthi', body: event.data.text() };
    }

    const options = {
      body: data.body,
      icon: data.icon || '/icons/bus-192x192.png',
      badge: data.badge || '/icons/bus-72x72.png',
      tag: data.tag || 'bus-saarthi',
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: data.url || '/home' },
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Bus Saarthi', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const targetUrl = event.notification.data?.url || '/home';
      for (let i = 0; i < clientList.length; i++) {
        let c = clientList[i];
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          return c.focus();
        }
      }
      if (clients.openWindow) {
        const urlToOpen = new URL(targetUrl, self.location.origin).href;
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
