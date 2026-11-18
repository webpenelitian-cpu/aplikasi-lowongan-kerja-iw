/* global BacaCV */ // dari baca-cv.js (skrip biasa yang dimuat lebih dulu)
// Portal publik untuk pelamar: daftar lowongan, formulir lamaran, cek hasil dengan kode, dan pengumuman.
(function () {
  'use strict';
  // Tidak boleh tampil di dalam bingkai situs lain (mencegah clickjacking). GitHub Pages tidak bisa mengirim header X-Frame-Options.
  if (window.top !== window.self) { document.documentElement.replaceChildren(); return; }
  const R = window.Rekrutmen, C = window.Cloud;
  const buat = R.buat; // membangun DOM tanpa mengurai HTML (lihat rekrutmen.js)
  const pesan = (el, teks, kelas = 'empty') => el.replaceChildren(buat(kelas === 'empty' ? 'div' : 'p', { class: kelas }, teks));
  const URUT = new Intl.Collator().compare; // dipakai ulang; hasil sama dengan localeCompare tanpa argumen (mdn/content)
  const app = document.getElementById('app');
  const NET_ERROR = 'Tidak bisa tersambung ke server. Periksa koneksi internet lalu coba lagi.';

  const tutupMs = l => (l.tutupPada && l.tutupPada.toMillis ? l.tutupPada.toMillis() : l.tutupPada ? new Date(l.tutupPada).getTime() : 0);
  const dibuka = l => l.status === 'buka' && tutupMs(l) > Date.now() && !l.contoh;
  const siap = l => !!(l.perusahaan && l.kontak && l.retensi); // tanpa ini pelamar tidak tahu siapa yang memegang datanya

  function meta(l) {
    return [l.perusahaan, l.lokasiKerja, l.tenggat ? `Tenggat ${R.tanggalId(l.tenggat)}` : ''].filter(Boolean).join(' · ');
  }

  const setTitle = t => { document.title = t ? `${t} | Lowongan Kerja` : 'Lowongan Kerja'; };

  const inisial = s => (String(s || '').replace(/\b(PT|CV|Tbk)\b\.?/gi, '').match(/[\p{L}\p{N}]+/gu) || ['L']).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const cuplikan = s => {
    const t = String(s || '').split('\n').map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(x => x && !x.endsWith(':')).join('. ').replace(/\.\. /g, '. ');
    return t.length > 170 ? `${t.slice(0, 170).replace(/\s\S*$/, '').replace(/[.,;:]+$/, '')}...` : t;
  };

  let semua = [], dimuat = 0;
  const saring = { q: '', lok: '', status: 'semua' };
  const STATUS = [['semua', 'Semua'], ['buka', 'Dibuka'], ['tutup', 'Ditutup']];

  // Logo dan lencana status sebagai DOM: data lowongan (dari HR) menjadi teks/atribut, bukan markup.
  const logoEl = l => (R.logoSah(l.logo)
    ? buat('span', { class: 'logo logo-img', 'aria-hidden': 'true' }, buat('img', { src: l.logo, alt: '' }))
    : buat('span', { class: 'logo', 'aria-hidden': 'true' }, inisial(l.perusahaan || l.judul)));
  const badgeEl = l => (l.contoh ? buat('span', { class: 'badge b-cek' }, 'Contoh')
    : buat('span', { class: `badge ${dibuka(l) ? 'b-lolos' : 'b-none'}` }, dibuka(l) ? 'Dibuka' : 'Ditutup'));

  function kartu(l) {
    const foot = l.contoh ? 'Lowongan contoh' : dibuka(l) ? (l.tenggat ? `Melamar sampai ${R.tanggalId(l.tenggat)}` : 'Menerima lamaran') : 'Pendaftaran ditutup';
    return buat('a', { class: 'job', href: `#/l/${encodeURIComponent(l.id)}` }, logoEl(l), buat('span', { class: 'job-body' },
      buat('span', { class: 'job-head' }, buat('strong', null, l.judul), badgeEl(l)),
      buat('span', { class: 'job-co' }, [l.perusahaan, l.lokasiKerja].filter(Boolean).join(' · ')),
      l.deskripsi ? buat('span', { class: 'job-sn' }, cuplikan(l.deskripsi)) : null,
      buat('small', { class: 'job-ft' }, foot)));
  }

  function daftar() {
    const box = document.getElementById('hasil');
    if (!box) return;
    const q = saring.q.toLowerCase();
    const list = semua.filter(l => (!q || `${l.judul} ${l.perusahaan} ${l.deskripsi} ${l.persyaratan}`.toLowerCase().includes(q))
      && (!saring.lok || l.lokasiKerja === saring.lok)
      && (saring.status === 'semua' || (saring.status === 'buka') === dibuka(l)));
    document.getElementById('jumlah').textContent = `${list.length} lowongan`;
    if (list.length) box.replaceChildren(...list.map(kartu));
    else pesan(box, semua.length ? 'Tidak ada lowongan yang cocok dengan pencarian ini.' : 'Belum ada lowongan yang dibuka saat ini.');
    document.getElementById('chips').replaceChildren(...STATUS.map(([k, v]) => buat('button', { type: 'button', class: 'chip', 'data-s': k, 'aria-pressed': String(saring.status === k) }, v)));
  }

  async function home() {
    setTitle('');
    // Daftar disimpan sebentar agar pindah halaman tidak membaca server lagi.
    if (Date.now() - dimuat > 60000) { semua = await C.listLowongan(); dimuat = Date.now(); }
    semua = semua.filter(l => l.status !== 'draf').sort((a, b) => dibuka(b) - dibuka(a) || URUT(a.judul, b.judul));
    const lok = document.getElementById('lok'), pilih = saring.lok;
    lok.replaceChildren(buat('option', { value: '' }, 'Semua lokasi'), ...[...new Set(semua.map(l => l.lokasiKerja).filter(Boolean))].sort().map(x => buat('option', { selected: x === pilih }, x)));
    app.innerHTML = `<div class="beranda"><section aria-labelledby="jumlah"><div class="result-head"><h2 id="jumlah" aria-live="polite"></h2><div id="chips" class="chips" role="group" aria-label="Saring status lowongan"></div></div><div id="hasil" class="results"></div></section>
      <aside class="trust" aria-label="Informasi pelamar">
        <div><strong>Tanpa biaya</strong>Melamar dan mengikuti seleksi tidak dipungut biaya.</div>
        <div><strong>Kesempatan setara</strong>Penilaian berdasarkan kemampuan yang dibutuhkan pekerjaan.</div>
        <div><strong>Hasil transparan</strong>Pantau hasil tiap tahap dengan kode lamaran Anda.</div>
        <a class="linkbtn" href="#/cek">Cek hasil seleksi</a>
      </aside></div>`;
    daftar();
  }

  // Halaman detail lowongan dibangun sebagai DOM: data lowongan dan pengumuman (dari HR) dipasang sebagai teks, bukan markup.
  function announceEl(p) {
    const list = a => (a.length ? buat('ol', { class: 'nomor' }, a.map(n => buat('li', null, n))) : buat('p', null, 'Tidak ada.'));
    return buat('details', { class: 'panel' }, buat('summary', null, `Hasil ${p.tahap ?? ''}${p.tanggal ? ` (${R.tanggalId(p.tanggal)})` : ''}`),
      buat('h3', { class: 'pass' }, `Dinyatakan lolos (${p.lolos.length} peserta)`), list(p.lolos),
      buat('h3', { class: 'fail' }, `Tidak lolos (${p.tidak.length} peserta)`), list(p.tidak));
  }

  function alurEl(l) {
    if (!(l.alur || []).length) return [];
    return [buat('h2', null, 'Alur seleksi'), buat('ol', { class: 'steps' }, l.alur.map(t => buat('li', null, buat('div', null, buat('strong', null, t.nama), buat('span', null, t.keterangan)))))];
  }

  const wajib = () => buat('span', { class: 'req', 'aria-hidden': 'true' }, '*');
  function fieldInput(id, label, atribut) {
    return buat('div', { class: 'field' }, buat('label', { for: id }, `${label} `, wajib()),
      buat('input', { id, required: true, 'aria-required': 'true', 'aria-describedby': 'a-err', ...atribut }));
  }

  function formEl(l) {
    return buat('form', { id: 'apply', class: 'panel', novalidate: true },
      buat('h2', null, 'Kirim lamaran'),
      buat('div', { class: 'jebak', 'aria-hidden': 'true' }, buat('label', { for: 'a-situs' }, 'Situs web'), buat('input', { id: 'a-situs', type: 'text', tabindex: '-1', autocomplete: 'off' })),
      fieldInput('a-nama', 'Nama lengkap', { type: 'text', maxlength: 100, autocomplete: 'name' }),
      fieldInput('a-email', 'Email', { type: 'email', maxlength: 120, autocomplete: 'email' }),
      fieldInput('a-telp', 'Nomor telepon', { type: 'tel', maxlength: 20, autocomplete: 'tel' }),
      buat('div', { class: 'field' }, buat('label', { for: 'a-sumber' }, 'Dari mana Anda mengetahui lowongan ini? (opsional)'),
        buat('select', { id: 'a-sumber' }, buat('option', { value: '' }, 'Pilih'), R.SUMBER.map(([k, t]) => buat('option', { value: k }, t)))),
      buat('div', { class: 'field' }, buat('label', { for: 'a-cv' }, 'File CV ', wajib()),
        buat('input', { id: 'a-cv', type: 'file', accept: '.pdf,.docx,.txt', required: true, 'aria-required': 'true', 'aria-describedby': 'a-cv-h a-err' }),
        buat('span', { class: 'hint', id: 'a-cv-h' }, 'PDF, DOCX, atau TXT, maksimal 15 MB. CV hasil scan atau foto tidak bisa dibaca.')),
      buat('div', { class: 'field' },
        buat('label', { class: 'consent' }, buat('input', { id: 'a-setuju', type: 'checkbox', 'aria-describedby': 'a-err' }), ' ',
          buat('span', null, `Saya menyetujui ${l.perusahaan} memproses data pribadi dan isi CV saya untuk seleksi ${l.judul}, dan menyimpannya paling lama ${l.retensi}. Saya dapat meminta data saya diakses, diperbaiki, atau dihapus melalui ${l.kontak}.`)),
        buat('label', { class: 'consent' }, buat('input', { id: 'a-pool', type: 'checkbox' }), ' ', buat('span', null, 'Opsional: simpan data saya untuk ditawari lowongan lain yang sesuai selama masa simpan di atas.')),
        buat('span', { class: 'hint' }, 'CV dicocokkan otomatis dengan persyaratan sebagai rekomendasi awal. Keputusan tetap dibuat oleh tim HR, dan Anda dapat mengajukan keberatan melalui kontak di atas.'),
        buat('span', { class: 'hint' }, `Ada pertanyaan tentang lowongan atau seleksi, atau butuh penyesuaian karena disabilitas? Hubungi ${l.kontak}.`),
        buat('span', { class: 'hint' }, buat('a', { href: '#/privasi' }, 'Baca pemberitahuan privasi pelamar'))),
      buat('p', { id: 'a-err', class: 'warn', role: 'alert', hidden: true }),
      buat('button', { type: 'submit', class: 'start' }, 'Kirim lamaran'));
  }

  async function detail(id) {
    const tersimpan = Date.now() - dimuat < 60000 ? semua.find(x => x.id === id) : null;
    const [l, ann] = await Promise.all([tersimpan || C.getLowongan(id), C.listPengumuman(id).catch(() => [])]);
    if (!l || l.status === 'draf') { setTitle('Tidak ditemukan'); pesan(app, 'Lowongan tidak ditemukan.'); return; }
    setTitle(l.judul);
    ann.sort((a, b) => b.urutan - a.urutan);
    const closed = l.contoh ? buat('div', { class: 'info' }, 'Ini lowongan contoh untuk memperlihatkan alur seleksi. Lowongan ini tidak menerima lamaran.')
      : !dibuka(l) ? buat('div', { class: 'empty' }, 'Pendaftaran untuk lowongan ini sudah ditutup.')
        : !siap(l) ? buat('div', { class: 'empty' }, 'Pendaftaran untuk lowongan ini belum dibuka.') : null;
    const bisa = !closed;
    const bagian = (judul, isi) => (isi ? [buat('h2', null, judul), buat('p', { class: 'pre' }, isi)] : []);
    app.replaceChildren(
      buat('a', { class: 'back', href: '#/' }, 'Semua lowongan'),
      buat('section', { class: 'job-top' }, logoEl(l),
        buat('div', { class: 'job-top-in' }, buat('div', { class: 'job-head' }, badgeEl(l), buat('h1', null, l.judul)), buat('p', { class: 'note' }, meta(l))),
        bisa ? buat('button', { type: 'button', id: 'to-apply' }, 'Lamar sekarang') : null),
      buat('div', { class: 'two' },
        buat('section', { class: 'panel' }, bagian('Tentang perusahaan', l.tentang), bagian('Deskripsi pekerjaan', l.deskripsi),
          bagian('Persyaratan', l.persyaratan), bagian('Waktu kerja, gaji, dan benefit', l.kompensasi), alurEl(l)),
        buat('div', { class: 'stack' }, closed || formEl(l),
          ann.length ? buat('section', { class: 'stack' }, buat('h2', null, 'Pengumuman'), ann.map(announceEl),
            buat('p', { class: 'hint' }, 'Hanya nomor peserta yang ditampilkan. Nomor Anda ada di halaman Cek hasil.')) : null)));
    const form = document.getElementById('apply');
    formDibuka = Date.now();
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send(l, form); });
    const go = document.getElementById('to-apply');
    if (go) go.addEventListener('click', () => { form.scrollIntoView({ block: 'start' }); document.getElementById('a-nama').focus({ preventScroll: true }); });
  }

  function validate(v) {
    if (v.nama.length < 2) return ['a-nama', 'Isi nama lengkap Anda.'];
    if (!/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(v.email)) return ['a-email', 'Periksa kembali alamat email Anda.'];
    if (!/^[+0-9 ()-]{8,20}$/.test(v.telepon)) return ['a-telp', 'Periksa kembali nomor telepon Anda.'];
    if (!v.file) return ['a-cv', 'Pilih file CV Anda.'];
    if (!v.setuju) return ['a-setuju', 'Centang persetujuan pemrosesan data untuk melanjutkan.'];
    return null;
  }

  // Penahan dasar untuk bot sederhana. Pembatas utama tetap App Check dan aturan server.
  let formDibuka = 0;
  const JEDA_KIRIM = 60000;
  const kunciKirim = id => `lamaran-terkirim-${id}`;
  function baruKirim(id) {
    try { return Date.now() - Number(localStorage.getItem(kunciKirim(id)) || 0) < JEDA_KIRIM; } catch { return false; }
  }

  async function send(l, form) {
    const $ = id => document.getElementById(id), val = id => $(id).value.trim();
    const err = $('a-err'), btn = form.querySelector('button[type=submit]');
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    const fail = (m, field) => {
      err.hidden = false; err.textContent = m; btn.disabled = false; btn.textContent = 'Kirim lamaran';
      if (field) { $(field).setAttribute('aria-invalid', 'true'); $(field).focus(); }
    };
    const v = { nama: val('a-nama'), email: val('a-email'), telepon: val('a-telp'), file: $('a-cv').files[0], setuju: $('a-setuju').checked };
    const problem = validate(v);
    if (problem) { fail(problem[1], problem[0]); return; }
    if ($('a-situs').value || Date.now() - formDibuka < 3000) { fail('Lamaran belum terkirim. Periksa isian Anda lalu coba lagi.'); return; }
    if (baruKirim(l.id)) { fail('Lamaran untuk lowongan ini baru saja terkirim dari perangkat ini. Tunggu satu menit bila ingin mengirim lamaran lain.'); return; }
    err.hidden = true; btn.disabled = true; btn.textContent = 'Mengirim...';
    let text;
    try { text = await BacaCV.read(v.file); } catch (e) { fail(BacaCV.friendlyError(e), 'a-cv'); return; }
    if (text.replace(/\s/g, '').length < 80) { fail('Teks CV tidak terbaca, kemungkinan hasil scan atau foto. Unggah CV yang teksnya bisa dipilih.', 'a-cv'); return; }
    const kode = R.buatKode();
    try {
      await C.submitLamaran(kode, { lowonganId: l.id, nama: v.nama, email: v.email, telepon: v.telepon, fileName: v.file.name.slice(0, 200), size: v.file.size, cvText: text.slice(0, 100000), persetujuan: true, talentPool: $('a-pool').checked, ...(val('a-sumber') ? { sumber: val('a-sumber') } : {}) });
      try { localStorage.setItem(kunciKirim(l.id), String(Date.now())); } catch { /* mode privat */ }
      success(l, kode);
    } catch {
      fail('Lamaran belum terkirim. Lowongan mungkin sudah ditutup, atau koneksi terputus. Silakan coba lagi.');
    }
  }

  function success(l, kode) {
    const shown = R.tampilKode(kode);
    setTitle('Lamaran terkirim');
    app.replaceChildren(buat('section', { class: 'panel done' },
      buat('h1', null, 'Lamaran terkirim'),
      buat('p', null, `Terima kasih telah melamar sebagai ${l.judul}. Simpan kode berikut. Anda memerlukannya untuk melihat hasil seleksi. Jangan bagikan kode ini kepada orang lain.`),
      buat('p', { class: 'kode', id: 'kode' }, shown),
      buat('div', { class: 'inline' }, buat('button', { type: 'button', id: 'copy' }, 'Salin kode'), buat('a', { class: 'linkbtn', href: '#/cek' }, 'Ke halaman Cek hasil')),
      buat('p', { id: 'copy-note', class: 'note', role: 'status', hidden: true })));
    app.focus();
    document.getElementById('copy').addEventListener('click', async () => {
      const n = document.getElementById('copy-note');
      n.hidden = false;
      try { await navigator.clipboard.writeText(shown); n.textContent = 'Kode tersalin.'; } catch { n.textContent = 'Gagal menyalin. Catat kode secara manual.'; }
    });
  }

  function cek() {
    setTitle('Cek hasil');
    app.innerHTML = `<form id="cek" class="panel narrow" novalidate><h1>Cek hasil seleksi</h1>
      <div class="field"><label for="c-kode">Kode lamaran</label><input id="c-kode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="ABCD-EFGH-IJKL-MNOP"></div>
      <button type="submit" class="start">Cek hasil</button>
      <p class="hint">Kehilangan kode? Hubungi kontak HR pada lowongan yang Anda lamar.</p></form><div id="c-out" class="hasil-wrap" role="status"></div>`;
    const form = document.getElementById('cek'), out = document.getElementById('c-out'), input = document.getElementById('c-kode'), btn = form.querySelector('button');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const kode = R.normalKode(input.value);
      if (kode.length !== 16) { pesan(out, 'Kode terdiri dari 16 huruf dan angka. Periksa kembali.', 'warn narrow'); return; }
      pesan(out, 'Memeriksa...', 'note narrow');
      btn.disabled = true;
      try {
        const h = await C.getHasil(kode);
        if (!h) { pesan(out, 'Belum ada data untuk kode ini. Bila Anda baru melamar, lamaran mungkin belum diproses. Periksa juga penulisan kode.', 'warn narrow'); return; }
        // Kode ditutup dari layar supaya tidak ikut terlihat atau tertangkap layar bersama hasilnya.
        input.value = ''; form.hidden = true; out.removeAttribute('role');
        const hasil = hasilEl(h);
        out.replaceChildren(hasil);
        hasil.focus({ preventScroll: true });
        window.scrollTo(0, 0);
        pasangSurvei(kode, h);
        document.getElementById('c-lagi').addEventListener('click', () => {
          out.replaceChildren(); out.setAttribute('role', 'status'); form.hidden = false; input.focus();
        });
      } catch { pesan(out, NET_ERROR, 'warn narrow'); } finally { btn.disabled = false; }
    });
  }

  const kunciSurvei = id => `survei-terisi-${id}`;
  const sudahSurvei = id => { try { return !!localStorage.getItem(kunciSurvei(id)); } catch { return false; } };
  // Formulir survei: dibangun sebagai DOM (statis, tanpa data pelamar).
  function surveiEl() {
    return buat('form', { id: 'survei', class: 'hasil-tindak', novalidate: true },
      buat('h2', null, 'Bagaimana pengalaman Anda?'),
      buat('p', { class: 'hint' }, 'Opsional. Jawaban Anda tidak memengaruhi hasil seleksi, dan tim HR melihatnya tanpa nama atau nomor peserta.'),
      buat('fieldset', { class: 'nilai' }, buat('legend', null, 'Nilai proses seleksi ini'),
        buat('div', { class: 'nilai-isi' }, [1, 2, 3, 4, 5].map(n => buat('label', null, buat('input', { type: 'radio', name: 's-nilai', value: n }), buat('span', null, n)))),
        buat('span', { class: 'hint' }, '1 sangat kurang, 5 sangat baik')),
      buat('div', { class: 'field' }, buat('label', { for: 's-jelas' }, 'Apakah informasi tiap tahap jelas?'),
        buat('select', { id: 's-jelas' }, buat('option', { value: 'ya' }, 'Ya'), buat('option', { value: 'sebagian' }, 'Sebagian'), buat('option', { value: 'tidak' }, 'Tidak'))),
      buat('div', { class: 'field' }, buat('label', { for: 's-komentar' }, 'Saran (opsional)'),
        buat('textarea', { id: 's-komentar', rows: 3, maxlength: 500, placeholder: 'Hindari menulis nama atau data pribadi' })),
      buat('p', { id: 's-note', class: 'note', role: 'status', hidden: true }),
      buat('button', { type: 'submit', class: 'ghost start' }, 'Kirim masukan'));
  }
  function pasangSurvei(kode, h) {
    const form = document.getElementById('survei');
    if (!form) return;
    const note = document.getElementById('s-note'), btn = form.querySelector('button');
    const selesai = () => { form.replaceChildren(buat('h2', null, 'Terima kasih'), buat('p', { class: 'note' }, 'Masukan Anda sudah kami terima.')); try { localStorage.setItem(kunciSurvei(h.lowonganId), '1'); } catch { /* mode privat */ } };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const pilih = form.querySelector('input[name=s-nilai]:checked');
      if (!pilih) { note.hidden = false; note.textContent = 'Pilih nilai 1 sampai 5 terlebih dahulu.'; return; }
      const komentar = document.getElementById('s-komentar').value.trim().slice(0, 500);
      btn.disabled = true;
      try {
        await C.kirimSurvei(kode, { lowonganId: h.lowonganId, nilai: +pilih.value, jelas: document.getElementById('s-jelas').value, ...(komentar ? { komentar } : {}) });
        selesai();
      } catch (err) {
        if (err && err.code === 'permission-denied') { selesai(); return; } // kode ini sudah pernah mengirim
        btn.disabled = false; note.hidden = false; note.textContent = 'Masukan belum terkirim. Coba lagi.';
      }
    });
  }

  function privasi() {
    setTitle('Pemberitahuan privasi');
    app.innerHTML = `<section class="panel privasi"><h1>Pemberitahuan privasi pelamar</h1>
      <p>Pemberitahuan ini menjelaskan cara data lamaran Anda diproses. Pengendali data adalah perusahaan yang tercantum pada lowongan yang Anda lamar.</p>
      <h2>Data yang dikumpulkan</h2><ul><li>Nama, email, dan nomor telepon yang Anda isi.</li><li>Teks dari CV Anda. File aslinya tidak disimpan.</li><li>Hasil tiap tahap seleksi dan catatan penilaian.</li><li>Sumber informasi lowongan dan jawaban survei, bila Anda mengisinya. Survei ditampilkan kepada tim HR tanpa nama atau nomor peserta.</li></ul>
      <h2>Tujuan dan dasar pemrosesan</h2><p>Data dipakai untuk menilai lamaran dan menghubungi Anda selama seleksi, berdasarkan persetujuan yang Anda berikan saat melamar. Bila Anda memilih talent pool, data juga dipakai untuk menawarkan lowongan lain yang sesuai.</p>
      <h2>Penilaian otomatis</h2><p>CV dicocokkan otomatis dengan persyaratan jabatan sebagai rekomendasi awal. Rekomendasi itu tidak menjadi keputusan. Tim HR memeriksa dan memutuskan, dan Anda dapat mengajukan keberatan.</p>
      <h2>Cara kerja penilaian otomatis</h2><p>Aplikasi membaca teks CV lalu mencocokkannya dengan ketentuan yang ditetapkan tim HR untuk lowongan itu, seperti pendidikan, pengalaman, dan keahlian. Pencocokan memakai aturan yang tetap dan tidak memakai pembelajaran mesin.</p>
      <h2>Verifikasi</h2><p>Dokumen hanya diminta sejauh dibutuhkan jabatan. Pemeriksaan latar belakang dilakukan setelah Anda diberi tahu dan memberi persetujuan tertulis.</p>
      <h2>Penyimpanan dan penerima data</h2><ul><li>Data disimpan di layanan Google Firebase, wilayah Jakarta, dan hanya bisa dibuka akun HR yang berwenang.</li><li>Google reCAPTCHA memproses data teknis perangkat untuk mencegah penyalahgunaan.</li><li>Masa simpan tercantum pada persetujuan di formulir lowongan. Setelah itu data dihapus.</li></ul>
      <h2>Pengumuman</h2><p>Portal hanya menampilkan nomor peserta. Nama, kontak, dan skor Anda tidak dipublikasikan di portal.</p>
      <h2>Hak Anda</h2><p>Anda dapat meminta akses, perbaikan, atau penghapusan data, menarik persetujuan, dan mengajukan keberatan atas penilaian otomatis, melalui kontak HR yang tercantum pada lowongan. Menarik persetujuan dapat menghentikan proses seleksi Anda.</p>
    </section>`;
  }

  // Hanya alamat https yang menjadi tautan; teks lain tetap teks biasa. Hasilnya node DOM (teks dan <a>), bukan HTML.
  function tautan(s) {
    return String(s === null || s === undefined ? '' : s).split(/(https:\/\/[^\s<>"']+)/).flatMap((p, i) => {
      if (i % 2 === 0) return p ? [p] : [];
      const url = p.replace(/[.,;:!?)]+$/, ''), sisa = p.slice(url.length);
      let host;
      try { host = new URL(url).hostname; } catch { return [p]; }
      const peta = /(^|\.)maps\.app\.goo\.gl$|^maps\.google\.|^(www\.)?google\.[a-z.]+$/.test(host) && /maps/.test(url);
      const a = buat('a', { class: peta ? 'linkbtn' : '', href: url, target: '_blank', rel: 'noopener noreferrer' }, peta ? 'Buka lokasi di Google Maps' : url);
      return peta || !sisa ? [a] : [a, sisa];
    });
  }

  // Hasil seleksi untuk pemegang kode: data dokumen hasil (dari HR) dipasang sebagai teks, bukan markup.
  function hasilEl(h) {
    const riwayat = h.riwayat || [], alur = (h.alur || []).length ? h.alur : riwayat.map(r => r.nama);
    const lengkap = !!(h.alur || []).length, n = riwayat.length;
    const lolos = riwayat.filter(r => r.status === 'lolos').length;
    const akhir = h.status === 'lolos' && lengkap && n === alur.length, berikut = h.status === 'lolos' && lengkap ? alur[n] : '';
    const kepala = h.status === 'tidak'
      ? ['Belum dapat melanjutkan', `Proses seleksi Anda berhenti pada tahap ${h.tahap ?? ''}. Terima kasih atas waktu dan minat Anda.`]
      : akhir ? ['Selamat, Anda lolos seluruh tahap seleksi', 'Ikuti tindak lanjut dari tim HR di bawah ini.']
        : h.status === 'lolos' ? [`Selamat, Anda lolos tahap ${h.tahap ?? ''}`, berikut ? `Tahap berikutnya: ${berikut}.` : '']
          : ['Lamaran sedang diproses', 'Lamaran Anda sudah kami terima. Hasil tiap tahap akan tampil di halaman ini.'];
    const jenis = h.status === 'tidak' ? 'tidak' : h.status === 'lolos' ? 'lolos' : 'proses';
    const tampil = h.status === 'tidak' ? alur.slice(0, n) : alur;
    const label = { lolos: 'Lolos', tidak: 'Tidak lolos', kini: 'Berlangsung', nanti: '' };
    const langkah = tampil.map((nama, i) => {
      const s = (riwayat[i] || {}).status;
      const k = s === 'lolos' || s === 'tidak' ? s : i === n && h.status !== 'tidak' ? 'kini' : 'nanti';
      return buat('li', { 'data-s': k }, buat('span', { class: 'nama' }, nama), buat('span', { class: 'ket' }, label[k]));
    });
    const catatan = [h.perusahaan, `Nomor peserta ${h.nomor}`].filter(Boolean).join(' · ') + (h.tanggal ? ` · Diperbarui ${R.tanggalId(h.tanggal)}` : '');
    return buat('section', { class: 'hasil', tabindex: '-1' },
      buat('header', { class: 'hasil-top' }, buat('p', { class: 'eyebrow' }, 'Hasil seleksi'), buat('h1', null, h.posisi), buat('p', { class: 'note' }, catatan)),
      buat('div', { class: 'hasil-status', 'data-s': jenis }, buat('span', { class: 'ikon', 'aria-hidden': 'true' }),
        buat('div', null, buat('h2', null, kepala[0]), kepala[1] ? buat('p', null, kepala[1]) : null)),
      h.pesan ? buat('div', { class: 'hasil-tindak' }, buat('h2', null, 'Tindak lanjut'), buat('p', { class: 'pre' }, tautan(h.pesan))) : null,
      langkah.length ? buat('div', { class: 'hasil-alur' },
        buat('div', { class: 'hasil-alur-top' }, buat('h2', null, 'Perjalanan seleksi'), lengkap ? buat('span', { class: 'note' }, `${lolos} dari ${alur.length} tahap`) : null),
        buat('ol', { class: 'linimasa' }, langkah)) : null,
      h.lowonganId && h.status !== 'proses' && !sudahSurvei(h.lowonganId) ? surveiEl() : null,
      buat('div', { class: 'hasil-kaki' }, buat('button', { type: 'button', class: 'ghost', id: 'c-lagi' }, 'Cek kode lain'),
        buat('p', { class: 'hint' }, `${h.kontak ? `Ada pertanyaan tentang hasil ini? Hubungi ${h.kontak}. ` : ''}Simpan kode lamaran Anda dan jangan bagikan kepada orang lain.`)));
  }

  async function route() {
    if (!C.enabled()) { pesan(app, 'Portal lowongan belum tersedia.'); return; }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    document.getElementById('hero').hidden = !!parts[0];
    pesan(app, 'Memuat...');
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'cek') cek();
      else if (parts[0] === 'privasi') privasi();
      else if (parts[0] === 'l' && parts[1]) await detail(decodeURIComponent(parts[1]));
      else await home();
      app.focus({ preventScroll: true });
    } catch {
      pesan(app, NET_ERROR);
    }
  }

  document.getElementById('cari').addEventListener('submit', e => { e.preventDefault(); saring.q = document.getElementById('q').value.trim(); daftar(); });
  document.getElementById('q').addEventListener('input', e => { saring.q = e.target.value.trim(); daftar(); });
  document.getElementById('lok').addEventListener('change', e => { saring.lok = e.target.value; daftar(); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.BACA_CV_LOKAL) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker tidak terpasang:', e && e.message)); // tampilan tetap terbuka saat offline
  app.addEventListener('click', e => {
    const c = e.target.closest('#chips [data-s]');
    if (!c) return;
    saring.status = c.dataset.s;
    daftar();
    document.querySelector(`#chips [data-s="${saring.status}"]`).focus(); // fokus papan ketik tidak hilang
  });
  window.addEventListener('hashchange', route);
  route();
})();
