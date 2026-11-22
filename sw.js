const CACHE_VERSION = 'tree-risk-assess-v0.3.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon_tree-risk.jpg'
];

// インストール時：ブラウザのHTTPキャッシュを無視して最新版を取得し即待機解除
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        const req = new Request(url, { cache: 'reload' });
        const res = await fetch(req);
        if (res.ok) await cache.put(url, res);
      }
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時：現行バージョン以外の全キャッシュを完全削除し即制御奪取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ時：Network First（オンラインは常に最新取得＆キャッシュ更新、オフラインのみキャッシュ返却）
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(new Request(req, { cache: 'no-store' }))
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// クライアントからの強制リセット・即時更新命令
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'NUKE_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});
