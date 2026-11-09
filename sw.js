// Service worker: menyimpan tampilan aplikasi agar tetap terbuka saat internet putus.
// Data pelamar tidak pernah disimpan di sini; permintaan ke Firebase selalu langsung ke server.
const CACHE = 'lowongan-kerja-v1';
const INTI = ['./', 'index.html', 'hr.html', 'style.css', 'app.js', 'portal.js', 'baca-cv.js', 'cloud.js', 'firebase-config.js', 'rekrutmen.js', 'screening.js', 'templat-lowongan.js', 'manifest.webmanifest', 'ikon-192.png', 'ikon-512.png'];
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LUAR = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  `${SDK}firebase-app.js`, `${SDK}firebase-firestore.js`, `${SDK}firebase-auth.js`, `${SDK}firebase-app-check.js`,
];
// Alamat luar berversi tetap, jadi aman disajikan dari simpanan.
const tetap = url => LUAR.includes(url);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Satu file yang belum terunggah tidak boleh menggagalkan seluruh pemasangan.
    await Promise.all(INTI.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null)));
    // Pustaka luar tidak wajib: kalau gagal, cukup diunduh saat pertama dipakai.
    await Promise.all(LUAR.map(u => fetch(new Request(u, { mode: 'cors' })).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (tetap(req.url)) {
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const salin = r.clone(); caches.open(CACHE).then(c => c.put(req.url, salin)); }
      return r;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // File aplikasi: ambil versi terbaru dari server, dan pakai simpanan hanya saat offline.
  e.respondWith(fetch(req).then(r => {
    if (r.ok && r.type === 'basic') { const salin = r.clone(); caches.open(CACHE).then(c => c.put(req, salin)); }
    return r;
  }).catch(async () => (await caches.match(req, { ignoreSearch: true }))
    || (req.mode === 'navigate' ? caches.match(url.pathname.endsWith('hr.html') ? 'hr.html' : 'index.html') : Response.error())));
});
