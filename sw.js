// Offline support for the web/iPhone version: every file of the app is cached on first visit,
// so the app opens without internet afterwards. Nothing else is ever fetched.
const VERSION = "shajara-20261019105318";
const FILES = ["./", "css/app.css", "fonts/thmanyahsans-Bold.woff2", "fonts/thmanyahsans-Medium.woff2", "fonts/thmanyahsans-Regular.woff2", "fonts/thmanyahserifdisplay-Bold.woff2", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "js/app.js", "js/dates.js", "js/db.js", "js/export/backup.js", "js/export/pdf.js", "js/export/pptx.js", "js/model.js", "js/names.js", "js/nav.js", "js/platform.js", "js/progress.js", "js/store.js", "js/theme.js", "js/tree/layout.js", "js/tree/measure.js", "js/tree/paper.js", "js/tree/render.js", "js/tree/themes.js", "js/ui/addKids.js", "js/ui/addSpouse.js", "js/ui/common.js", "js/ui/edit.js", "js/ui/families.js", "js/ui/familySheet.js", "js/ui/forms.js", "js/ui/help.js", "js/ui/kidsEditor.js", "js/ui/kit.js", "js/ui/newFamily.js", "js/ui/nextBar.js", "js/ui/person.js", "js/ui/personForm.js", "js/ui/search.js", "js/ui/settings.js", "js/ui/sortable.js", "js/ui/tree.js", "js/util.js", "js/version.js", "manifest.webmanifest", "vendor/jszip.min.js", "vendor/pptxgen.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
