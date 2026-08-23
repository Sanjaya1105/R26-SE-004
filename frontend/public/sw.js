self.addEventListener("push", (event) => {
  let data = {
    title: "Lesson processing complete",
    body: "Your uploaded materials are ready.",
    url: "/upload-lesson",
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (_) {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Lesson ready", {
      body: data.body || "Processing finished.",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url || "/upload-lesson" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/upload-lesson";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
