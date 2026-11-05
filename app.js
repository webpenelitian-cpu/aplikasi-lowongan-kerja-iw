// Tampilan dan alur kerja aplikasi lowongan. Aturan penilaian ada di screening.js,
// aturan tahapan dan pengumuman ada di rekrutmen.js.
(function () {
  'use strict';
  const S = window.Screening, R = window.Rekrutmen, C = window.Cloud;
  const $ = id => document.getElementById(id);
  const app = $('app');

  const REC = { lolos: 'Lolos', pertimbangkan: 'Pertimbangkan', cek: 'Perlu cek manual', tidak: 'Tidak lolos' };
  const MARK = { ok: 'Terpenuhi', partial: 'Sebagian', no: 'Tidak', unknown: 'Tidak terbaca' };
  const TABS = [['ketentuan', 'Ketentuan'], ['kandidat', 'Kandidat'], ['tahapan', 'Tahapan'], ['pengumuman', 'Pengumuman']];

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
    next.forEach((v, p) => { if (snapshot.get(p) !== JSON.stringify(v)) sets.push([p, v]); });
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
      ? syncCloud().catch(() => showBanner('Perubahan gagal tersimpan ke server. Periksa koneksi, lalu ulangi perubahan terakhir.'))
      : writeDb().catch(() => showBanner('Data gagal tersimpan di browser ini. Unduh cadangan agar pekerjaan tidak hilang.'));
  };
  function save() {
    clearTimeout(saveTimer);
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
  const resultOf = (k, l) => { const f = factsOf(k); return f && !k.error ? S.evaluate(f, l.criteria) : null; };
  const recOf = (k, l) => { if (k.error) return 'cek'; const r = resultOf(k, l); return (r && r.rekomendasi) || null; };

  function sortedCandidates(l) {
    return pelamar(l.id).map(k => {
      const r = resultOf(k, l);
      return { k, rank: S.RANK[recOf(k, l)], score: r && r.score !== null ? r.score : -1 };
    }).sort((a, b) => (a.rank === undefined ? 9 : a.rank) - (b.rank === undefined ? 9 : b.rank) || b.score - a.score || a.k.nomor.localeCompare(b.k.nomor)).map(x => x.k);
  }

  // ---- Beranda ----
  function homeHtml() {
    const cards = db.lowongan.map(l => {
      const list = pelamar(l.id), st = list.map(k => R.progress(k, l.tahapan).state);
      const n = s => st.filter(x => x === s).length;
      return `<button type="button" class="job" data-act="open" data-id="${esc(l.id)}">
        <span class="job-head"><strong>${esc(l.judul)}</strong><span class="badge ${l.status === 'tutup' ? 'b-none' : 'b-lolos'}">${l.status === 'tutup' ? 'Ditutup' : 'Dibuka'}</span></span>
        <small>${esc([l.perusahaan, l.lokasiKerja].filter(Boolean).join(' · ') || 'Lengkapi info lowongan')}${l.tenggat ? ` · Tenggat ${esc(R.tanggalId(l.tenggat))}` : ''}</small>
        <span class="stats"><span><b>${list.length}</b> pelamar</span><span><b>${n('proses')}</b> dalam proses</span><span><b>${n('lolos')}</b> lolos</span><span><b>${n('gugur')}</b> tidak lolos</span></span>
      </button>`;
    }).join('');
    return `<form class="new-job" data-form="new">
        <label for="new-judul">Buat lowongan baru</label>
        <div class="inline"><input id="new-judul" type="text" placeholder="Nama posisi, misalnya Site Engineer" required><button type="submit">Buat lowongan</button></div>
      </form>
      <div class="jobs">${cards || '<div class="empty">Belum ada lowongan. Buat lowongan pertama di atas.</div>'}</div>`;
  }

  // ---- Halaman lowongan ----
  function detailHtml(l) {
    return `<div class="noprint">
      <button type="button" class="back" data-act="home">Semua lowongan</button>
      <div class="detail-head"><h2>${esc(l.judul)}</h2><span id="head-count" class="note">${pelamar(l.id).length} pelamar</span></div>
      <nav class="tabs" aria-label="Bagian lowongan">${TABS.map(([k, label]) => `<button type="button" data-act="tab" data-tab="${k}"${view.tab === k ? ' aria-current="page"' : ''}>${label}</button>`).join('')}</nav>
    </div>
    <div id="tab-body">${({ ketentuan: ketentuanHtml, kandidat: kandidatHtml, tahapan: tahapanHtml, pengumuman: pengumumanHtml })[view.tab](l)}</div>`;
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
        <div class="field"><label for="i-lokasi">Lokasi kerja</label><input id="i-lokasi" type="text" value="${esc(l.lokasiKerja)}" data-l="lokasiKerja"></div>
        <div class="field"><label for="i-tenggat">Tenggat lamaran</label><input id="i-tenggat" type="date" value="${esc(l.tenggat)}" data-l="tenggat"></div>
        <div class="field"><label for="i-status">Status</label><select id="i-status" data-l="status"><option value="buka"${l.status !== 'tutup' ? ' selected' : ''}>Dibuka</option><option value="tutup"${l.status === 'tutup' ? ' selected' : ''}>Ditutup</option></select></div>
        <div class="field"><label for="i-desk">Deskripsi pekerjaan</label><textarea id="i-desk" rows="4" data-l="deskripsi">${esc(l.deskripsi)}</textarea></div>
        <div class="field"><label for="paste">Persyaratan</label>
          <textarea id="paste" rows="6" data-l="persyaratan" placeholder="Satu syarat per baris.&#10;Minimal S1 jurusan Teknik Sipil&#10;Pengalaman minimal 3 tahun&#10;Menguasai AutoCAD, Excel">${esc(l.persyaratan)}</textarea>
          <span class="hint">Tampil di portal pelamar.</span>
          <button type="button" class="start" data-act="parse">Isi ketentuan dari persyaratan</button><p id="parse-note" class="note" hidden></p></div>
        ${cloudOn ? `<div class="field"><label for="i-kontak">Kontak permintaan data pelamar</label><input id="i-kontak" type="text" value="${esc(l.kontak)}" placeholder="Email HR" data-l="kontak">
          <label for="i-retensi">Masa simpan data pelamar</label><input id="i-retensi" type="text" value="${esc(l.retensi)}" placeholder="6 bulan setelah seleksi selesai" data-l="retensi">
          <span class="hint">Perusahaan, kontak, dan masa simpan wajib diisi. Tanpa itu pelamar belum bisa melamar.</span></div>` : ''}
        <button type="button" class="ghost danger start" data-act="del-job">Hapus lowongan dan data pelamarnya</button>
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
    const hit = [c.keahlian.items, c.nilaiTambah.items, c.sertifikasi.items].concat(c.tambahan.map(t => `${t.label} ${t.kata}`)).map(S.findProtected).find(Boolean);
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
        <span class="who"><strong>${esc(namaOf(k))}</strong><small>${esc(k.nomor)} · ${esc(R.progressLabel(R.progress(k, l.tahapan)))}</small></span>
        <span class="score"><span>${score === null ? '-' : score}</span><span class="bar"><i style="width:${score === null ? 0 : score}%"></i></span></span>
        ${rec ? `<span class="badge b-${rec}">${REC[rec]}</span>` : '<span class="badge b-none">Belum dinilai</span>'}
      </summary>
      <div class="detail">
        ${alasan.length ? `<div class="reason"><strong>Alasan</strong><ul>${alasan.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
        ${factsHtml(f)}
        ${r && r.checks.length ? `<ul class="checks">${r.checks.map(checkHtml).join('')}</ul>` : ''}
        ${f && f.email && pelamar(l.id).some(x => x !== k && factsOf(x) && factsOf(x).email.toLowerCase() === f.email.toLowerCase()) ? '<p class="warn">Email ini dipakai lebih dari satu lamaran pada lowongan ini.</p>' : ''}
        <div class="actions"><span class="note">File: ${esc(k.fileName)}${cloudOn ? ` · Kode cek hasil: ${esc(R.tampilKode(k.id))}` : ''}</span><button type="button" class="ghost" data-act="rm" data-id="${esc(k.id)}">Hapus pelamar ini</button></div>
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
      (!q || k.fileName.toLowerCase().includes(q) || k.nomor.toLowerCase().includes(q) || String(k.text || '').toLowerCase().includes(q)));
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

  // ---- Tab tahapan ----
  function tahapanHtml(l) {
    return `<div class="stack">
      <div class="result-head"><h3>Checklist peserta</h3>
        <button type="button" class="ghost" data-act="apply-rec"${l.tahapan.length && pelamar(l.id).length ? '' : ' disabled'}>Isi ${esc(l.tahapan[0] ? l.tahapan[0].nama : 'tahap pertama')} dari rekomendasi</button></div>
      <p id="stage-note" class="note" role="status" hidden></p>
      <div id="matrix">${matrixHtml(l)}</div>
      <details class="panel"${view.atur ? ' open' : ''}><summary>Atur tahapan</summary>
        <ol class="stages">${l.tahapan.map((t, i) => `<li>
          <input type="text" value="${esc(t.nama)}" data-stage="${esc(t.id)}" aria-label="Nama tahap ${i + 1}">
          <button type="button" class="ghost" data-act="stage-up" data-id="${esc(t.id)}"${i === 0 ? ' disabled' : ''} aria-label="Naikkan ${esc(t.nama)}">Naik</button>
          <button type="button" class="ghost" data-act="stage-down" data-id="${esc(t.id)}"${i === l.tahapan.length - 1 ? ' disabled' : ''} aria-label="Turunkan ${esc(t.nama)}">Turun</button>
          <button type="button" class="ghost" data-act="stage-del" data-id="${esc(t.id)}" aria-label="Hapus ${esc(t.nama)}">Hapus</button></li>`).join('')}</ol>
        <button type="button" class="ghost start" data-act="stage-add">Tambah tahap</button>
      </details>
    </div>`;
  }

  function matrixHtml(l) {
    const list = pelamar(l.id).slice().sort((a, b) => {
      const pa = R.progress(a, l.tahapan), pb = R.progress(b, l.tahapan);
      const w = p => (p.state === 'gugur' ? -1 : p.index);
      return w(pb) - w(pa) || a.nomor.localeCompare(b.nomor);
    });
    if (!list.length) return '<div class="empty">Belum ada peserta. Unggah CV di tab Kandidat.</div>';
    if (!l.tahapan.length) return '<div class="empty">Tambahkan minimal satu tahap.</div>';
    const cell = (k, t, i) => {
      if (!R.reachable(k, l.tahapan, i)) return '<td class="na" aria-label="Belum bisa dinilai">-</td>';
      const s = R.statusOf(k, t), who = esc(namaOf(k)), st = esc(t.nama);
      return `<td><span class="tick">
        <button type="button" class="ok" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(t.id)}" data-v="lolos" aria-pressed="${s === 'lolos'}" aria-label="${who} lolos ${st}">&#10003;</button>
        <button type="button" class="no" data-act="mark" data-k="${esc(k.id)}" data-t="${esc(t.id)}" data-v="tidak" aria-pressed="${s === 'tidak'}" aria-label="${who} tidak lolos ${st}">&#10005;</button>
      </span></td>`;
    };
    return `<div class="scroll"><table class="matrix"><thead><tr><th scope="col">Peserta</th>${l.tahapan.map(t => `<th scope="col">${esc(t.nama)}</th>`).join('')}<th scope="col">Status</th></tr></thead>
      <tbody>${list.map(k => {
        const p = R.progress(k, l.tahapan);
        return `<tr><th scope="row">${esc(namaOf(k))}<small>${esc(k.nomor)}</small></th>${l.tahapan.map((t, i) => cell(k, t, i)).join('')}<td class="st st-${p.state}">${esc(R.progressLabel(p))}</td></tr>`;
      }).join('')}</tbody></table></div>`;
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
      if (rec === 'lolos') { R.setTahap(k, l.tahapan, first.id, 'lolos'); lolos++; }
      else if (rec === 'tidak') { R.setTahap(k, l.tahapan, first.id, 'tidak'); tidak++; }
      else sisa++;
    });
    save();
    $('matrix').innerHTML = matrixHtml(l);
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
        <div class="field"><label for="p-tindak">Tindak lanjut bagi yang lolos</label><textarea id="p-tindak" rows="4" placeholder="Jadwal dan tempat tahap berikutnya" data-a="tindak">${esc(o.tindak)}</textarea></div>
        <div class="opts"><label><input type="checkbox" data-a="tampilkanNama"${o.tampilkanNama ? ' checked' : ''}> Tampilkan nama peserta yang tidak lolos</label></div>
        <span class="hint">Secara bawaan peserta yang tidak lolos hanya tampil dengan nomor peserta, untuk menjaga privasi.</span>
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
    $('personal').innerHTML = `<h3>Pesan perorangan</h3><p class="hint">Salin lalu kirim sendiri lewat email atau WhatsApp. Aplikasi tidak mengirim apa pun.</p>
      ${people.length ? `<ul class="people">${people.map(([k, s]) => {
        const f = factsOf(k);
        return `<li><span class="who"><strong>${esc(namaOf(k))}</strong><small>${esc(k.nomor)}${f && f.email ? ` · ${esc(f.email)}` : ''}</small></span><span class="badge b-${s}">${s === 'lolos' ? 'Lolos' : 'Tidak lolos'}</span><button type="button" class="ghost" data-act="copy-msg" data-k="${esc(k.id)}" data-s="${s}">Salin pesan</button></li>`;
      }).join('')}</ul>` : '<p class="note">Belum ada peserta yang diputuskan pada tahap ini.</p>'}`;
  }

  async function copyText(text, noteText) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
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

  function csvCell(v) {
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // isi CV tidak boleh terbaca sebagai rumus Excel
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadCsv(l) {
    const head = ['Nomor', 'Nama', 'Email', 'Telepon', 'File', 'Skor', 'Rekomendasi', 'Pendidikan', 'IPK', 'Pengalaman (tahun)', 'Alasan'].concat(l.tahapan.map(t => t.nama), ['Status']);
    const label = { lolos: 'Lolos', tidak: 'Tidak lolos' };
    const rows = sortedCandidates(l).map(k => {
      const f = factsOf(k) || {}, r = resultOf(k, l), rec = recOf(k, l), lvl = S.levelOf(f.level);
      return [k.nomor, namaOf(k), f.email, f.phone, k.fileName, r && r.score !== null ? r.score : '', rec ? REC[rec] : 'Belum dinilai', lvl ? lvl.label : '',
        f.ipk === null || f.ipk === undefined ? '' : S.idn(f.ipk, 2), f.exp && f.exp.years !== null ? S.idn(f.exp.years) : '',
        (k.error ? [k.error] : r ? r.alasan : []).join(' | ')].concat(l.tahapan.map(t => label[R.statusOf(k, t)] || ''), [R.progressLabel(R.progress(k, l.tahapan))]);
    });
    const slug = l.judul.trim().replace(/[^\p{L}\p{N}]+/gu, '-');
    download(`kandidat-${slug}.csv`, '﻿' + [head].concat(rows).map(r => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ---- Render ----
  function render() {
    const l = current();
    if (!l) view.id = null;
    app.innerHTML = l ? detailHtml(l) : homeHtml();
    if (!l) return;
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

  function createJob(judul) {
    const criteria = S.defaultCriteria();
    const l = { id: R.uid(), judul, perusahaan: '', lokasiKerja: '', tenggat: '', deskripsi: '', persyaratan: '', kontak: '', retensi: '', status: 'buka', criteria, tahapan: R.newTahapan(), pengumuman: {}, terbit: {} };
    db.lowongan.unshift(l);
    view = { id: l.id, tab: 'ketentuan', tahapId: null };
    filter = 'semua'; query = '';
    save();
    render();
  }

  // ---- Peristiwa ----
  function onInput(e) {
    const el = e.target, l = current(), d = el.dataset;
    if (el.id === 'search' && l) { query = el.value; renderList(l); return; }
    if (!l) return;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    if (d.l) { l[d.l] = val; if (d.l === 'judul') app.querySelector('.detail-head h2').textContent = val; }
    else if (d.root) l.criteria[d.root] = val;
    else if (d.c) l.criteria[d.c][d.p] = val;
    else if (d.x !== undefined) l.criteria.tambahan[+d.x][d.p] = val;
    else if (d.stage) { const t = l.tahapan.find(x => x.id === d.stage); if (t) { t.nama = val; if (e.type === 'change') $('matrix').innerHTML = matrixHtml(l); } }
    else if (d.a) { pengumumanState(l)[d.a] = val; renderAnnounce(l); }
    else if (d.pTahap !== undefined) { view.tahapId = val; render(); return; }
    else return;
    updateWarning(l);
    save();
  }

  const ACTIONS = {
    home() { view = { id: null, tab: 'kandidat', tahapId: null }; render(); },
    open(el) { view = { id: el.dataset.id, tab: 'kandidat', tahapId: null }; filter = 'semua'; query = ''; render(); },
    tab(el) { view.tab = el.dataset.tab; render(); },
    filter(el) { filter = el.dataset.f; renderList(current()); },
    parse() { applyParsed(current()); },
    'custom-add'() { const l = current(); l.criteria.tambahan.push({ label: '', kata: '', wajib: false, bobot: 5 }); save(); render(); },
    'custom-del'(el) { const l = current(); l.criteria.tambahan.splice(+el.dataset.i, 1); save(); render(); },
    'del-job'() {
      const l = current();
      if (!window.confirm(`Hapus lowongan "${l.judul}" beserta ${pelamar(l.id).length} data pelamarnya? Tindakan ini tidak bisa dibatalkan.`)) return;
      db.kandidat = db.kandidat.filter(k => k.lowonganId !== l.id);
      db.lowongan = db.lowongan.filter(x => x.id !== l.id);
      view.id = null; save(); render();
    },
    rm(el) {
      const l = current(), k = db.kandidat.find(x => x.id === el.dataset.id);
      if (!k || !window.confirm(`Hapus data ${namaOf(k)}?`)) return;
      db.kandidat = db.kandidat.filter(x => x !== k);
      factsCache.delete(k.id); openIds.delete(k.id);
      save(); renderList(l);
      $('head-count').textContent = `${pelamar(l.id).length} pelamar`;
    },
    csv() { downloadCsv(current()); },
    mark(el) {
      const l = current(), k = db.kandidat.find(x => x.id === el.dataset.k);
      if (k && R.setTahap(k, l.tahapan, el.dataset.t, el.dataset.v)) { save(); $('matrix').innerHTML = matrixHtml(l); }
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
      pelamar(l.id).forEach(k => R.normalize(k, l.tahapan));
      save(); render();
    },
    print() { window.print(); },
    async publish() {
      const l = current(), o = pengumumanState(l), i = l.tahapan.findIndex(t => t.id === view.tahapId), tahap = l.tahapan[i];
      const g = R.groupsAt(pelamar(l.id), l.tahapan, i);
      if (!g.lolos.length && !g.tidak.length) { showBanner('Belum ada peserta yang diputuskan pada tahap ini.'); return; }
      const sisa = g.belum.length ? ` ${g.belum.length} peserta yang belum diputuskan tidak ikut diumumkan.` : '';
      if (!window.confirm(`Terbitkan hasil ${tahap.nama}: ${g.lolos.length} lolos dan ${g.tidak.length} tidak lolos? Pelamar akan langsung bisa melihatnya.${sisa}`)) return;
      try {
        await C.apply(R.publishPayload(l, pelamar(l.id), i, o), []);
        l.terbit = { ...(l.terbit || {}), [tahap.id]: true };
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
      try { await reloadCloud(); } catch (e) { showBanner('Gagal memuat data dari server.'); }
    },
    async login() {
      try { await C.signIn(); showBanner(''); await bootCloud(); } catch (e) {
        showBanner(e && e.code === 'auth/popup-blocked' ? 'Jendela login diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.' : 'Gagal masuk. Coba lagi.');
      }
    },
    async logout() { await C.signOut(); window.location.reload(); },
    'copy-ann'() {
      const l = current(), o = pengumumanState(l), i = l.tahapan.findIndex(t => t.id === view.tahapId);
      copyText(R.announcementText(l, l.tahapan[i], R.groupsAt(pelamar(l.id), l.tahapan, i), o, namaOf), 'Teks pengumuman tersalin.');
    },
    'copy-msg'(el) {
      const l = current(), k = db.kandidat.find(x => x.id === el.dataset.k), o = pengumumanState(l);
      const tahap = l.tahapan.find(t => t.id === view.tahapId);
      copyText(R.personalMessage(k, l, tahap, el.dataset.s, o, namaOf(k)), `Pesan untuk ${namaOf(k)} tersalin.`);
    },
    backup() { download(`cadangan-lowongan-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db), 'application/json'); },
    restore() { $('restore-file').click(); },
  };

  // ---- Mode online ----
  async function reloadCloud() {
    if (saveTimer) { clearTimeout(saveTimer); await flush(); }
    db = await C.loadAll();
    factsCache.clear();
    remember(R.docsFromDb(db));
    // Lamaran dari portal belum bernomor; nomor diberikan di sini agar pelamar bisa melihatnya.
    const fresh = [];
    db.kandidat.filter(k => !k.nomor).forEach(k => {
      const l = db.lowongan.find(x => x.id === k.lowonganId);
      if (!l) return;
      k.nomor = R.nextNomor(l);
      fresh.push(R.hasilAwal(k, l));
    });
    if (fresh.length) { await C.apply(fresh, []); await syncCloud(); }
    render();
  }

  async function bootCloud() {
    cloudOn = true;
    $('btn-restore').hidden = true;
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
    try { await reloadCloud(); } catch (e) { app.innerHTML = '<div class="empty">Gagal memuat data dari server.</div>'; }
  }

  async function restoreFrom(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!R.validBackup(data)) throw new Error('bentuk');
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
  });
  app.addEventListener('input', onInput);
  app.addEventListener('change', onInput);
  app.addEventListener('submit', e => {
    e.preventDefault();
    const v = $('new-judul').value.trim();
    if (v) createJob(v);
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
  window.addEventListener('beforeunload', () => { if (saveTimer) flush(); });

  window.__lowonganApp = { addFiles, flush }; // dipakai oleh pengujian

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
  })();
})();
