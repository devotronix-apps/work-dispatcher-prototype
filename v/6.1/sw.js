/* RouteClerk prototype — offline copy. Network first (so a newly published version always shows), falling back to the saved copy
   when there is no connection or the network takes more than 3 seconds. */
const CACHE = 'wd-prototype-v23';
const FILES = ['./', 'index.html', 'css/ios.css', 'img/app-icon.png', 'js/core.js', 'js/data.js'].concat(
  ['auth', 'board', 'jobs', 'map', 'customers', 'shift', 'settings', 'billing', 'workflow', 'team', 'admin', 'extras', 'company', 'crm', 'ops', 'round8', 'round9', 'biz', 'round11', 'round11b', 'rc', 'rc-ops', 'rc-money', 'r13', 'r14', 'r14-calls', 'r14-crm', 'r14-ops', 'r14-price', 'r14-money', 'r15', 'bids', 'r16', 'r16-biz', 'r17', 'r17-eta', 'r18'].map(n => 'js/screens/' + n + '.js'));
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.cache === 'no-store' || req.cache === 'reload') return;   // update checks and forced refreshes always go to the network
  const saved = () => caches.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; });
  const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(saved);
  e.respondWith(Promise.race([fresh.catch(() => undefined), slow]).then(r => r || saved()).then(r => r || fresh));
});
