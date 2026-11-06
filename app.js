// Tampilan dan alur kerja aplikasi lowongan. Aturan penilaian ada di screening.js,
// aturan tahapan dan pengumuman ada di rekrutmen.js.
(function () {
  'use strict';
  const S = window.Screening, R = window.Rekrutmen, C = window.Cloud, TL = window.TemplatLowongan;
  const $ = id => document.getElementById(id);
  const app = $('app');

  const REC = { lolos: 'Lolos', pertimbangkan: 'Pertimbangkan', cek: 'Perlu cek manual', tidak: 'Tidak lolos' };
  const MARK = { ok: 'Terpenuhi', partial: 'Sebagian', no: 'Tidak', unknown: 'Tidak terbaca' };
  const TABS = [['ringkasan', 'Ringkasan'], ['ketentuan', 'Ketentuan'], ['kandidat', 'Kandidat'], ['tahapan', 'Tahapan'], ['pengumuman', 'Pengumuman']];

  const FIELDS = [
    { k: 'pendidikan', label: 'Pendidikan minimal', type: 'level', wajib: true },
    { k: 'jurusan', label: 'Jurusan', type: 'items', sub: 'items', wajib: true, hint: 'Pisahkan dengan koma. Cukup cocok satu.', ph: 'Teknik Sipil, Arsitektur' },
    { k: 'ipk', label: 'IPK minimal', type: 'number', sub: 'min', step: '0.01', max: 4, wajib: true, ph: '3.00' },
    { k: 'pengalaman', label: 'Pengalaman minimal (tahun)', type: 'number', sub: 'tahun', step: '0.5', wajib: true, ph: '3' },
    { k: 'keahlian', label: 'Keahlian', type: 'items', sub: 'items', wajib: true, hint: 'Pisahkan dengan koma. Bila wajib, semuanya harus ada. Pakai garis miring untuk pilihan setara, misalnya Excel / Spreadsheet.', ph: 'AutoCAD, Microsoft Excel' },
    { k: 'nilaiTambah', label: 'Nilai tambah', type: 'items', sub: 'items', wajib: false, hint: 'Menambah skor, tidak menggugurkan.', ph: 'Primavera, Bahasa Inggris' },
    { k: 'sertifikasi', label: 'Sertifikasi', type: 'items', sub: 'items', wajib: true, hint: 'Pisahkan dengan koma. Cukup cocok satu.', ph: 'SKA, SKK, PMP' },
    { k: 'lokasi', label: 'Lokasi', type: 'items', sub: 'items', wajib: true, hint: 'Pisahkan dengan koma. Cukup cocok satu.', ph: 'Jakarta, Bekasi' },
  ];

  let db = { lowongan: [], kandidat: [] };
  let view = { id: null, tab: 'kandidat', tahapId: null };
  let filter = 'semua', query = '';
  const openIds = new Set();
  const factsCache = new Map();

  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const current = () => db.lowongan.find(l => l.id === view.id) || null;
  const pelamar = id => db.kandidat.filter(k => k.lowonganId === id);

  function showBanner(text) {
    const b = $('banner');
    b.hidden = !text;
    b.textContent = text || '';
  }

  // ---- Penyimpanan ----
  function openDb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('lowongan-kerja', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('data');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function loadDb() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const q = d.transaction('data').objectStore('data').get('db');
      q.onsuccess = () => resolve(q.result || null);
      q.onerror = () => reject(q.error);
    });
  }
  async function writeDb() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('data', 'readwrite');
      t.objectStore('data').put(JSON.parse(JSON.stringify(db)), 'db');
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
  // Mode online: hanya dokumen yang berubah sejak sinkron terakhir yang ditulis ke server.
  let cloudOn = false, snapshot = new Map();
  const remember = docs => { snapshot = new Map([...docs].map(([p, v]) => [p, JSON.stringify(v)])); };

  async function syncCloud() {
    const next = R.docsFromDb(db), sets = [], dels = [];
    // Hanya kolom yang berubah: CV tidak dikirim ulang, dan kolom yang diubah HR lain tidak tertimpa.
    next.forEach((v, p) => {
      const lama = snapshot.get(p);
      if (lama === JSON.stringify(v)) return;
      if (lama === undefined) { sets.push([p, v]); return; }
      const o = JSON.parse(lama), beda = {};
      Object.keys(v).forEach(f => { if (JSON.stringify(v[f]) !== JSON.stringify(o[f])) beda[f] = v[f]; });
      sets.push([p, beda]);
    });
    snapshot.forEach((old, p) => { if (!next.has(p)) dels.push(p, ...R.followDeletes(p, old)); });
    if (!sets.length && !dels.length) return;
    await C.apply(sets, dels);
    remember(next);
    showBanner('');
  }

  let saveTimer = null;
  const flush = () => {
    saveTimer = null;
    return cloudOn
      ? syncCloud().then(() => { setSync('Tersimpan'); return true; }).catch(() => {
        // Perubahan tetap di memori dan dicoba lagi; peringatan saat keluar juga tetap aktif.
        setSync('Belum tersimpan, mencoba lagi');
        showBanner('Perubahan belum tersimpan ke server. Aplikasi mencoba lagi otomatis. Jangan tutup halaman ini.');
        saveTimer = setTimeout(flush, 10000);
        return false;
      })
      : writeDb().then(() => setSync('Tersimpan')).catch(() => { setSync('Belum tersimpan'); showBanner('Data gagal tersimpan di browser ini. Unduh cadangan agar pekerjaan tidak hilang.'); });
  };
  // Status tampil sebagai lencana di samping posisi; #sync tetap menjadi pengumuman untuk pembaca layar.
  let statusSimpan = 'Tersimpan';
  const jenisSimpan = t => (/^Menyimpan/.test(t) ? 'jalan' : /^Belum/.test(t) ? 'gagal' : 'ok');
  const setSync = text => {
    statusSimpan = text;
    const s = $('sync'), p = $('simpan');
    if (s) s.textContent = text;
    if (p) { p.dataset.s = jenisSimpan(text); p.textContent = text.split(',')[0]; }
    // Kabar sekali lewat tidak menetap, lencana kembali ke keadaan sebenarnya.
    if (jenisSimpan(text) === 'ok' && text !== 'Tersimpan') setTimeout(() => { if (statusSimpan === text) setSync('Tersimpan'); }, 3000);
  };
  function save() {
    clearTimeout(saveTimer);
    setSync('Menyimpan...');
    saveTimer = setTimeout(flush, cloudOn ? 1200 : 200);
  }

  // ---- Penilaian ----
  function factsOf(k) {
    if (k.text === undefined || k.text === null) return null;
    if (!factsCache.has(k.id)) {
      const f = S.extractFacts(k.text, k.fileName);
      // Data yang diketik pelamar di formulir lebih bisa dipercaya daripada hasil baca CV.
      factsCache.set(k.id, { ...f, name: k.nama || f.name, email: k.email || f.email, phone: k.telepon || f.phone });
    }
    return factsCache.get(k.id);
  }
  const namaOf = k => { const f = factsOf(k); return f ? f.name : k.fileName; };
  // Hasil penilaian disimpan selama CV dan ketentuan tidak berubah, agar daftar tetap cepat untuk ratusan pelamar.
  const resCache = new Map();
  const resultOf = (k, l) => {
    const f = factsOf(k);
    if (!f || k.error) return null;
    const id = `${k.id}:${l.id}`, key = JSON.stringify(l.criteria), c = resCache.get(id);
    if (c && c.key === key && c.f === f) return c.r;
    const r = S.evaluate(f, l.criteria);
    resCache.set(id, { key, f, r });
    return r;
  };
  const recOf = (k, l) => { if (k.error) return 'cek'; const r = resultOf(k, l); return (r && r.rekomendasi) || null; };

  function sortedCandidates(l) {
    return pelamar(l.id).map(k => {
      const r = resultOf(k, l);
      return { k, rank: S.RANK[recOf(k, l)], score: r && r.score !== null ? r.score : -1 };
    }).sort((a, b) => (a.rank === undefined ? 9 : a.rank) - (b.rank === undefined ? 9 : b.rank) || b.score - a.score || String(a.k.nomor || '').localeCompare(String(b.k.nomor || ''))).map(x => x.k);
  }

  const hariIni = () => new Date().toLocaleDateString('en-CA'); // format YYYY-MM-DD pada zona waktu perangkat

  function cekMasaSimpan() {
    const n = db.lowongan.filter(l => R.lewatMasaSimpan(l, hariIni())).length;
    if (n) showBanner(`${n} lowongan sudah melewati tanggal hapus data. Buka lowongannya dan hapus data pelamarnya.`);
  }

  // ---- Beranda ----
  const HR_MENU = [['dasbor', 'Dasbor rekrutmen'], ['lowongan', 'Lowongan'], ['pool', 'Talent pool']];
  const STATUS_L = { buka: 'Dibuka', tutup: 'Ditutup', draf: 'Draf' };
  const badgeL = l => (l.contoh ? '<span class="badge b-cek">Contoh</span>' : `<span class="badge ${l.status === 'buka' ? 'b-lolos' : 'b-none'}">${STATUS_L[l.status] || 'Dibuka'}</span>`);
  const kpi = (cls, rows) => `<div class="kpi ${cls}">${rows.map(([n, label]) => `<div><b>${esc(n)}</b><span>${esc(label)}</span></div>`).join('')}</div>`;
  const stat = l => { const list = pelamar(l.id), st = list.map(k => R.progress(k, l.tahapan).state), n = s => st.filter(x => x === s).length; return { list, total: list.length, proses: n('proses'), lolos: n('lolos'), gugur: n('gugur') }; };

  // Batang satu warna: panjang menunjukkan jumlah, angka dan label selalu tertulis.
  function bars(rows, kosong, tampilNol) {
    if (!tampilNol && !rows.some(r => r.n)) return `<p class="note">${esc(kosong)}</p>`;
    const max = Math.max(1, ...rows.map(r => r.n));
    return `<ul class="bars">${rows.map(r => `<li title="${esc(r.label)}: ${r.n}"><span class="bl">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="bt"><i style="width:${Math.round(r.n / max * 100)}%"></i></span><b>${r.n}</b></li>`).join('')}</ul>`;
  }

  function tindakan() {
    const out = [];
    db.lowongan.forEach(l => {
      const f = R.funnel(pelamar(l.id), l.tahapan).reduce((a, r) => a + r.menunggu, 0);
      if (R.lewatMasaSimpan(l, hariIni())) out.push([l, 'Masa simpan data habis. Hapus data pelamarnya.']);
      if (f) out.push([l, `${f} peserta menunggu keputusan.`]);
      const belum = R.kabarPelamar(l, pelamar(l.id)).tertunda;
      if (belum) out.push([l, `${belum} peserta sudah diputuskan, tetapi hasilnya belum diterbitkan.`]);
      if (l.status === 'draf') out.push([l, 'Masih draf dan belum tampil di portal.']);
      if (l.status === 'buka' && !(l.perusahaan && l.kontak && l.retensi)) out.push([l, 'Dibuka, tetapi info wajib belum lengkap sehingga formulir tertutup.']);
    });
    return out;
  }

  function pengalamanHtml(k) {
    return `<section class="panel"><h3>Pengalaman kandidat</h3><p class="hint">Semua pelamar perlu menerima kabar, termasuk yang tidak diterima.</p>
      ${bars([{ label: 'Sudah menerima kabar', n: k.dikabari }, { label: 'Diputuskan, belum dikabarkan', n: k.tertunda }, { label: 'Belum diputuskan', n: k.menunggu }], 'Belum ada pelamar.')}</section>`;
  }

  function dasborHtml() {
    const ls = db.lowongan, ks = ls.flatMap(l => pelamar(l.id).map(k => [k, l]));
    const st = ks.map(([k, l]) => R.progress(k, l.tahapan).state), n = s => st.filter(x => x === s).length;
    const tahap = new Map();
    ls.forEach(l => R.funnel(pelamar(l.id), l.tahapan).forEach(r => {
      const x = tahap.get(r.tahap.nama) || { label: r.tahap.nama, n: 0, lolos: 0, tidak: 0, menunggu: 0 };
      x.n += r.sampai; x.lolos += r.lolos; x.tidak += r.tidak; x.menunggu += r.menunggu;
      tahap.set(r.tahap.nama, x);
    }));
    const saringan = [...tahap.values()].filter(x => x.n).map(x => ({ ...x, sub: `Lolos ${x.lolos} · Tidak ${x.tidak} · Menunggu ${x.menunggu}` }));
    const rek = Object.keys(REC).map(k => ({ label: REC[k], n: ks.filter(([c, l]) => recOf(c, l) === k).length }));
    const todo = tindakan();
    const kabar = ls.map(l => R.kabarPelamar(l, pelamar(l.id))).reduce((a, x) => ({ dikabari: a.dikabari + x.dikabari, tertunda: a.tertunda + x.tertunda, menunggu: a.menunggu + x.menunggu }), { dikabari: 0, tertunda: 0, menunggu: 0 });
    return `<div class="stack"><div class="page-head"><h2>Dasbor rekrutmen</h2><button type="button" data-act="page" data-p="lowongan">Buat lowongan</button></div>
      ${kpi('k6', [[ls.filter(l => l.status === 'buka').length, 'Lowongan dibuka'], [ls.filter(l => l.status === 'draf').length, 'Draf'], [ks.length, 'Total pelamar'], [n('proses'), 'Dalam proses'], [n('lolos'), 'Lolos semua tahap'], [ks.filter(([k]) => k.talentPool).length, 'Talent pool']])}
      <div class="grid2"><section class="panel"><h3>Saringan rekrutmen</h3>${bars(saringan, 'Belum ada pelamar pada tahap mana pun.')}</section>
      <section class="panel"><h3>Rekomendasi screening</h3>${bars(rek, 'Belum ada CV yang dinilai.')}</section></div>
      ${pengalamanHtml(kabar)}
      <section class="panel"><h3>Perlu tindakan</h3>${todo.length ? `<ul class="rows">${todo.slice(0, 8).map(([l, t]) => `<li><button type="button" class="row" data-act="open" data-id="${esc(l.id)}"><strong>${esc(l.judul)}</strong><span>${esc(t)}</span></button></li>`).join('')}</ul>${todo.length > 8 ? `<p class="note">Dan ${todo.length - 8} hal lainnya.</p>` : ''}` : '<p class="note">Tidak ada yang perlu ditindaklanjuti.</p>'}</section>
      <section class="panel"><h3>Lowongan</h3>${ls.length ? `<ul class="rows">${ls.map(l => { const s = stat(l); return `<li><button type="button" class="row" data-act="open" data-id="${esc(l.id)}"><strong>${esc(l.judul)}</strong><span>${s.total} pelamar · ${s.proses} proses · ${s.lolos} lolos · ${s.gugur} tidak lolos</span>${badgeL(l)}</button></li>`; }).join('')}</ul>` : '<p class="note">Belum ada lowongan.</p>'}</section></div>`;
  }

  function lowonganHtml() {
    const cards = db.lowongan.map(l => {
      const s = stat(l);
      return `<div class="job-w"><button type="button" class="job" data-act="open" data-id="${esc(l.id)}">
        <span class="job-head"><strong>${esc(l.judul)}</strong>${badgeL(l)}</span>
        ${R.lewatMasaSimpan(l, hariIni()) ? '<span class="badge b-tidak">Masa simpan habis, hapus datanya</span>' : ''}
        <small>${esc([l.perusahaan, l.lokasiKerja].filter(Boolean).join(' · ') || 'Lengkapi info lowongan')}${l.tenggat ? ` · Tenggat ${esc(R.tanggalId(l.tenggat))}` : ''}</small>
        <span class="stats"><span><b>${s.total}</b> pelamar</span><span><b>${s.proses}</b> dalam proses</span><span><b>${s.lolos}</b> lolos</span><span><b>${s.gugur}</b> tidak lolos</span></span>
      </button><button type="button" class="ghost danger job-del" data-act="del-job" data-id="${esc(l.id)}" aria-label="Hapus lowongan ${esc(l.judul)}">Hapus</button></div>`;
    }).join('');
    return `<div class="stack"><h2>Lowongan</h2>
      <form class="new-job cta-form" data-form="new">
        <label for="new-judul">Tulis posisi yang dicari</label>
        <p class="note">Syarat dan ketentuan tersusun otomatis dari posisi ini, lalu Anda menambah atau mengurangi.</p>
        <div class="inline"><input id="new-judul" type="text" list="w-daftar" placeholder="Misalnya Senior Site Engineer" required><datalist id="w-daftar">${TL.SEMUA.map(t => `<option value="${esc(t.nama)}"></option>`).join('')}</datalist><button type="submit">Buat syarat otomatis</button><button type="button" class="ghost" data-act="sample">Buat contoh lowongan</button></div>
      </form>
      <div class="jobs">${cards || '<div class="empty">Belum ada lowongan. Tulis posisi di atas untuk memulai.</div>'}</div></div>`;
  }

  // ---- Talent pool: hanya pelamar yang menyetujui ----
  const anggotaPool = () => db.kandidat.filter(k => k.talentPool && db.lowongan.some(l => l.id === k.lowonganId));

  function poolHtml() {
    const p = view.pool = view.pool || { q: '', lv: '', th: '', l: '' };
    return `<div class="stack"><div class="page-head"><h2>Talent pool</h2><button type="button" class="ghost" data-act="pool-csv">Unduh CSV</button></div>
      <p class="note">Berisi pelamar yang menyetujui ditawari lowongan lain. Masa simpan mengikuti persetujuan mereka, dan data terhapus bersama lowongan asalnya.</p>
      <div id="pool-ring"></div>
      <section class="panel"><h3>Cari dan cocokkan</h3><div class="filters4">
        <div><label for="p-q">Kata kunci di CV</label><input id="p-q" type="search" value="${esc(p.q)}" data-pool="q" placeholder="AutoCAD, Teknik Sipil"></div>
        <div><label for="p-lv">Pendidikan minimal</label><select id="p-lv" data-pool="lv"><option value="">Semua</option>${S.LEVELS.map(x => `<option value="${x.k}"${p.lv === x.k ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
        <div><label for="p-th">Pengalaman minimal (tahun)</label><input id="p-th" type="number" min="0" value="${esc(p.th)}" data-pool="th"></div>
        <div><label for="p-l">Cocokkan dengan lowongan</label><select id="p-l" data-pool="l"><option value="">Tidak dicocokkan</option>${db.lowongan.map(l => `<option value="${esc(l.id)}"${p.l === l.id ? ' selected' : ''}>${esc(l.judul)}</option>`).join('')}</select></div>
      </div></section>
      <p id="copy-note" class="note" role="status" hidden></p>
      <div id="pool-list" class="stack"></div></div>`;
  }

  function poolHasil() {
    const p = view.pool, q = p.q.trim().toLowerCase(), need = S.levelOf(p.lv), th = +p.th || 0, target = db.lowongan.find(l => l.id === p.l);
    const rows = anggotaPool().map(k => {
      const f = factsOf(k) || { exp: { years: null } };
      const skor = target ? resultOf(k, target) : null;
      return { k, f, skor };
    }).filter(({ k, f }) => {
      const lvl = S.levelOf(f.level);
      return (!q || String(k.text || '').toLowerCase().includes(q)) && (!need || (lvl && lvl.rank >= need.rank)) && (!th || (f.exp.years || 0) >= th);
    });
    if (target) rows.sort((a, b) => ((b.skor && b.skor.score) || 0) - ((a.skor && a.skor.score) || 0));
    return rows;
  }

  function renderPool() {
    const box = $('pool-list');
    if (!box) return;
    const semua = anggotaPool(), rows = poolHasil(), fs = semua.map(factsOf).filter(Boolean);
    const lv = S.LEVELS.slice().reverse().map(x => ({ label: x.label, n: fs.filter(f => f.level === x.k).length }));
    const band = [['0-2 tahun', 0, 2], ['3-5 tahun', 2.01, 5], ['6-10 tahun', 5.01, 10], ['Di atas 10 tahun', 10.01, 99]].map(([label, a, b]) => ({ label, n: fs.filter(f => f.exp.years !== null && f.exp.years >= a && f.exp.years <= b).length }));
    const yrs = fs.map(f => f.exp.years).filter(y => y !== null);
    $('pool-ring').innerHTML = `${kpi('k3', [[semua.length, 'Anggota talent pool'], [yrs.length ? S.idn(Math.round(yrs.reduce((a, b) => a + b, 0) / yrs.length * 10) / 10) : '-', 'Rata-rata pengalaman (tahun)'], [rows.length, 'Sesuai saringan']])}
      <div class="grid2 mt"><section class="panel"><h3>Pendidikan</h3>${bars(lv, 'Belum ada anggota.')}</section><section class="panel"><h3>Pengalaman</h3>${bars(band, 'Belum ada anggota.')}</section></div>`;
    box.innerHTML = rows.length ? rows.map(({ k, f, skor }) => {
      const asal = db.lowongan.find(l => l.id === k.lowonganId), lvl = S.levelOf(f.level);
      return `<article class="pool-row"><div class="who"><strong>${esc(namaOf(k))}</strong><small>${esc(k.nomor)} · Melamar ${esc(asal.judul)} · ${esc(R.progressLabel(R.progress(k, asal.tahapan)))}</small><small>${esc([lvl && lvl.label, f.exp.years !== null && f.exp.years !== undefined ? `Sekitar ${S.idn(f.exp.years)} tahun` : ''].filter(Boolean).join(' · '))}</small></div>
        ${skor && skor.rekomendasi ? `<div class="pool-skor"><b>${skor.score}</b><span class="badge b-${skor.rekomendasi}">${REC[skor.rekomendasi]}</span></div>` : ''}
        <div class="inline">${f.email ? `<button type="button" class="ghost" data-act="pool-copy" data-v="${esc(f.email)}">Salin email</button>` : ''}<button type="button" class="ghost danger" data-act="pool-out" data-id="${esc(k.id)}">Keluarkan</button></div></article>`;
    }).join('') : `<div class="empty">${semua.length ? 'Tidak ada anggota yang cocok dengan saringan ini.' : 'Belum ada pelamar yang menyetujui talent pool. Pilihan ini ada di formulir lamaran.'}</div>`;
  }

  function homeHtml() {
    const page = view.page || 'dasbor';
    return `<div class="shell"><aside class="side noprint"><nav class="tabs" aria-label="Menu HR">${HR_MENU.map(([k, label]) => `<button type="button" data-act="page" data-p="${k}"${page === k ? ' aria-current="page"' : ''}>${label}</button>`).join('')}</nav></aside>
      <div id="tab-body">${({ dasbor: dasborHtml, lowongan: lowonganHtml, pool: poolHtml })[page]()}</div></div>`;
  }

  // ---- Halaman lowongan ----
  function detailHtml(l) {
    return `<div class="shell"><aside class="side noprint">
      <button type="button" class="back" data-act="home" data-p="lowongan">Semua lowongan</button>
      <div class="detail-head"><div class="detail-top"><h2>${esc(l.judul)}</h2><span id="simpan" class="simpan" data-s="${jenisSimpan(statusSimpan)}" aria-hidden="true">${esc(statusSimpan.split(',')[0])}</span></div><span id="head-count" class="note">${pelamar(l.id).length} pelamar</span></div>
      <nav class="tabs" aria-label="Bagian lowongan">${TABS.map(([k, label]) => `<button type="button" data-act="tab" data-tab="${k}"${view.tab === k ? ' aria-current="page"' : ''}>${label}</button>`).join('')}<button type="button" class="danger" data-act="del-job" data-id="${esc(l.id)}">Hapus lowongan</button></nav>
    </aside>
    <div id="tab-body">${({ ringkasan: ringkasanHtml, ketentuan: ketentuanHtml, kandidat: kandidatHtml, tahapan: tahapanHtml, pengumuman: pengumumanHtml })[view.tab](l)}</div></div>`;
  }

  function fieldHtml(l, f) {
    const c = l.criteria[f.k], id = 'f-' + f.k;
    let input;
    if (f.type === 'level') {
      input = `<select id="${id}" data-c="${f.k}" data-p="level"><option value="">Tidak disyaratkan</option>${S.LEVELS.map(x => `<option value="${x.k}"${c.level === x.k ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
    } else if (f.type === 'number') {
      input = `<input id="${id}" type="number" min="0" ${f.max ? `max="${f.max}"` : ''} step="${f.step}" placeholder="${esc(f.ph)}" value="${esc(c[f.sub])}" data-c="${f.k}" data-p="${f.sub}">`;
    } else {
      input = `<input id="${id}" type="text" placeholder="${esc(f.ph)}" value="${esc(c[f.sub])}" data-c="${f.k}" data-p="${f.sub}">`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}
      ${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}
      <div class="opts">${f.wajib ? `<label><input type="checkbox" data-c="${f.k}" data-p="wajib"${c.wajib ? ' checked' : ''}> Wajib</label>` : ''}
      <label>Bobot <input type="number" min="0" max="100" value="${esc(c.bobot)}" data-c="${f.k}" data-p="bobot" aria-label="Bobot ${esc(f.label)}"></label></div></div>`;
  }

  function customHtml(t, i) {
    return `<div class="field"><div class="custom-head">
        <input type="text" placeholder="Nama ketentuan" value="${esc(t.label)}" data-x="${i}" data-p="label" aria-label="Nama ketentuan tambahan">
        <button type="button" class="ghost" data-act="custom-del" data-i="${i}">Hapus</button></div>
      <input type="text" placeholder="Kata yang dicari, pisahkan dengan koma" value="${esc(t.kata)}" data-x="${i}" data-p="kata" aria-label="Kata yang dicari">
      <div class="opts"><label><input type="checkbox" data-x="${i}" data-p="wajib"${t.wajib ? ' checked' : ''}> Wajib</label>
      <label>Bobot <input type="number" min="0" max="100" value="${esc(t.bobot)}" data-x="${i}" data-p="bobot" aria-label="Bobot ketentuan tambahan"></label></div></div>`;
  }

  function ketentuanHtml(l) {
    const c = l.criteria;
    return `<div class="two">
      <section class="panel"><h3>Info lowongan</h3>
        <div class="field"><label for="i-judul">Nama posisi</label><input id="i-judul" type="text" value="${esc(l.judul)}" data-l="judul"></div>
        <div class="field"><label for="i-perusahaan">Perusahaan</label><input id="i-perusahaan" type="text" value="${esc(l.perusahaan)}" data-l="perusahaan"></div>
        ${logoField('i-logo', l.logo, l.perusahaan)}
        <div class="field"><label for="i-lokasi">Lokasi kerja</label><input id="i-lokasi" type="text" value="${esc(l.lokasiKerja)}" data-l="lokasiKerja"></div>
        <div class="field"><label for="i-tenggat">Tenggat lamaran</label><input id="i-tenggat" type="date" value="${esc(l.tenggat)}" data-l="tenggat"></div>
        <div class="field"><label for="i-status">Status</label><select id="i-status" data-l="status"><option value="draf"${l.status === 'draf' ? ' selected' : ''}>Draf (belum tampil di portal)</option><option value="buka"${l.status === 'buka' ? ' selected' : ''}>Dibuka</option><option value="tutup"${l.status === 'tutup' ? ' selected' : ''}>Ditutup</option></select></div>
        <div class="field"><label for="i-tentang">Tentang perusahaan</label><textarea id="i-tentang" rows="3" placeholder="Bidang usaha dan gambaran singkat lingkungan kerja" data-l="tentang">${esc(l.tentang)}</textarea></div>
        <div class="field"><label for="i-desk">Deskripsi pekerjaan</label><textarea id="i-desk" rows="4" data-l="deskripsi">${esc(l.deskripsi)}</textarea></div>
        <div class="field"><label for="i-komp">Waktu kerja, gaji, dan benefit (opsional)</label><textarea id="i-komp" rows="3" placeholder="Isi sejauh perusahaan bersedia menyampaikannya" data-l="kompensasi">${esc(l.kompensasi)}</textarea><span class="hint">Tampil di portal pelamar.</span></div>
        <div class="field"><label for="paste">Persyaratan</label>
          <textarea id="paste" rows="6" data-l="persyaratan" placeholder="Satu syarat per baris.&#10;Minimal S1 jurusan Teknik Sipil&#10;Pengalaman minimal 3 tahun&#10;Menguasai AutoCAD, Excel">${esc(l.persyaratan)}</textarea>
          <span class="hint">Tampil di portal pelamar.</span>
          <div class="inline"><button type="button" data-act="wz-from">Buat otomatis dari posisi</button><button type="button" class="ghost" data-act="parse">Isi ketentuan dari persyaratan</button></div><p id="parse-note" class="note" hidden></p></div>
        ${cloudOn ? `<div class="field"><label for="i-kontak">Kontak permintaan data pelamar</label><input id="i-kontak" type="text" value="${esc(l.kontak)}" placeholder="Email HR" data-l="kontak">
          <label for="i-retensi">Masa simpan data pelamar</label><input id="i-retensi" type="text" value="${esc(l.retensi)}" placeholder="6 bulan setelah seleksi selesai" data-l="retensi">
          <label for="i-hapus">Tanggal hapus data</label><input id="i-hapus" type="date" value="${esc(l.hapusPada)}" data-l="hapusPada">
          <span class="hint">Perusahaan, kontak, dan masa simpan wajib diisi. Tanpa itu pelamar belum bisa melamar.</span></div>` : ''}
        <fieldset class="wz-g"><legend>Permintaan rekrutmen (internal)</legend>
          <div class="field-2"><div class="field"><label for="i-jenis">Jenis kebutuhan</label><select id="i-jenis" data-l="permintaanJenis">${[['', 'Pilih'], ['pengganti', 'Mengisi posisi yang kosong'], ['baru', 'Posisi baru'], ['banyak', 'Banyak posisi sekaligus']].map(([v, t]) => `<option value="${v}"${(l.permintaanJenis || '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label for="i-minta">Nomor permintaan</label><input id="i-minta" type="text" maxlength="60" value="${esc(l.permintaanNomor)}" placeholder="FPTK-001/XI/2026" data-l="permintaanNomor"></div>
          <div class="field"><label for="i-unit">Unit pemohon</label><input id="i-unit" type="text" maxlength="100" value="${esc(l.permintaanUnit)}" data-l="permintaanUnit"></div>
          <div class="field"><label for="i-jumlah">Jumlah posisi</label><input id="i-jumlah" type="number" min="1" max="999" value="${esc(l.permintaanJumlah)}" data-l="permintaanJumlah"></div>
          <div class="field"><label for="i-mulai">Tanggal permintaan</label><input id="i-mulai" type="date" value="${esc(l.permintaanTanggal)}" data-l="permintaanTanggal"></div>
          <div class="field"><label for="i-terisi">Tanggal posisi terisi</label><input id="i-terisi" type="date" value="${esc(l.terisiTanggal)}" data-l="terisiTanggal"></div></div>
          <div class="field"><label for="i-saluran">Saluran rekrutmen</label><input id="i-saluran" type="text" maxlength="200" value="${esc(l.saluran)}" placeholder="Contoh: portal ini, LinkedIn, referensi karyawan" data-l="saluran"></div>
          <span class="hint">Hanya untuk tim HR, tidak tampil di portal.</span>
        </fieldset>
      </section>
      <section class="panel"><h3>Ketentuan screening</h3>
        <div id="criteria">${FIELDS.map(f => fieldHtml(l, f)).join('')}${c.tambahan.map(customHtml).join('')}
          <div class="field"><label for="f-ambang">Ambang skor lolos</label><input id="f-ambang" type="number" min="0" max="100" value="${esc(c.ambang)}" data-root="ambang"><span class="hint">Skor sampai 20 poin di bawah ambang masuk Pertimbangkan.</span></div></div>
        <button type="button" class="ghost start" data-act="custom-add">Tambah ketentuan lain</button>
        <p id="warn" class="warn" hidden></p>
      </section></div>`;
  }

  function updateWarning(l) {
    const box = $('warn');
    if (!box) return;
    const c = l.criteria;
    const hit = [l.persyaratan, c.keahlian.items, c.nilaiTambah.items, c.sertifikasi.items].concat(c.tambahan.map(t => `${t.label} ${t.kata}`)).map(S.findProtected).find(Boolean);
    box.hidden = !hit;
    if (hit) box.textContent = `Ketentuan memuat "${hit}". Menyaring pelamar berdasarkan ciri pribadi berisiko diskriminatif, kecuali memang disyaratkan pekerjaannya. Tinjau lagi sebelum dipakai.`;
  }

  function applyParsed(l) {
    const p = S.parseKetentuan($('paste').value), c = l.criteria;
    if (p.level) c.pendidikan.level = p.level;
    if (p.tahun) c.pengalaman.tahun = p.tahun;
    if (p.ipk) c.ipk.min = p.ipk;
    ['jurusan', 'keahlian', 'nilaiTambah', 'sertifikasi', 'lokasi'].forEach(k => { if (p[k].length) c[k].items = p[k].join(', '); });
    save();
    render();
    const filled = [p.level, p.tahun, p.ipk].filter(Boolean).length + ['jurusan', 'keahlian', 'nilaiTambah', 'sertifikasi', 'lokasi'].filter(k => p[k].length).length;
    const note = $('parse-note');
    note.hidden = false;
    note.textContent = (filled ? `${filled} ketentuan terisi. Periksa kembali hasilnya.` : 'Tidak ada ketentuan yang dikenali. Isi formulir secara manual.') +
      (p.diabaikan.length ? ` Tidak dipakai karena menyangkut ciri pribadi: ${p.diabaikan.join('; ')}.` : '');
  }

  // ---- Tab kandidat ----
  function kandidatHtml(l) {
    return `<div class="stack">
      <div id="drop" class="drop" tabindex="0" role="button" aria-label="Unggah file CV">
        <strong>Tarik file CV ke sini, atau klik untuk memilih</strong>
        <span>PDF, DOCX, atau TXT. Bisa banyak file sekaligus.</span>
        <input id="file" type="file" multiple accept=".pdf,.docx,.txt" hidden>
      </div>
      <div class="result-head"><h3>Hasil screening</h3><button type="button" class="ghost" data-act="csv"${pelamar(l.id).length ? '' : ' disabled'}>Unduh CSV</button></div>
      <div id="filters" class="filters" role="group" aria-label="Saring rekomendasi"></div>
      <input id="search" type="search" class="search" placeholder="Cari nama atau kata di CV" aria-label="Cari kandidat" value="${esc(query)}">
      <p id="progress" class="note" role="status" hidden></p>
      <div id="list" class="list"></div>
      <p class="disclaimer">Skor adalah rekomendasi awal dari pencocokan teks, bukan keputusan. Periksa bukti pada tiap kandidat sebelum menentukan hasil di tab Tahapan.</p>
    </div>`;
  }

  function factsHtml(f) {
    if (!f) return '';
    const lvl = S.levelOf(f.level);
    const cell = (k, v) => `<div><b>${k}</b><span>${esc(v || 'Tidak terbaca')}</span></div>`;
    return `<div class="facts">${cell('Email', f.email)}${cell('Telepon', f.phone)}${cell('Pendidikan', lvl && lvl.label)}${cell('IPK', f.ipk === null ? '' : S.idn(f.ipk, 2))}${cell('Pengalaman', f.exp.years === null ? '' : `Sekitar ${S.idn(f.exp.years)} tahun`)}</div>`;
  }

  function checkHtml(x) {
    const bukti = x.bukti.slice(0, 4).map(b => `<span class="bukti">"${esc(b.snippet)}"</span>`).join('');
    return `<li><span class="mark m-${x.status}">${MARK[x.status]}</span><div><strong>${esc(x.label)}</strong>${x.wajib ? '<span class="tag">wajib</span>' : ''}<span class="tag">bobot ${esc(x.bobot)}</span><br>${esc(x.detail)}${bukti}</div></li>`;
  }

  function cardHtml(k, i, l) {
    const rec = recOf(k, l), r = resultOf(k, l), f = factsOf(k);
    const score = r && r.score !== null ? r.score : null;
    const alasan = k.error ? [k.error] : (r ? r.alasan : []);
    return `<details class="card" data-id="${esc(k.id)}"${openIds.has(k.id) ? ' open' : ''}>
      <summary>
        <span class="rank">${i + 1}</span>
        <span class="who"><strong>${esc(namaOf(k))}</strong><small>${esc(k.nomor)} · ${esc(R.progressLabel(R.progress(k, l.tahapan)))}${k.talentPool ? ' · Setuju talent pool' : ''}</small></span>
        <span class="score"><span>${score === null ? '-' : score}</span><span class="bar"><i style="width:${score === null ? 0 : score}%"></i></span></span>
        ${rec ? `<span class="badge b-${rec}">${REC[rec]}</span>` : '<span class="badge b-none">Belum dinilai</span>'}
      </summary>
      <div class="detail">
        ${r && r.peringatan ? `<p class="warn">${esc(r.peringatan)}</p>` : ''}
        ${alasan.length ? `<div class="reason"><strong>Alasan</strong><ul>${alasan.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
        ${factsHtml(f)}
        ${r && r.checks.length ? `<ul class="checks">${r.checks.map(checkHtml).join('')}</ul>` : ''}
        ${f && f.email && pelamar(l.id).some(x => x !== k && factsOf(x) && factsOf(x).email.toLowerCase() === f.email.toLowerCase()) ? '<p class="warn">Email ini dipakai lebih dari satu lamaran pada lowongan ini.</p>' : ''}
        <div class="actions"><span class="note">File: ${esc(k.fileName)}${cloudOn ? ` · Kode cek hasil: ${esc(R.tampilKode(k.id))}` : ''}</span><button type="button" class="ghost" data-act="rm" data-id="${esc(k.id)}">Hapus pelamar ini</button></div>
        <div class="field"><label for="n-${esc(k.id)}">Catatan penilaian</label><textarea id="n-${esc(k.id)}" rows="2" data-note="${esc(k.id)}" placeholder="Bukti yang mendukung keputusan, berkaitan dengan pekerjaan">${esc(k.catatan)}</textarea></div>
        ${(k.jejak || []).length ? `<details class="raw"><summary>Riwayat keputusan</summary><ol class="jejak">${k.jejak.map(j => `<li>${esc(j.pada)} · ${esc(j.tahap)}: ${esc(j.hasil)}${j.oleh ? ` · ${esc(j.oleh)}` : ''}</li>`).join('')}</ol></details>` : ''}
        ${f ? `<details class="raw"><summary>Lihat teks yang terbaca</summary><pre>${esc(f.text)}</pre></details>` : ''}
      </div>
    </details>`;
  }

  function renderList(l) {
    const list = $('list');
    if (!list) return;
    const all = sortedCandidates(l);
    const count = k => all.filter(c => recOf(c, l) === k).length;
    $('filters').innerHTML = [['semua', 'Semua', all.length]].concat(Object.keys(REC).map(k => [k, REC[k], count(k)]))
      .map(([k, label, n]) => `<button type="button" class="chip" data-act="filter" data-f="${k}" aria-pressed="${filter === k}">${esc(label)} (${n})</button>`).join('');
    const q = query.trim().toLowerCase();
    const shown = all.filter(k => (filter === 'semua' || recOf(k, l) === filter) &&
      (!q || k.fileName.toLowerCase().includes(q) || String(k.nomor || '').toLowerCase().includes(q) || String(k.text || '').toLowerCase().includes(q)));
    if (!all.length) list.innerHTML = '<div class="empty">Belum ada CV. Isi ketentuan, lalu unggah file CV.</div>';
    else if (!shown.length) list.innerHTML = '<div class="empty">Tidak ada kandidat yang cocok dengan saringan ini.</div>';
    else list.innerHTML = shown.map((k, i) => cardHtml(k, i, l)).join('');
  }

  async function addFiles(fileList) {
    const l = current();
    if (!l) return;
    const files = Array.from(fileList);
    const fresh = files.filter(f => !pelamar(l.id).some(k => k.fileName === f.name && k.size === f.size));
    const dup = files.length - fresh.length;
    const note = text => { const p = $('progress'); if (p) { p.hidden = !text; p.textContent = text; } };
    for (let i = 0; i < fresh.length; i++) {
      const f = fresh[i];
      note(`Membaca ${i + 1} dari ${fresh.length}: ${f.name}`);
      if (cloudOn) { await flush(); l.nomorBerikut = await C.reserveNomor(l.id, 1); }
      const k = { id: R.buatKode(), lowonganId: l.id, nomor: R.nextNomor(l), fileName: f.name, size: f.size, error: '', text: null, tahap: {} };
      try {
        k.text = await BacaCV.read(f);
        if (!S.extractFacts(k.text, f.name).readable) k.error = 'Teks CV tidak terbaca, kemungkinan hasil pindai (scan). Periksa file aslinya.';
      } catch (e) {
        k.error = BacaCV.friendlyError(e);
      }
      db.kandidat.push(k);
      renderList(l);
      const hc = $('head-count');
      if (hc) hc.textContent = `${pelamar(l.id).length} pelamar`;
    }
    const csv = app.querySelector('[data-act="csv"]');
    if (csv) csv.disabled = !pelamar(l.id).length;
    note(dup ? `${dup} file dilewati karena sudah diunggah.` : '');
    save();
  }

  // ---- Tab ringkasan ----
  function kesiapan(l) {
    const c = l.criteria;
    const adaKriteria = S.LEVELS.some(x => x.k === c.pendidikan.level) || ['jurusan', 'keahlian'].some(k => c[k].items.trim()) || +c.pengalaman.tahun > 0;
    return [
      ['Permintaan rekrutmen tercatat', !!(l.permintaanNomor && l.permintaanUnit)],
      ['Perusahaan, kontak, dan masa simpan data terisi', !!(l.perusahaan && l.kontak && l.retensi)],
      ['Persyaratan dan deskripsi pekerjaan terisi', !!(l.persyaratan && l.deskripsi)],
      ['Gambaran perusahaan tersedia untuk pelamar', !!l.tentang],
      ['Ketentuan screening terisi', adaKriteria],
      ['Tidak ada syarat ciri pribadi', !S.findProtected(l.persyaratan)],
      ['Tiap tahap punya keterangan untuk pelamar', l.tahapan.length > 0 && l.tahapan.every(t => t.keterangan)],
      ['Tanggal hapus data ditetapkan', !!l.hapusPada],
    ];
  }

  const persen = x => (x === null || x === undefined ? '-' : `${Math.round(x * 100)}%`);
  const nilai = rows => `<dl class="metrik">${rows.map(([t, v]) => `<div><dt>${esc(t)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  function metrikHtml(l, s) {
    const posisi = +l.permintaanJumlah || 0, cocok = s.list.filter(k => ['lolos', 'pertimbangkan'].includes(recOf(k, l))).length;
    const hari = l.permintaanTanggal && l.terisiTanggal ? Math.round((new Date(l.terisiTanggal) - new Date(l.permintaanTanggal)) / 864e5) : null;
    return `<section class="panel"><h3>Metrik rekrutmen</h3>${nilai([
      ['Pelamar per posisi', posisi ? S.idn(Math.round(s.total / posisi * 10) / 10) : '-'],
      ['Direkomendasikan screening', s.total ? persen(cocok / s.total) : '-'],
      ['Masuk talent pool', s.total ? persen(s.list.filter(k => k.talentPool).length / s.total) : '-'],
      ['Lama pengisian', hari === null ? '-' : `${hari} hari`],
    ])}<p class="hint">Isi jumlah posisi, tanggal permintaan, dan tanggal terisi di tab Ketentuan.</p></section>`;
  }

  function kecocokanHtml(l, s) {
    const t = l.tahapan[0], m = R.kinerjaScreening(t ? s.list.map(k => ({ rekomendasi: recOf(k, l), hasil: R.statusOf(k, t) })) : []);
    return `<section class="panel"><h3>Kecocokan screening dengan keputusan HR</h3>${m.n ? nilai([['Akurasi', persen(m.akurasi)], ['Presisi', persen(m.presisi)], ['Recall', persen(m.recall)], ['Skor F1', persen(m.f1)]]) : '<p class="note">Belum ada keputusan pada tahap pertama untuk dibandingkan.</p>'}
      <p class="hint">Dibandingkan dari ${m.n} peserta pada tahap ${esc(t ? t.nama : '-')}. Keputusan HR bisa terpengaruh rekomendasi, jadi angka ini bahan tinjauan, bukan bukti keakuratan. Periksa berkala, terutama bila ada kelompok yang sering tersaring.</p></section>`;
  }

  const PREBOARDING = [['surat', 'Surat selamat datang'], ['agenda', 'Agenda hari dan minggu pertama'], ['profil', 'Visi, misi, nilai, dan struktur organisasi'], ['aturan', 'Kode etik, kerahasiaan, serta keselamatan dan kesehatan kerja'], ['kontak', 'Kontak yang bisa dihubungi untuk bertanya'], ['dokumen', 'Pemberitahuan dokumen yang perlu disiapkan'], ['atasan', 'Pertemuan dengan atasan dan tim'], ['admin', 'Pemberitahuan ke bagian penggajian dan benefit'], ['alat', 'Perlengkapan kerja dan akses sistem']];
  function preboardingHtml(l) {
    const p = l.preboarding || {};
    return `<section class="panel"><h3>Persiapan bergabung</h3><p class="hint">Jaga komunikasi dengan calon pekerja sampai hari pertama.</p>
      <ul class="cek2">${PREBOARDING.map(([k, t]) => `<li><label class="consent"><input type="checkbox" data-pb="${k}"${p[k] ? ' checked' : ''}> <span>${esc(t)}</span></label></li>`).join('')}</ul></section>`;
  }

  function ringkasanHtml(l) {
    const s = stat(l), hari = l.tahapan.reduce((a, t) => a + (+t.targetHari || 0), 0);
    const f = R.funnel(s.list, l.tahapan).map(r => ({ label: r.tahap.nama, n: r.sampai, sub: `Lolos ${r.lolos} · Tidak ${r.tidak} · Menunggu ${r.menunggu}` }));
    return `<div class="stack">
      ${kpi('k6', [[s.total, 'Total pelamar'], [s.proses, 'Dalam proses'], [s.lolos, 'Lolos semua tahap'], [s.gugur, 'Tidak lolos'], [s.list.filter(k => k.talentPool).length, 'Talent pool'], [hari, 'Target hari seleksi']])}
      <div class="grid-side"><section class="panel"><h3>Saringan tahap</h3>${bars(f, '', true)}</section>
      <section class="panel"><h3>Kesiapan lowongan</h3>
        <ul class="ready">${kesiapan(l).map(([t, ok]) => `<li><span class="badge ${ok ? 'b-lolos' : 'b-tidak'}">${ok ? 'Siap' : 'Belum'}</span><span>${esc(t)}</span></li>`).join('')}</ul></section></div>
      <div class="grid2">${pengalamanHtml(R.kabarPelamar(l, s.list))}${metrikHtml(l, s)}</div>
      ${s.lolos ? preboardingHtml(l) : ''}
      <div class="grid2">${kecocokanHtml(l, s)}
      <section class="panel"><h3>Tinjauan dan pembelajaran</h3><div class="field"><label for="i-belajar">Catatan untuk rekrutmen berikutnya</label><textarea id="i-belajar" rows="6" placeholder="Bagian mana yang sesuai rencana dan mana yang tidak? Apa masukan pemangku kepentingan? Saluran dan cara penilaian apa yang perlu dipertahankan atau diubah?" data-l="pembelajaran">${esc(l.pembelajaran)}</textarea><span class="hint">Hanya untuk tim HR. Hindari menulis nama pelamar di sini.</span></div></section></div>
    </div>`;
  }

  // ---- Tab tahapan ----
  function tahapanHtml(l) {
    return `<div class="stack">
      <div class="result-head"><h3>Tahapan peserta</h3>
        <div class="inline"><div class="seg" role="group" aria-label="Tampilan tahapan"><button type="button" data-act="view-board" aria-pressed="${!view.tabel}">Papan</button><button type="button" data-act="view-table" aria-pressed="${!!view.tabel}">Checklist</button></div>
        <button type="button" class="ghost" data-act="apply-rec"${l.tahapan.length && pelamar(l.id).length ? '' : ' disabled'}>Isi ${esc(l.tahapan[0] ? l.tahapan[0].nama : 'tahap pertama')} dari rekomendasi</button></div></div>
      <p id="stage-note" class="note" role="status" hidden></p>
      <div id="matrix">${stageView(l)}</div>
      <details class="panel"${view.atur ? ' open' : ''}><summary>Atur tahapan</summary>
        <p class="hint">Nama dan keterangan tampil di portal. Pelaksana dan target hari hanya untuk tim HR.</p>
        <ol class="stages">${l.tahapan.map((t, i) => `<li>
          <div class="stage-grid">
            <input type="text" value="${esc(t.nama)}" data-stage="${esc(t.id)}" data-f="nama" aria-label="Nama tahap ${i + 1}">
            <input type="text" value="${esc(t.pelaksana)}" data-stage="${esc(t.id)}" data-f="pelaksana" placeholder="Pelaksana" aria-label="Pelaksana tahap ${i + 1}">
            <input type="number" min="0" value="${esc(t.targetHari)}" data-stage="${esc(t.id)}" data-f="targetHari" placeholder="Hari" aria-label="Target hari tahap ${i + 1}">
            <textarea rows="2" data-stage="${esc(t.id)}" data-f="keterangan" placeholder="Keterangan untuk pelamar" aria-label="Keterangan tahap ${i + 1}">${esc(t.keterangan)}</textarea>
          </div>
          <div class="stage-btn">
          <button type="button" class="ghost" data-act="stage-up" data-id="${esc(t.id)}"${i === 0 ? ' disabled' : ''} aria-label="Naikkan ${esc(t.nama)}">Naik</button>
          <button type="button" class="ghost" data-act="stage-down" data-id="${esc(t.id)}"${i === l.tahapan.length - 1 ? ' disabled' : ''} aria-label="Turunkan ${esc(t.nama)}">Turun</button>
          <button type="button" class="ghost" data-act="stage-del" data-id="${esc(t.id)}" aria-label="Hapus ${esc(t.nama)}">Hapus</button></div></li>`).join('')}</ol>
        <button type="button" class="ghost start" data-act="stage-add">Tambah tahap</button>
      </details>
    </div>`;
  }

  const stageView = l => (view.tabel ? matrixHtml(l) : boardHtml(l));

  function boardCard(k, l, t) {
    const r = resultOf(k, l), skor = r && r.score !== null ? r.score : '-';
    const who = esc(namaOf(k)), p = R.progress(k, l.tahapan);
    const batal = p.state === 'gugur' ? `<button type="button" class="ghost start" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(p.tahap.id)}" data-v="tidak" aria-label="Batalkan keputusan ${who}">Batalkan</button>` : '';
    return `<li class="bcard"><strong>${who}</strong><small>${esc(k.nomor)} · Skor ${esc(skor)}${p.state === 'gugur' ? ` · ${esc(p.tahap.nama)}` : ''}</small>${batal}
      ${t ? `<span class="tick">
        <button type="button" class="ok" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(t.id)}" data-v="lolos" aria-pressed="false" aria-label="${who} lolos ${esc(t.nama)}">&#10003;</button>
        <button type="button" class="no" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(t.id)}" data-v="tidak" aria-pressed="false" aria-label="${who} tidak lolos ${esc(t.nama)}">&#10005;</button></span>` : ''}</li>`;
  }

  // Papan kandidat: tiap kolom berisi peserta yang sedang menunggu di tahap itu.
  function boardHtml(l) {
    const list = pelamar(l.id);
    if (!list.length) return '<div class="empty">Belum ada peserta. Unggah CV di tab Kandidat.</div>';
    const pr = k => R.progress(k, l.tahapan);
    const col = (judul, items, t, cls) => `<section class="bcol ${cls || ''}"><h4>${esc(judul)} <span>${items.length}</span></h4><ul>${items.map(k => boardCard(k, l, t)).join('')}</ul></section>`;
    return `<div class="board" role="group" aria-label="Peserta per tahap">${l.tahapan.map((t, i) => col(`${i + 1}. ${t.nama}`, list.filter(k => pr(k).state === 'proses' && pr(k).index === i), t)).join('')}
      ${col('Lolos semua tahap', list.filter(k => pr(k).state === 'lolos'), null, 'b-ok')}${col('Tidak lolos', list.filter(k => pr(k).state === 'gugur'), null, 'b-no')}</div>`;
  }

  // Checklist: tiap peserta satu kartu, tahapnya berurutan ke bawah.
  function matrixHtml(l) {
    const list = pelamar(l.id).slice().sort((a, b) => {
      const pa = R.progress(a, l.tahapan), pb = R.progress(b, l.tahapan);
      const w = p => (p.state === 'gugur' ? -1 : p.index);
      return w(pb) - w(pa) || a.nomor.localeCompare(b.nomor);
    });
    if (!list.length) return '<div class="empty">Belum ada peserta. Unggah CV di tab Kandidat.</div>';
    if (!l.tahapan.length) return '<div class="empty">Tambahkan minimal satu tahap.</div>';
    const row = (k, t, i) => {
      const s = R.statusOf(k, t), who = esc(namaOf(k)), st = esc(t.nama);
      const aksi = R.reachable(k, l.tahapan, i) ? `<span class="tick">
        <button type="button" class="ok" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(t.id)}" data-v="lolos" aria-pressed="${s === 'lolos'}" aria-label="${who} lolos ${st}">&#10003;</button>
        <button type="button" class="no" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(t.id)}" data-v="tidak" aria-pressed="${s === 'tidak'}" aria-label="${who} tidak lolos ${st}">&#10005;</button>
      </span>` : '<span class="na">Belum bisa dinilai</span>';
      return `<li><span>${i + 1}. ${st}</span>${aksi}</li>`;
    };
    return `<div class="plist">${list.map(k => {
      const p = R.progress(k, l.tahapan);
      return `<section class="pcard"><div class="pcard-h"><div><strong>${esc(namaOf(k))}</strong><small>${esc(k.nomor)}</small></div><span class="st st-${p.state}">${esc(R.progressLabel(p))}</span></div>
        <ol class="pstep">${l.tahapan.map((t, i) => row(k, t, i)).join('')}</ol></section>`;
    }).join('')}</div>`;
  }

  function reorder(l, id, delta) {
    const i = l.tahapan.findIndex(t => t.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= l.tahapan.length) return;
    [l.tahapan[i], l.tahapan[j]] = [l.tahapan[j], l.tahapan[i]];
    pelamar(l.id).forEach(k => R.normalize(k, l.tahapan));
  }

  function applyRecommendations(l) {
    const first = l.tahapan[0];
    let lolos = 0, tidak = 0, sisa = 0;
    pelamar(l.id).forEach(k => {
      if (R.statusOf(k, first)) return;
      const rec = recOf(k, l);
      if (rec === 'lolos') { R.setTahap(k, l.tahapan, first.id, 'lolos'); catatKeputusan(k, l, first.id); lolos++; }
      else if (rec === 'tidak') { R.setTahap(k, l.tahapan, first.id, 'tidak'); catatKeputusan(k, l, first.id); tidak++; }
      else sisa++;
    });
    save();
    $('matrix').innerHTML = stageView(l);
    const n = $('stage-note');
    n.hidden = false;
    n.textContent = `${lolos} ditandai lolos, ${tidak} tidak lolos, ${sisa} perlu keputusan Anda. Periksa dulu sebelum diumumkan. Semua tanda masih bisa diubah.`;
  }

  // ---- Tab pengumuman ----
  function pengumumanState(l) {
    if (!l.tahapan.some(t => t.id === view.tahapId)) view.tahapId = l.tahapan.length ? l.tahapan[0].id : null;
    l.pengumuman = l.pengumuman || {};
    if (!view.tahapId) return null;
    l.pengumuman[view.tahapId] = l.pengumuman[view.tahapId] || { tanggal: '', tindak: '', tampilkanNama: false };
    return l.pengumuman[view.tahapId];
  }

  function pengumumanHtml(l) {
    const o = pengumumanState(l);
    if (!o) return '<div class="empty">Tambahkan tahapan terlebih dahulu.</div>';
    return `<div class="two">
      <section class="panel noprint"><h3>Susun pengumuman</h3>
        <div class="field"><label for="p-tahap">Tahap</label><select id="p-tahap" data-p-tahap>${l.tahapan.map(t => `<option value="${esc(t.id)}"${t.id === view.tahapId ? ' selected' : ''}>${esc(t.nama)}</option>`).join('')}</select></div>
        <div class="field"><label for="p-tanggal">Tanggal pengumuman</label><input id="p-tanggal" type="date" value="${esc(o.tanggal)}" data-a="tanggal"></div>
        <div class="field"><label for="p-tindak">Tindak lanjut bagi yang lolos</label><textarea id="p-tindak" rows="4" placeholder="Jadwal dan tempat tahap berikutnya" aria-describedby="p-tindak-h" data-a="tindak">${esc(o.tindak)}</textarea><span class="hint" id="p-tindak-h">Hanya terlihat oleh peserta yang lolos lewat halaman Cek hasil, tidak tampil di pengumuman publik. Alamat https menjadi tautan.</span></div>
        <fieldset class="wz-g"><legend>Penanda tangan pesan perorangan</legend>
          <div class="field"><label for="p-pic">Nama PIC</label><input id="p-pic" type="text" maxlength="100" value="${esc(l.picNama)}" placeholder="Contoh: Budi Santoso" data-l="picNama"></div>
          <div class="field"><label for="p-jabatan">Jabatan PIC</label><input id="p-jabatan" type="text" maxlength="100" value="${esc(l.picJabatan)}" placeholder="Contoh: HR Manager" data-l="picJabatan"></div>
        </fieldset>
        <div class="opts"><label><input type="checkbox" data-a="tampilkanNama"${o.tampilkanNama ? ' checked' : ''}> Tampilkan nama peserta yang tidak lolos</label></div>
        <span class="hint">Secara bawaan peserta yang tidak lolos hanya tampil dengan nomor peserta, untuk menjaga privasi.</span>
        <span class="hint">Pada keputusan akhir, kabari peserta terpilih lebih dulu. Peserta lain dikabari dan diberi ucapan terima kasih setelah penawaran diterima, supaya masih ada cadangan bila penawaran ditolak.</span>
        <div class="inline">${cloudOn ? '<button type="button" data-act="publish">Terbitkan ke portal</button>' : ''}<button type="button" class="${cloudOn ? 'ghost' : ''}" data-act="print">Cetak atau simpan PDF</button><button type="button" class="ghost" data-act="copy-ann">Salin teks</button></div>
        ${cloudOn ? `<span class="hint">${(l.terbit || {})[view.tahapId] ? 'Tahap ini sudah pernah diterbitkan. Terbitkan lagi bila ada perubahan.' : 'Belum diterbitkan. Pelamar belum bisa melihat hasil tahap ini.'} Portal hanya menampilkan nomor peserta. Tiap pelamar melihat hasilnya sendiri dengan kode.</span>` : ''}
        <p id="copy-note" class="note" role="status" hidden></p>
      </section>
      <div class="stack"><p id="ann-warn" class="warn noprint" hidden></p><article id="announce" class="announce"></article>
      <section id="personal" class="panel noprint"></section></div></div>`;
  }

  function renderAnnounce(l) {
    const box = $('announce');
    if (!box) return;
    const o = pengumumanState(l), index = l.tahapan.findIndex(t => t.id === view.tahapId), tahap = l.tahapan[index];
    const g = R.groupsAt(pelamar(l.id), l.tahapan, index);
    const rows = (list, show) => (list.length
      ? `<ol>${list.map(k => `<li><b>${esc(k.nomor)}</b>${show ? ` ${esc(namaOf(k))}` : ''}</li>`).join('')}</ol>` : '<p>Tidak ada.</p>');
    box.innerHTML = `<h3>Pengumuman Hasil ${esc(tahap.nama)}</h3>
      <p class="sub">${esc(l.judul)}${l.perusahaan ? ` · ${esc(l.perusahaan)}` : ''}${o.tanggal ? `<br>${esc(R.tanggalId(o.tanggal))}` : ''}</p>
      <h4 class="pass">Dinyatakan lolos (${g.lolos.length} peserta)</h4>${rows(g.lolos, true)}
      <h4 class="fail">Tidak lolos (${g.tidak.length} peserta)</h4>${rows(g.tidak, o.tampilkanNama)}
      ${o.tindak ? `<h4>Tindak lanjut</h4><p class="pre">${esc(o.tindak)}</p>` : ''}
      <p class="sub">Keputusan panitia seleksi bersifat final.</p>`;
    const w = $('ann-warn');
    w.hidden = !g.belum.length;
    if (g.belum.length) w.textContent = `${g.belum.length} peserta belum diputuskan pada tahap ini dan belum masuk pengumuman. Lengkapi di tab Tahapan.`;
    const people = g.lolos.map(k => [k, 'lolos']).concat(g.tidak.map(k => [k, 'tidak']));
    $('personal').innerHTML = `<h3>Pesan perorangan</h3><p class="hint">Salin lalu kirim sendiri lewat WhatsApp atau email. Isi pesan bisa diedit langsung. Tulis *seperti ini* untuk teks tebal. Aplikasi tidak mengirim apa pun.</p>
      ${l.picNama ? '' : '<p class="warn">Isi Nama PIC agar pesan ditutup dengan nama penanda tangan.</p>'}
      ${people.length ? `<ul class="people">${people.map(([k, s]) => {
        const f = factsOf(k);
        return `<li><span class="who"><strong>${esc(namaOf(k))}</strong><small>${esc(k.nomor)}${f && f.email ? ` · ${esc(f.email)}` : ''}</small></span><span class="badge b-${s}">${s === 'lolos' ? 'Lolos' : 'Tidak lolos'}</span><div class="field pesan-isi"><label for="m-${esc(k.id)}">Isi pesan untuk ${esc(namaOf(k))}</label><textarea id="m-${esc(k.id)}" rows="16" data-pesan="${esc(k.id)}" data-s="${s}">${esc(pesanUntuk(k, l, tahap, s, o))}</textarea></div>
          <div class="aksi"><button type="button" class="ghost" data-act="copy-msg" data-f="wa" data-k="${esc(k.id)}" data-s="${s}">Salin untuk WhatsApp</button><button type="button" class="ghost" data-act="copy-msg" data-f="email" data-k="${esc(k.id)}" data-s="${s}">Salin untuk email</button><button type="button" class="ghost" data-act="reset-msg" data-k="${esc(k.id)}" data-s="${s}"${(o.pesan || {})[`${k.id}_${s}`] === undefined ? ' hidden' : ''}>Kembalikan teks otomatis</button></div></li>`;
      }).join('')}</ul>` : '<p class="note">Belum ada peserta yang diputuskan pada tahap ini.</p>'}`;
  }

  // Teks yang sudah diedit PIC disimpan per peserta dan per hasil, supaya tidak tertukar bila keputusan berubah.
  const pesanUntuk = (k, l, tahap, s, o) => {
    const edit = (o.pesan || {})[`${k.id}_${s}`];
    return edit !== undefined ? edit : R.personalMessage(k, l, tahap, s, o, namaOf(k));
  };

  async function copyText(text, noteText, html) {
    let ok = false;
    try {
      if (html && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      } else await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      t.remove();
    }
    const n = $('copy-note');
    if (n) { n.hidden = false; n.textContent = ok ? noteText : 'Gagal menyalin. Gunakan tombol cetak.'; }
  }

  // ---- Unduhan ----
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const izinUnduh = () => window.confirm('File ini berisi data pribadi pelamar dan tidak terenkripsi. Simpan hanya di perangkat kerja dan hapus setelah selesai dipakai. Lanjutkan?');
  function csvCell(v) {
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // isi CV tidak boleh terbaca sebagai rumus Excel
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadCsv(l) {
    const head = ['Nomor', 'Nama', 'Email', 'Telepon', 'File', 'Skor', 'Rekomendasi', 'Pendidikan', 'IPK', 'Pengalaman (tahun)', 'Alasan'].concat(l.tahapan.map(t => t.nama), ['Status', 'Talent pool', 'Catatan']);
    const label = { lolos: 'Lolos', tidak: 'Tidak lolos' };
    const rows = sortedCandidates(l).map(k => {
      const f = factsOf(k) || {}, r = resultOf(k, l), rec = recOf(k, l), lvl = S.levelOf(f.level);
      return [k.nomor, namaOf(k), f.email, f.phone, k.fileName, r && r.score !== null ? r.score : '', rec ? REC[rec] : 'Belum dinilai', lvl ? lvl.label : '',
        f.ipk === null || f.ipk === undefined ? '' : S.idn(f.ipk, 2), f.exp && f.exp.years !== null ? S.idn(f.exp.years) : '',
        (k.error ? [k.error] : r ? r.alasan : []).join(' | ')].concat(l.tahapan.map(t => label[R.statusOf(k, t)] || ''), [R.progressLabel(R.progress(k, l.tahapan)), k.talentPool ? 'Ya' : '', k.catatan || '']);
    });
    const slug = l.judul.trim().replace(/[^\p{L}\p{N}]+/gu, '-');
    download(`kandidat-${slug}.csv`, '﻿' + [head].concat(rows).map(r => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ---- Render ----
  function render() {
    const l = current();
    if (!l) view.id = null;
    document.body.classList.toggle('pos', !!l && !wz);
    if (wz) { app.innerHTML = wzDraftHtml(); document.title = 'Buat lowongan | Lowongan Kerja HR'; wzPreview(); return; }
    app.innerHTML = l ? detailHtml(l) : homeHtml();
    document.title = l ? `${l.judul} | Lowongan Kerja HR` : 'Lowongan Kerja HR';
    if (!l) { renderPool(); return; }
    if (view.tab === 'kandidat') { bindDrop(); renderList(l); }
    if (view.tab === 'ketentuan') updateWarning(l);
    if (view.tab === 'pengumuman') renderAnnounce(l);
  }

  function bindDrop() {
    const drop = $('drop'), file = $('file');
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('click', e => e.stopPropagation());
    file.addEventListener('change', () => { addFiles(file.files); file.value = ''; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  }

  function createJob(judul, extra) {
    const criteria = S.defaultCriteria();
    const l = { id: R.uid(), judul, perusahaan: '', lokasiKerja: '', tenggat: '', deskripsi: '', persyaratan: '', kontak: '', retensi: '', status: 'buka', criteria, tahapan: R.newTahapan(), pengumuman: {}, terbit: {}, ...(extra || {}) };
    db.lowongan.unshift(l);
    view = { id: l.id, tab: extra ? 'ringkasan' : 'ketentuan', tahapId: null };
    filter = 'semua'; query = '';
    save();
    render();
  }

  // Jejak keputusan: siapa memutuskan apa dan kapan, untuk pertanggungjawaban seleksi.
  function catatKeputusan(k, l, tahapId) {
    const t = l.tahapan.find(x => x.id === tahapId), s = R.statusOf(k, t);
    const entry = { pada: new Date().toLocaleString('id-ID'), tahap: t.nama, hasil: { lolos: 'Lolos', tidak: 'Tidak lolos' }[s] || 'Dibatalkan', oleh: C ? C.email() : '' };
    k.jejak = (k.jejak || []).concat(entry).slice(-50);
  }

  // ---- Formulir lowongan otomatis ----
  let wz = null;

  function wzGen() {
    wz.draft = TL.hasilkan(wz.posisi, wz.jenjang);
    wz.jenjang = wz.draft.jenjang;
  }

  function wzBaru() {
    const akhir = db.lowongan.find(x => !x.contoh) || {};
    return { posisi: '', jenjang: 'madya', perusahaan: akhir.perusahaan || '', logo: akhir.logo || '', picNama: akhir.picNama || '', picJabatan: akhir.picJabatan || '', lokasi: '', kontak: akhir.kontak || '', retensi: akhir.retensi || '6 bulan setelah seleksi selesai', tenggat: '', draft: null };
  }

  function wzGroup(key, judul, hint, wajib) {
    const rows = wz.draft[key].map((x, i) => `<li><label class="consent"><input type="checkbox" data-wk="${key}" data-i="${i}" data-p="aktif"${x.aktif ? ' checked' : ''}> <span>${esc(x.t)}</span></label>
      ${wajib ? `<label class="wajib"><input type="checkbox" data-wk="${key}" data-i="${i}" data-p="wajib"${x.wajib ? ' checked' : ''}> Wajib</label>` : ''}${x.catatan ? `<span class="hint">${esc(x.catatan)}</span>` : ''}</li>`).join('');
    return `<fieldset class="wz-g"><legend>${judul}</legend>${hint ? `<p class="hint">${hint}</p>` : ''}<ul class="wz-list">${rows}</ul>
      <div class="inline"><input type="text" id="wa-${key}" aria-label="Tambah ${esc(judul)}" placeholder="Tambah sendiri"><button type="button" class="ghost" data-act="wz-add" data-k="${key}">Tambah</button></div></fieldset>`;
  }

  function wzDraftHtml() {
    const d = wz.draft, cocok = d.templat !== 'umum';
    const ref = cocok ? TL.SEMUA.find(t => t.id === d.templat) : null;
    const isian = (id, label, k, attr) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(wz[k])}" data-wa="${k}" ${attr}></div>`;
    return `<button type="button" class="back" data-act="wz-close">${wz.targetId ? 'Kembali ke lowongan' : 'Kembali ke dasbor'}</button>
      <div class="detail-head"><h2>Tinjau syarat: ${esc(wz.posisi)}</h2></div>
      <p class="${cocok ? 'info' : 'warn'}">${!cocok ? 'Posisi ini belum ada di pustaka, jadi draf berisi kerangka umum. Lengkapi sesuai kebutuhan jabatan.' : d.onet ? `Disusun dari templat ${esc(ref.nama)}, dirangkum dari profil jabatan O*NET (${esc(d.onet)}) dan pola lowongan di Indonesia.` : `Disusun dari rumpun jabatan ${esc(ref.nama)} tanpa rujukan khusus, jadi perlu ditelaah lebih teliti.`} Hapus centang yang tidak perlu, tambahkan yang kurang, dan pastikan tiap syarat benar-benar dibutuhkan pekerjaan.</p>
      <div class="two wz"><div class="stack">
        <fieldset class="wz-g"><legend>Info lowongan</legend>
          ${isian('w-posisi', 'Nama posisi', 'posisi', 'type="text"')}
          <button type="button" class="ghost start" data-act="wz-regen">Susun ulang dari posisi</button>
          <div class="field"><label for="w-jenjang">Jenjang</label><select id="w-jenjang" data-wj>${TL.JENJANG.map(j => `<option value="${j.k}"${wz.jenjang === j.k ? ' selected' : ''}>${esc(j.label)}</option>`).join('')}</select></div>
          ${isian('w-perusahaan', 'Perusahaan', 'perusahaan', 'type="text"')}
          ${logoField('w-logo', wz.logo, wz.perusahaan)}
          ${isian('w-lokasi', 'Lokasi kerja', 'lokasi', 'type="text"')}
          ${isian('w-tenggat', 'Tenggat lamaran', 'tenggat', 'type="date"')}
          ${isian('w-kontak', 'Kontak permintaan data pelamar', 'kontak', 'type="text" placeholder="Email HR"')}
          ${isian('w-retensi', 'Masa simpan data pelamar', 'retensi', 'type="text"')}
        </fieldset>
        <fieldset class="wz-g"><legend>Syarat dasar</legend>
          <div class="field"><label for="wd-pend">Pendidikan minimal</label><select id="wd-pend" data-wf="pendidikan"><option value="">Tidak disyaratkan</option>${S.LEVELS.map(x => `<option value="${x.k}"${d.pendidikan === x.k ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="wd-tahun">Pengalaman minimal (tahun)</label><input id="wd-tahun" type="number" min="0" step="0.5" value="${esc(d.tahun)}" data-wf="tahun"></div></fieldset>
        ${wzGroup('tugas', 'Tanggung jawab', '')}
        ${wzGroup('jurusan', 'Jurusan', 'Cukup cocok salah satu.')}
        ${wzGroup('keahlian', 'Keahlian utama', 'Yang wajib harus ada di CV; pelamar tanpa itu gugur di screening. Tandai wajib seperlunya.', true)}
        ${wzGroup('tambahan', 'Nilai tambah', 'Menambah skor, tidak menggugurkan.')}
        ${wzGroup('sertifikat', 'Sertifikasi', '', true)}
        ${wzGroup('ketentuan', 'Ketentuan seleksi', '')}
      </div>
      <aside class="stack wz-side"><section class="panel"><h3>Pratinjau lowongan</h3><div id="wz-prev"></div></section>
        <p id="wz-warn" class="warn" role="alert" hidden></p>
        ${wz.targetId ? '<div class="inline"><button type="button" data-act="wz-save" data-s="terapkan">Terapkan ke lowongan</button></div>' : '<div class="inline"><button type="button" data-act="wz-save" data-s="draf">Simpan sebagai draf</button><button type="button" class="ghost" data-act="wz-save" data-s="buka">Langsung terbitkan</button></div>'}
        <p class="hint">Draf belum tampil di portal. Setelah disimpan, ketentuan screening juga sudah terisi dan masih bisa diubah.</p></aside></div>`;
  }

  const labelLevel = k => { const x = S.levelOf(k); return x ? x.label : ''; };

  function wzPreview() {
    const box = $('wz-prev');
    if (!box) return;
    const t = TL.keTeks(wz.draft, labelLevel);
    box.innerHTML = `<h4>Persyaratan</h4><p class="pre">${esc(t.persyaratan) || 'Belum ada.'}</p><h4>Deskripsi</h4><p class="pre">${esc(t.deskripsi) || 'Belum ada.'}</p>`;
    const w = $('wz-warn'), semua = `${t.persyaratan}\n${t.deskripsi}`, hit = S.findProtected(semua.replace('penyandang disabilitas', ''));
    w.hidden = !hit;
    if (hit) w.textContent = `Draf memuat "${hit}". Menyaring pelamar berdasarkan ciri pribadi berisiko diskriminatif, kecuali memang disyaratkan pekerjaannya.`;
  }

  function wzSave(status) {
    const d = wz.draft, t = TL.keTeks(d, labelLevel);
    if (status === 'buka' && !(wz.perusahaan && wz.kontak && wz.retensi)) {
      const w = $('wz-warn'); w.hidden = false;
      w.textContent = 'Perusahaan, kontak, dan masa simpan data wajib diisi sebelum terbit.';
      return;
    }
    if (wz.targetId) {
      const l = db.lowongan.find(x => x.id === wz.targetId);
      if ((l.persyaratan || l.deskripsi) && !window.confirm('Ganti deskripsi, persyaratan, dan ketentuan screening lowongan ini dengan hasil baru?')) return;
      Object.assign(l, { judul: wz.posisi.trim() || l.judul, perusahaan: wz.perusahaan, logo: wz.logo, lokasiKerja: wz.lokasi, kontak: wz.kontak, retensi: wz.retensi, tenggat: wz.tenggat, deskripsi: t.deskripsi, persyaratan: t.persyaratan });
      l.criteria = TL.keKriteria(d, l.criteria);
      wz = null; view.tab = 'ketentuan';
      save(); render();
      return;
    }
    const posisi = wz.posisi.trim() || d.posisi, extra = { perusahaan: wz.perusahaan, logo: wz.logo, picNama: wz.picNama, picJabatan: wz.picJabatan, lokasiKerja: wz.lokasi, kontak: wz.kontak, retensi: wz.retensi, tenggat: wz.tenggat, deskripsi: t.deskripsi, persyaratan: t.persyaratan, status, criteria: TL.keKriteria(d, S.defaultCriteria()) };
    wz = null;
    createJob(posisi, extra);
  }

  // ---- Peristiwa ----
  // Gambar digambar ulang di kanvas: ukurannya kecil, metadata terbuang, dan isi selain piksel tidak ikut tersimpan.
  async function siapkanLogo(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Gunakan logo berformat PNG, JPG, atau WebP.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran logo maksimal 2 MB.');
    let img;
    try { img = await createImageBitmap(file); } catch (e) { throw new Error('File logo rusak atau tidak bisa dibaca.'); }
    if (img.width * img.height > 40e6) throw new Error('Dimensi gambar logo terlalu besar.');
    const skala = Math.min(1, 160 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * skala));
    c.height = Math.max(1, Math.round(img.height * skala));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let hasil = c.toDataURL('image/webp', 0.85);
    if (!R.logoSah(hasil)) {
      const x = c.getContext('2d');
      x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      hasil = c.toDataURL('image/jpeg', 0.8);
    }
    if (!R.logoSah(hasil)) throw new Error('Logo tidak bisa diproses. Coba gambar lain.');
    return hasil;
  }

  async function pasangLogo(el) {
    const file = el.files[0];
    if (!file) return;
    try {
      const logo = await siapkanLogo(file);
      if (wz) wz.logo = logo; else { current().logo = logo; save(); }
      showBanner('');
      render();
    } catch (e) { el.value = ''; showBanner(e.message); }
  }

  function logoField(id, logo, teks) {
    const pratinjau = R.logoSah(logo) ? `<span class="logo logo-img"><img src="${esc(logo)}" alt="Logo saat ini"></span>` : `<span class="logo" aria-hidden="true">${esc(String(teks || 'L').trim().charAt(0).toUpperCase() || 'L')}</span>`;
    return `<div class="field"><label for="${id}">Logo perusahaan (opsional)</label><div class="logo-pilih">${pratinjau}<div class="logo-isi"><input id="${id}" type="file" accept="image/png,image/jpeg,image/webp" data-logo aria-describedby="${id}-h">
      <span class="hint" id="${id}-h">PNG, JPG, atau WebP, maksimal 2 MB. Tampil di halaman pelamar di atas kotak putih, jadi hindari logo berwarna putih tanpa latar.</span>
      ${logo ? '<button type="button" class="ghost start" data-act="logo-del">Hapus logo</button>' : ''}</div></div></div>`;
  }

  function onInput(e) {
    const el = e.target, l = current(), d = el.dataset;
    if (d.logo !== undefined) { if (e.type === 'change') pasangLogo(el); return; }
    if (wz) {
      if (d.wa) wz[d.wa] = el.value;
      else if (d.wj !== undefined) {
        wz.jenjang = el.value;
        wz.draft.tahun = TL.JENJANG.find(j => j.k === el.value).tahun;
        $('wd-tahun').value = wz.draft.tahun;
        wzPreview();
      }
      else if (d.wf) { wz.draft[d.wf] = el.value; wzPreview(); }
      else if (d.wk) { wz.draft[d.wk][+d.i][d.p] = el.checked; wzPreview(); }
      return;
    }
    if (el.id === 'search' && l) { query = el.value; renderList(l); return; }
    if (d.pool) { view.pool[d.pool] = el.value; renderPool(); return; }
    if (!l) return;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    if (d.l) { l[d.l] = val; if (d.l === 'judul') app.querySelector('.detail-head h2').textContent = val; if (d.l.startsWith('pic')) renderAnnounce(l); }
    else if (d.root) l.criteria[d.root] = val;
    else if (d.c) l.criteria[d.c][d.p] = val;
    else if (d.x !== undefined) l.criteria.tambahan[+d.x][d.p] = val;
    else if (d.stage) { const t = l.tahapan.find(x => x.id === d.stage); if (t) { t[d.f] = val; if (e.type === 'change' && d.f === 'nama') { $('matrix').innerHTML = stageView(l); perbaruiTerbit(l); } } }
    else if (d.note) { const k = db.kandidat.find(x => x.id === d.note); if (k) k.catatan = val; }
    else if (d.a) { pengumumanState(l)[d.a] = val; renderAnnounce(l); }
    else if (d.pesan) {
      const o = pengumumanState(l);
      o.pesan = o.pesan || {};
      o.pesan[`${d.pesan}_${d.s}`] = val;
      const r = app.querySelector(`[data-act="reset-msg"][data-k="${d.pesan}"]`);
      if (r) r.hidden = false; // tidak digambar ulang agar kursor tetap di tempat
    }
    else if (d.pb) { l.preboarding = l.preboarding || {}; l.preboarding[d.pb] = val; }
    else if (d.pTahap !== undefined) { view.tahapId = val; render(); return; }
    else return;
    updateWarning(l);
    save();
  }

  const ACTIONS = {
    home(el) { view = { id: null, tab: 'kandidat', tahapId: null, page: el.dataset.p || 'dasbor', pool: view.pool }; wz = null; render(); },
    page(el) { view.page = el.dataset.p; render(); },
    'pool-copy'(el) { copyText(el.dataset.v, 'Email tersalin.'); },
    'pool-out'(el) {
      const k = db.kandidat.find(x => x.id === el.dataset.id);
      if (!k || !window.confirm(`Keluarkan ${namaOf(k)} dari talent pool?`)) return;
      k.talentPool = false;
      save(); renderPool();
    },
    'pool-csv'() {
      if (!izinUnduh()) return;
      const head = ['Nomor', 'Nama', 'Email', 'Telepon', 'Pendidikan', 'Pengalaman (tahun)', 'Lowongan asal'];
      const rows = poolHasil().map(({ k, f }) => { const lvl = S.levelOf(f.level), asal = db.lowongan.find(l => l.id === k.lowonganId); return [k.nomor, namaOf(k), f.email, f.phone, lvl ? lvl.label : '', f.exp.years === null || f.exp.years === undefined ? '' : S.idn(f.exp.years), asal ? asal.judul : '']; });
      download(`talent-pool-${hariIni()}.csv`, '\ufeff' + [head].concat(rows).map(r => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
    },
    open(el) { view = { id: el.dataset.id, tab: 'ringkasan', tahapId: null }; filter = 'semua'; query = ''; render(); },
    tab(el) { view.tab = el.dataset.tab; render(); },
    filter(el) { filter = el.dataset.f; renderList(current()); },
    parse() { applyParsed(current()); },
    'wz-close'() { wz = null; render(); },
    'wz-regen'() { if (wz.posisi.trim()) { wzGen(); render(); } },
    'wz-from'() {
      const l = current();
      if (!l.judul.trim()) { $('i-judul').focus(); return; }
      wz = { ...wzBaru(), targetId: l.id, posisi: l.judul, perusahaan: l.perusahaan, logo: l.logo || '', lokasi: l.lokasiKerja, kontak: l.kontak, retensi: l.retensi, tenggat: l.tenggat };
      wzGen();
      render();
    },
    'wz-add'(el) {
      const k = el.dataset.k, inp = $(`wa-${k}`), v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      wz.draft[k].push({ t: v, aktif: true, wajib: false });
      render();
      $(`wa-${k}`).focus();
    },
    'wz-save'(el) { wzSave(el.dataset.s); },
    'view-board'() { view.tabel = false; render(); },
    'view-table'() { view.tabel = true; render(); },
    sample() {
      const ada = db.lowongan.find(l => l.contoh);
      if (ada) { view = { id: ada.id, tab: 'ringkasan', tahapId: null }; render(); return; }
      const { judul, ...rest } = R.contohLowongan(), p = S.parseKetentuan(rest.persyaratan), c = S.defaultCriteria();
      c.pendidikan.level = p.level; c.pengalaman.tahun = p.tahun; c.jurusan.items = p.jurusan.join(', ');
      c.keahlian.items = p.keahlian.join(', '); c.nilaiTambah.items = p.nilaiTambah.join(', ');
      createJob(judul, { ...rest, criteria: c });
    },
    'custom-add'() { const l = current(); l.criteria.tambahan.push({ label: '', kata: '', wajib: false, bobot: 5 }); save(); render(); },
    'custom-del'(el) { const l = current(); l.criteria.tambahan.splice(+el.dataset.i, 1); save(); render(); },
    'del-job'(el) {
      const l = db.lowongan.find(x => x.id === el.dataset.id);
      if (!l) return;
      if (!window.confirm(`Hapus lowongan "${l.judul}" beserta ${pelamar(l.id).length} data pelamarnya? Tindakan ini tidak bisa dibatalkan.`)) return;
      db.kandidat = db.kandidat.filter(k => k.lowonganId !== l.id);
      db.lowongan = db.lowongan.filter(x => x.id !== l.id);
      view.id = null; view.page = 'lowongan'; save(); render();
    },
    rm(el) {
      const l = current(), k = db.kandidat.find(x => x.id === el.dataset.id);
      if (!k || !window.confirm(`Hapus data ${namaOf(k)}?`)) return;
      db.kandidat = db.kandidat.filter(x => x !== k);
      // Pesan yang diedit memuat nama pelamar, jadi ikut dihapus.
      Object.values(l.pengumuman || {}).forEach(p => Object.keys(p.pesan || {}).forEach(x => { if (x.startsWith(`${k.id}_`)) delete p.pesan[x]; }));
      factsCache.delete(k.id); openIds.delete(k.id);
      perbaruiTerbit(l, k.nomor);
      save(); renderList(l);
      $('head-count').textContent = `${pelamar(l.id).length} pelamar`;
    },
    csv() { if (izinUnduh()) downloadCsv(current()); },
    mark(el) {
      const l = current(), k = db.kandidat.find(x => x.id === el.dataset.k);
      if (k && R.setTahap(k, l.tahapan, el.dataset.t, el.dataset.v)) { catatKeputusan(k, l, el.dataset.t); save(); $('matrix').innerHTML = stageView(l); }
    },
    'apply-rec'() { applyRecommendations(current()); },
    'stage-add'() { const l = current(); l.tahapan.push({ id: R.uid(), nama: 'Tahap baru' }); save(); render(); },
    'stage-up'(el) { reorder(current(), el.dataset.id, -1); save(); render(); },
    'stage-down'(el) { reorder(current(), el.dataset.id, 1); save(); render(); },
    'stage-del'(el) {
      const l = current(), t = l.tahapan.find(x => x.id === el.dataset.id);
      const used = pelamar(l.id).some(k => R.statusOf(k, t));
      if (used && !window.confirm(`Tahap ${t.nama} sudah berisi hasil peserta. Hapus tahap ini beserta hasilnya?`)) return;
      l.tahapan = l.tahapan.filter(x => x !== t);
      if ((l.terbit || {})[t.id]) {
        delete l.terbit[t.id];
        if (cloudOn) C.apply([], [`pengumuman/${l.id}__${t.id}`]).catch(() => showBanner('Pengumuman tahap ini gagal dihapus dari portal.'));
      }
      pelamar(l.id).forEach(k => R.normalize(k, l.tahapan));
      save(); render();
    },
    print() { window.print(); },
    async publish() {
      const l = current(), o = pengumumanState(l), i = l.tahapan.findIndex(t => t.id === view.tahapId), tahap = l.tahapan[i];
      const g = R.groupsAt(pelamar(l.id), l.tahapan, i);
      if (l.status === 'draf') { showBanner('Lowongan masih draf. Ubah statusnya di tab Ketentuan sebelum menerbitkan hasil.'); return; }
      if (!g.lolos.length && !g.tidak.length) { showBanner('Belum ada peserta yang diputuskan pada tahap ini.'); return; }
      const sisa = g.belum.length ? ` ${g.belum.length} peserta yang belum diputuskan tidak ikut diumumkan.` : '';
      if (!window.confirm(`Terbitkan hasil ${tahap.nama}: ${g.lolos.length} lolos dan ${g.tidak.length} tidak lolos? Pelamar akan langsung bisa melihatnya.${sisa}`)) return;
      try {
        const sets = R.publishPayload(l, pelamar(l.id), i, o);
        await C.apply(sets, []);
        l.terbit = { ...(l.terbit || {}), [tahap.id]: { lolos: sets[0][1].lolos, tidak: sets[0][1].tidak } };
        await flush();
        render();
        const n = $('copy-note');
        n.hidden = false;
        n.textContent = `Hasil ${tahap.nama} sudah terbit di portal.`;
      } catch (e) {
        showBanner('Pengumuman gagal diterbitkan. Periksa koneksi lalu coba lagi.');
      }
    },
    async refresh() {
      try { await muatBaru(); } catch (e) { showBanner('Gagal memuat data dari server.'); }
    },
    async login() {
      try { await C.signIn(); showBanner(''); await bootCloud(); } catch (e) {
        showBanner(e && e.code === 'auth/popup-blocked' ? 'Jendela login diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.' : 'Gagal masuk. Coba lagi.');
      }
    },
    'logo-del'() {
      if (wz) wz.logo = ''; else { current().logo = ''; save(); }
      render();
    },
    async logout() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        if ((await flush()) === false && !window.confirm('Ada perubahan yang belum tersimpan ke server. Tetap keluar?')) return;
        clearTimeout(saveTimer);
      }
      wz = null; saveTimer = null;
      await C.signOut();
      window.location.reload();
    },
    'copy-ann'() {
      const l = current(), o = pengumumanState(l), i = l.tahapan.findIndex(t => t.id === view.tahapId);
      copyText(R.announcementText(l, l.tahapan[i], R.groupsAt(pelamar(l.id), l.tahapan, i), o, namaOf), 'Teks pengumuman tersalin.');
    },
    'copy-msg'(el) {
      const l = current(), k = db.kandidat.find(x => x.id === el.dataset.k), o = pengumumanState(l);
      const tahap = l.tahapan.find(t => t.id === view.tahapId);
      const pesan = pesanUntuk(k, l, tahap, el.dataset.s, o);
      if (el.dataset.f === 'email') copyText(R.pesanPolos(pesan), `Pesan email untuk ${namaOf(k)} tersalin.`, `<div>${R.pesanHtml(pesan)}</div>`);
      else copyText(pesan, `Pesan WhatsApp untuk ${namaOf(k)} tersalin.`);
    },
    'reset-msg'(el) {
      const l = current(), o = pengumumanState(l);
      delete (o.pesan || {})[`${el.dataset.k}_${el.dataset.s}`];
      save(); renderAnnounce(l);
    },
    async backup() {
      const pw = await askPassword('Buat kata sandi cadangan', 'Minimal 8 karakter. Kata sandi ini tidak bisa dipulihkan bila lupa.');
      if (!pw) return;
      download(`cadangan-lowongan-${hariIni()}.json`, await R.enkripsi(JSON.stringify(db), pw), 'application/json');
    },
    restore() { $('restore-file').click(); },
  };

  // Pengumuman yang sudah terbit ikut disesuaikan saat peserta dihapus atau nama tahap diganti.
  // Hanya daftar yang pernah terbit yang dipakai, supaya centang yang masih draf tidak bocor.
  function perbaruiTerbit(l, nomorDihapus) {
    if (!cloudOn) return;
    const sets = [];
    l.tahapan.forEach(t => {
      const v = (l.terbit || {})[t.id];
      if (!v) return;
      const data = { tahap: t.nama };
      if (v !== true) {
        v.lolos = v.lolos.filter(n => n !== nomorDihapus);
        v.tidak = v.tidak.filter(n => n !== nomorDihapus);
        Object.assign(data, { lolos: v.lolos, tidak: v.tidak });
      }
      sets.push([`pengumuman/${l.id}__${t.id}`, data]);
    });
    if (sets.length) C.apply(sets, []).catch(() => showBanner('Pengumuman di portal gagal disesuaikan. Terbitkan ulang tahap terkait.'));
  }

  function askPassword(judul, hint) {
    const dlg = $('pw'), input = $('pw-in'), err = $('pw-err');
    $('pw-judul').textContent = judul; $('pw-hint').textContent = hint;
    input.value = ''; err.hidden = true;
    dlg.showModal();
    return new Promise(resolve => {
      const done = v => { dlg.close(); $('pw-ok').onclick = null; $('pw-no').onclick = null; dlg.oncancel = null; resolve(v); };
      $('pw-ok').onclick = () => {
        if (input.value.length < 8) { err.hidden = false; err.textContent = 'Kata sandi minimal 8 karakter.'; input.focus(); return; }
        done(input.value);
      };
      $('pw-no').onclick = () => done('');
      dlg.oncancel = () => done('');
    });
  }

  // ---- Mode online ----
  async function reloadCloud() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      if ((await flush()) === false) return; // jangan menimpa perubahan yang belum tersimpan
    }
    db = await C.loadAll();
    db.lowongan = lengkapi(db.lowongan);
    factsCache.clear();
    remember(R.docsFromDb(db));
    await beriNomor();
    render();
    cekMasaSimpan();
  }

  // Satu dokumen HR yang hilang tidak boleh membuat seluruh halaman gagal dimuat.
  function lengkapi(lowongan) {
    const ada = lowongan.filter(l => l.judul);
    ada.forEach(l => { l.criteria = l.criteria || S.defaultCriteria(); l.tahapan = l.tahapan || R.newTahapan(); });
    return ada;
  }

  // Lowongan diambil utuh karena kecil; lamaran hanya yang baru atau diubah HR lain, bukan seluruh CV.
  async function muatBaru() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      if ((await flush()) === false) return;
    }
    const sejak = Math.max(0, ...db.kandidat.map(k => k.dibuatMs || 0));
    const sejakUbah = Math.max(0, ...db.kandidat.map(k => k.diubahMs || 0));
    const [lowongan, masuk, ubah] = await Promise.all([C.muatLowongan(), C.newLamaran(sejak), C.ubahLamaran(sejakUbah)]);
    db.lowongan = lengkapi(lowongan);
    const baru = masuk.filter(k => !db.kandidat.some(x => x.id === k.id));
    db.kandidat.push(...baru);
    ubah.forEach(u => { const k = db.kandidat.find(x => x.id === u.id); if (k) Object.assign(k, u); else if (u.lowonganId) db.kandidat.push(u); });
    db.kandidat = db.kandidat.filter(k => db.lowongan.some(l => l.id === k.lowonganId));
    if (view.id && !current()) view = { id: null, tab: 'kandidat', tahapId: null };
    remember(R.docsFromDb(db));
    await beriNomor();
    render();
    setSync(baru.length ? `${baru.length} lamaran baru` : 'Data terbaru dimuat');
  }

  // Lamaran dari portal belum bernomor; nomor diberikan di sini agar pelamar bisa melihatnya.
  async function beriNomor() {
    const fresh = [];
    for (const l of db.lowongan) {
      const baru = db.kandidat.filter(k => !k.nomor && k.lowonganId === l.id);
      if (!baru.length) continue;
      l.nomorBerikut = await C.reserveNomor(l.id, baru.length);
      baru.forEach(k => { k.nomor = R.nextNomor(l); fresh.push(R.hasilAwal(k, l)); });
    }
    if (fresh.length) { await C.apply(fresh, []); await syncCloud(); }
  }

  // Keluar otomatis setelah 30 menit tanpa aktivitas, agar data pelamar tidak terbuka di meja kosong.
  const BATAS_DIAM = 30 * 60 * 1000;
  function jagaSesi() {
    let t = null;
    const ulang = (ms = BATAS_DIAM) => { clearTimeout(t); t = setTimeout(keluarOtomatis, ms); };
    async function keluarOtomatis() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        if ((await flush()) === false) { ulang(60000); return; } // perubahan jangan hilang: coba lagi semenit kemudian
      }
      wz = null;
      await C.signOut();
      window.location.reload();
    }
    ['pointerdown', 'keydown', 'scroll'].forEach(n => document.addEventListener(n, () => ulang(), { passive: true }));
    ulang();
  }

  async function bootCloud() {
    cloudOn = true;
    $('foot').textContent = 'Data pelamar tersimpan di server dan hanya bisa dibuka akun HR. Hapus lowongan yang masa simpan datanya sudah habis.';
    app.innerHTML = '<div class="empty">Memuat...</div>';
    let u;
    try { u = await C.initHr(); } catch (e) { app.innerHTML = '<div class="empty">Tidak bisa tersambung ke server.</div>'; return; }
    if (!u) {
      app.innerHTML = '<section class="panel login"><h2>Masuk akun HR</h2><p>Halaman ini khusus tim HR.</p><button type="button" class="start" data-act="login">Masuk dengan Google</button></section>';
      return;
    }
    $('btn-logout').hidden = false;
    if (!(await C.isAdmin())) {
      app.innerHTML = `<section class="panel login"><h2>Akun belum terdaftar sebagai HR</h2><p>Minta pengelola menambahkan dokumen di koleksi <code>admins</code> dengan id:</p><p><code>${esc(u.uid)}</code></p></section>`;
      return;
    }
    $('btn-refresh').hidden = false;
    jagaSesi();
    try { await reloadCloud(); } catch (e) { app.innerHTML = '<div class="empty">Gagal memuat data dari server.</div>'; }
  }

  async function restoreFrom(file) {
    try {
      let data = JSON.parse(await file.text());
      if (data && data.format === 'lowongan-terenkripsi-1') {
        const pw = await askPassword('Masukkan kata sandi cadangan', 'Kata sandi yang dibuat saat mengunduh cadangan.');
        if (!pw) return;
        try { data = JSON.parse(await R.dekripsi(data, pw)); } catch (e) { showBanner('Kata sandi salah atau berkas rusak.'); return; }
      }
      if (!R.validBackup(data)) throw new Error('bentuk');
      if (cloudOn) {
        // Di server cadangan hanya menambah yang hilang, tidak pernah menimpa atau menghapus data yang lebih baru.
        const lBaru = data.lowongan.filter(l => !db.lowongan.some(x => x.id === l.id));
        const kBaru = data.kandidat.filter(k => !db.kandidat.some(x => x.id === k.id));
        if (!window.confirm(`Tambahkan ${lBaru.length} lowongan dan ${kBaru.length} pelamar yang hilang dari server?`)) return;
        db.lowongan.push(...lBaru); db.kandidat.push(...kBaru);
        await flush(); showBanner(''); render();
        return;
      }
      if (!window.confirm(`Ganti semua data di browser ini dengan cadangan berisi ${data.lowongan.length} lowongan dan ${data.kandidat.length} pelamar?`)) return;
      db = data; factsCache.clear(); openIds.clear();
      view = { id: null, tab: 'kandidat', tahapId: null };
      await flush();
      showBanner('');
      render();
    } catch (e) {
      showBanner('Berkas cadangan tidak dikenali.');
    }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !ACTIONS[el.dataset.act]) return;
    if (el.dataset.act.startsWith('stage-')) view.atur = true; // panel tetap terbuka setelah digambar ulang
    ACTIONS[el.dataset.act](el);
    if (['tab', 'page', 'open', 'home'].includes(el.dataset.act)) app.focus({ preventScroll: true }); // pembaca layar ikut pindah
  });
  app.addEventListener('input', onInput);
  app.addEventListener('change', onInput);
  app.addEventListener('submit', e => {
    e.preventDefault();
    const v = $('new-judul').value.trim();
    if (v) { wz = { ...wzBaru(), posisi: v }; wzGen(); render(); }
  });
  app.addEventListener('toggle', e => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('card')) return;
    if (el.open) openIds.add(el.dataset.id); else openIds.delete(el.dataset.id);
  }, true);
  $('restore-file').addEventListener('change', e => {
    if (e.target.files[0]) restoreFrom(e.target.files[0]);
    e.target.value = '';
  });
  window.addEventListener('beforeunload', e => {
    if (saveTimer) flush();
    if (saveTimer || (wz && wz.draft)) { e.preventDefault(); e.returnValue = ''; }
  });

  if (location.hostname === 'localhost') window.__lowonganApp = { addFiles, flush }; // hanya untuk pengujian lokal

  (async () => {
    if (C && C.enabled()) { await bootCloud(); return; }
    try {
      const saved = await loadDb();
      if (saved && R.validBackup(saved)) db = saved;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      showBanner('Browser ini tidak mengizinkan penyimpanan. Data akan hilang saat halaman ditutup, jadi unduh cadangan sebelum keluar.');
    }
    render();
    cekMasaSimpan();
  })();
})();
