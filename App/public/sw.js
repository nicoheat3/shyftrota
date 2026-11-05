// ShyftRota service worker — only shows push notifications.
// It deliberately does NOT cache the app, so every deploy shows up right away.

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  var title = data.title || "ShyftRota";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag || undefined,          // a newer notice with the same tag replaces the older one
    renotify: !!data.tag,
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (wins) {
    for (var i = 0; i < wins.length; i++) {
      var w = wins[i];
      if (new URL(w.url).origin === self.location.origin) {
        return w.focus().then(function (fw) { return fw && fw.navigate ? fw.navigate(target) : fw; });
      }
    }
    return self.clients.openWindow(target);
  }));
});
