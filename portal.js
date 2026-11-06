// Portal publik untuk pelamar: daftar lowongan, formulir lamaran, cek hasil dengan kode, dan pengumuman.
(function () {
  'use strict';
  const R = window.Rekrutmen, C = window.Cloud;
  const app = document.getElementById('app');
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NET_ERROR = 'Tidak bisa tersambung ke server. Periksa koneksi internet lalu coba lagi.';

  const tutupMs = l => (l.tutupPada && l.tutupPada.toMillis ? l.tutupPada.toMillis() : l.tutupPada ? new Date(l.tutupPada).getTime() : 0);
  const dibuka = l => l.status === 'buka' && tutupMs(l) > Date.now() && !l.contoh;
  const siap = l => !!(l.perusahaan && l.kontak && l.retensi); // tanpa ini pelamar tidak tahu siapa yang memegang datanya
  const badgeOf = l => (l.contoh ? '<span class="badge b-cek">Contoh</span>' : `<span class="badge ${dibuka(l) ? 'b-lolos' : 'b-none'}">${dibuka(l) ? 'Dibuka' : 'Ditutup'}</span>`);

  function meta(l) {
    return [l.perusahaan, l.lokasiKerja, l.tenggat ? `Tenggat ${R.tanggalId(l.tenggat)}` : ''].filter(Boolean).join(' · ');
  }

  const setTitle = t => { document.title = t ? `${t} | Lowongan Kerja` : 'Lowongan Kerja'; };

  const inisial = s => (String(s || '').replace(/\b(PT|CV|Tbk)\b\.?/gi, '').match(/[\p{L}\p{N}]+/gu) || ['L']).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const logo = l => (R.logoSah(l.logo) ? `<span class="logo logo-img" aria-hidden="true"><img src="${esc(l.logo)}" alt=""></span>` : `<span class="logo" aria-hidden="true">${esc(inisial(l.perusahaan || l.judul))}</span>`);
  const cuplikan = s => {
    const t = String(s || '').split('\n').map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(x => x && !x.endsWith(':')).join('. ').replace(/\.\. /g, '. ');
    return t.length > 170 ? `${t.slice(0, 170).replace(/\s\S*$/, '').replace(/[.,;:]+$/, '')}...` : t;
  };

  let semua = [], dimuat = 0;
  const saring = { q: '', lok: '', status: 'semua' };
  const STATUS = [['semua', 'Semua'], ['buka', 'Dibuka'], ['tutup', 'Ditutup']];

  function kartu(l) {
    const foot = l.contoh ? 'Lowongan contoh' : dibuka(l) ? (l.tenggat ? `Melamar sampai ${R.tanggalId(l.tenggat)}` : 'Menerima lamaran') : 'Pendaftaran ditutup';
    return `<a class="job" href="#/l/${esc(l.id)}">${logo(l)}<span class="job-body">
      <span class="job-head"><strong>${esc(l.judul)}</strong>${badgeOf(l)}</span>
      <span class="job-co">${esc([l.perusahaan, l.lokasiKerja].filter(Boolean).join(' · '))}</span>
      ${l.deskripsi ? `<span class="job-sn">${esc(cuplikan(l.deskripsi))}</span>` : ''}
      <small class="job-ft">${esc(foot)}</small></span></a>`;
  }

  function daftar() {
    const box = document.getElementById('hasil');
    if (!box) return;
    const q = saring.q.toLowerCase();
    const list = semua.filter(l => (!q || `${l.judul} ${l.perusahaan} ${l.deskripsi} ${l.persyaratan}`.toLowerCase().includes(q))
      && (!saring.lok || l.lokasiKerja === saring.lok)
      && (saring.status === 'semua' || (saring.status === 'buka') === dibuka(l)));
    document.getElementById('jumlah').textContent = `${list.length} lowongan`;
    box.innerHTML = list.length ? list.map(kartu).join('') : `<div class="empty">${semua.length ? 'Tidak ada lowongan yang cocok dengan pencarian ini.' : 'Belum ada lowongan yang dibuka saat ini.'}</div>`;
    document.getElementById('chips').innerHTML = STATUS.map(([k, v]) => `<button type="button" class="chip" data-s="${k}" aria-pressed="${saring.status === k}">${v}</button>`).join('');
  }

  async function home() {
    setTitle('');
    // Daftar disimpan sebentar agar pindah halaman tidak membaca server lagi.
    if (Date.now() - dimuat > 60000) { semua = await C.listLowongan(); dimuat = Date.now(); }
    semua = semua.filter(l => l.status !== 'draf').sort((a, b) => dibuka(b) - dibuka(a) || a.judul.localeCompare(b.judul));
    const lok = document.getElementById('lok'), pilih = saring.lok;
    lok.innerHTML = '<option value="">Semua lokasi</option>' + [...new Set(semua.map(l => l.lokasiKerja).filter(Boolean))].sort().map(x => `<option${x === pilih ? ' selected' : ''}>${esc(x)}</option>`).join('');
    app.innerHTML = `<div class="beranda"><section aria-labelledby="jumlah"><div class="result-head"><h2 id="jumlah" role="status"></h2><div id="chips" class="chips" role="group" aria-label="Saring status lowongan"></div></div><div id="hasil" class="results"></div></section>
      <aside class="trust" aria-label="Informasi pelamar">
        <div><strong>Tanpa biaya</strong>Melamar dan mengikuti seleksi tidak dipungut biaya.</div>
        <div><strong>Kesempatan setara</strong>Penilaian berdasarkan kemampuan yang dibutuhkan pekerjaan.</div>
        <div><strong>Hasil transparan</strong>Pantau hasil tiap tahap dengan kode lamaran Anda.</div>
        <a class="linkbtn" href="#/cek">Cek hasil seleksi</a>
      </aside></div>`;
    daftar();
  }

  function announceHtml(p) {
    const list = a => (a.length ? `<ol class="nomor">${a.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : '<p>Tidak ada.</p>');
    return `<details class="panel"><summary>Hasil ${esc(p.tahap)}${p.tanggal ? ` (${esc(R.tanggalId(p.tanggal))})` : ''}</summary>
      <h4 class="pass">Dinyatakan lolos (${p.lolos.length} peserta)</h4>${list(p.lolos)}
      <h4 class="fail">Tidak lolos (${p.tidak.length} peserta)</h4>${list(p.tidak)}
    </details>`;
  }

  function alurHtml(l) {
    if (!(l.alur || []).length) return '';
    return `<h3>Alur seleksi</h3><ol class="steps">${l.alur.map(t => `<li><div><strong>${esc(t.nama)}</strong><span>${esc(t.keterangan)}</span></div></li>`).join('')}</ol>`;
  }

  function fieldInput(id, label, attrs) {
    return `<div class="field"><label for="${id}">${label} <span class="req" aria-hidden="true">*</span></label><input id="${id}" required aria-required="true" aria-describedby="a-err" ${attrs}></div>`;
  }

  function formHtml(l) {
    return `<form id="apply" class="panel" novalidate>
      <h3>Kirim lamaran</h3>
      <div class="jebak" aria-hidden="true"><label for="a-situs">Situs web</label><input id="a-situs" type="text" tabindex="-1" autocomplete="off"></div>
      ${fieldInput('a-nama', 'Nama lengkap', 'type="text" maxlength="100" autocomplete="name"')}
      ${fieldInput('a-email', 'Email', 'type="email" maxlength="120" autocomplete="email"')}
      ${fieldInput('a-telp', 'Nomor telepon', 'type="tel" maxlength="20" autocomplete="tel"')}
      <div class="field"><label for="a-cv">File CV <span class="req" aria-hidden="true">*</span></label><input id="a-cv" type="file" accept=".pdf,.docx,.txt" required aria-required="true" aria-describedby="a-cv-h a-err">
        <span class="hint" id="a-cv-h">PDF, DOCX, atau TXT, maksimal 15 MB. CV hasil scan atau foto tidak bisa dibaca.</span></div>
      <div class="field"><label class="consent"><input id="a-setuju" type="checkbox" aria-describedby="a-err"> <span>Saya menyetujui ${esc(l.perusahaan)} memproses data pribadi dan isi CV saya untuk seleksi ${esc(l.judul)}, dan menyimpannya paling lama ${esc(l.retensi)}. Saya dapat meminta data saya diakses, diperbaiki, atau dihapus melalui ${esc(l.kontak)}.</span></label>
        <label class="consent"><input id="a-pool" type="checkbox"> <span>Opsional: simpan data saya untuk ditawari lowongan lain yang sesuai selama masa simpan di atas.</span></label>
        <span class="hint">CV dicocokkan otomatis dengan persyaratan sebagai rekomendasi awal. Keputusan tetap dibuat oleh tim HR, dan Anda dapat mengajukan keberatan melalui kontak di atas.</span>
        <span class="hint">Butuh penyesuaian seleksi karena disabilitas? Hubungi ${esc(l.kontak)}.</span>
        <span class="hint"><a href="#/privasi">Baca pemberitahuan privasi pelamar</a></span></div>
      <p id="a-err" class="warn" role="alert" hidden></p>
      <button type="submit" class="start">Kirim lamaran</button>
    </form>`;
  }

  async function detail(id) {
    const tersimpan = Date.now() - dimuat < 60000 ? semua.find(x => x.id === id) : null;
    const [l, ann] = await Promise.all([tersimpan || C.getLowongan(id), C.listPengumuman(id).catch(() => [])]);
    if (!l || l.status === 'draf') { setTitle('Tidak ditemukan'); app.innerHTML = '<div class="empty">Lowongan tidak ditemukan.</div>'; return; }
    setTitle(l.judul);
    ann.sort((a, b) => b.urutan - a.urutan);
    const closed = l.contoh ? '<div class="info">Ini lowongan contoh untuk memperlihatkan alur seleksi. Lowongan ini tidak menerima lamaran.</div>'
      : !dibuka(l) ? '<div class="empty">Pendaftaran untuk lowongan ini sudah ditutup.</div>'
        : !siap(l) ? '<div class="empty">Pendaftaran untuk lowongan ini belum dibuka.</div>' : '';
    const bisa = !closed;
    app.innerHTML = `<a class="back" href="#/">Semua lowongan</a>
      <section class="job-top">${logo(l)}<div class="job-top-in"><div class="job-head">${badgeOf(l)}<h2>${esc(l.judul)}</h2></div><p class="note">${esc(meta(l))}</p></div>
        ${bisa ? '<button type="button" id="to-apply">Lamar sekarang</button>' : ''}</section>
      <div class="two"><section class="panel">
        ${l.deskripsi ? `<h3>Deskripsi pekerjaan</h3><p class="pre">${esc(l.deskripsi)}</p>` : ''}
        ${l.persyaratan ? `<h3>Persyaratan</h3><p class="pre">${esc(l.persyaratan)}</p>` : ''}
        ${alurHtml(l)}
      </section><div class="stack">${closed || formHtml(l)}${ann.length ? `<section class="stack"><h3>Pengumuman</h3>${ann.map(announceHtml).join('')}<p class="hint">Hanya nomor peserta yang ditampilkan. Nomor Anda ada di halaman Cek hasil.</p></section>` : ''}</div></div>`;
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
    try { return Date.now() - Number(localStorage.getItem(kunciKirim(id)) || 0) < JEDA_KIRIM; } catch (e) { return false; }
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
      await C.submitLamaran(kode, { lowonganId: l.id, nama: v.nama, email: v.email, telepon: v.telepon, fileName: v.file.name.slice(0, 200), size: v.file.size, cvText: text.slice(0, 100000), persetujuan: true, talentPool: $('a-pool').checked });
      try { localStorage.setItem(kunciKirim(l.id), String(Date.now())); } catch (e) { /* mode privat */ }
      success(l, kode);
    } catch (e) {
      fail('Lamaran belum terkirim. Lowongan mungkin sudah ditutup, atau koneksi terputus. Silakan coba lagi.');
    }
  }

  function success(l, kode) {
    const shown = R.tampilKode(kode);
    setTitle('Lamaran terkirim');
    app.innerHTML = `<section class="panel done"><h2>Lamaran terkirim</h2>
      <p>Terima kasih telah melamar sebagai ${esc(l.judul)}. Simpan kode berikut. Anda memerlukannya untuk melihat hasil seleksi. Jangan bagikan kode ini kepada orang lain.</p>
      <p class="kode" id="kode">${esc(shown)}</p>
      <div class="inline"><button type="button" id="copy">Salin kode</button><a class="linkbtn" href="#/cek">Ke halaman Cek hasil</a></div>
      <p id="copy-note" class="note" role="status" hidden></p></section>`;
    app.focus();
    document.getElementById('copy').addEventListener('click', async () => {
      const n = document.getElementById('copy-note');
      n.hidden = false;
      try { await navigator.clipboard.writeText(shown); n.textContent = 'Kode tersalin.'; } catch (e) { n.textContent = 'Gagal menyalin. Catat kode secara manual.'; }
    });
  }

  function cek() {
    setTitle('Cek hasil');
    app.innerHTML = `<form id="cek" class="panel narrow" novalidate><h2>Cek hasil seleksi</h2>
      <div class="field"><label for="c-kode">Kode lamaran</label><input id="c-kode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="ABCD-EFGH-IJKL-MNOP"></div>
      <button type="submit" class="start">Cek hasil</button>
      <p class="hint">Kehilangan kode? Hubungi kontak HR pada lowongan yang Anda lamar.</p></form><div id="c-out" class="hasil-wrap" role="status"></div>`;
    const form = document.getElementById('cek'), out = document.getElementById('c-out'), input = document.getElementById('c-kode'), btn = form.querySelector('button');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const kode = R.normalKode(input.value);
      if (kode.length !== 16) { out.innerHTML = '<p class="warn narrow">Kode terdiri dari 16 huruf dan angka. Periksa kembali.</p>'; return; }
      out.innerHTML = '<p class="note narrow">Memeriksa...</p>';
      btn.disabled = true;
      try {
        const h = await C.getHasil(kode);
        if (!h) { out.innerHTML = '<p class="warn narrow">Belum ada data untuk kode ini. Bila Anda baru melamar, lamaran mungkin belum diproses. Periksa juga penulisan kode.</p>'; return; }
        // Kode ditutup dari layar supaya tidak ikut terlihat atau tertangkap layar bersama hasilnya.
        input.value = ''; form.hidden = true; out.removeAttribute('role');
        out.innerHTML = hasilHtml(h);
        const hasil = out.querySelector('.hasil');
        hasil.focus({ preventScroll: true });
        window.scrollTo(0, 0);
        document.getElementById('c-lagi').addEventListener('click', () => {
          out.innerHTML = ''; out.setAttribute('role', 'status'); form.hidden = false; input.focus();
        });
      } catch (err) { out.innerHTML = `<p class="warn narrow">${NET_ERROR}</p>`; } finally { btn.disabled = false; }
    });
  }

  function privasi() {
    setTitle('Pemberitahuan privasi');
    app.innerHTML = `<section class="panel privasi"><h2>Pemberitahuan privasi pelamar</h2>
      <p>Pemberitahuan ini menjelaskan cara data lamaran Anda diproses. Pengendali data adalah perusahaan yang tercantum pada lowongan yang Anda lamar.</p>
      <h3>Data yang dikumpulkan</h3><ul><li>Nama, email, dan nomor telepon yang Anda isi.</li><li>Teks dari CV Anda. File aslinya tidak disimpan.</li><li>Hasil tiap tahap seleksi dan catatan penilaian.</li></ul>
      <h3>Tujuan dan dasar pemrosesan</h3><p>Data dipakai untuk menilai lamaran dan menghubungi Anda selama seleksi, berdasarkan persetujuan yang Anda berikan saat melamar. Bila Anda memilih talent pool, data juga dipakai untuk menawarkan lowongan lain yang sesuai.</p>
      <h3>Penilaian otomatis</h3><p>CV dicocokkan otomatis dengan persyaratan jabatan sebagai rekomendasi awal. Rekomendasi itu tidak menjadi keputusan. Tim HR memeriksa dan memutuskan, dan Anda dapat mengajukan keberatan.</p>
      <h3>Penyimpanan dan penerima data</h3><ul><li>Data disimpan di layanan Google Firebase, wilayah Jakarta, dan hanya bisa dibuka akun HR yang berwenang.</li><li>Google reCAPTCHA memproses data teknis perangkat untuk mencegah penyalahgunaan.</li><li>Masa simpan tercantum pada persetujuan di formulir lowongan. Setelah itu data dihapus.</li></ul>
      <h3>Pengumuman</h3><p>Portal hanya menampilkan nomor peserta. Nama, kontak, dan skor Anda tidak dipublikasikan di portal.</p>
      <h3>Hak Anda</h3><p>Anda dapat meminta akses, perbaikan, atau penghapusan data, menarik persetujuan, dan mengajukan keberatan atas penilaian otomatis, melalui kontak HR yang tercantum pada lowongan. Menarik persetujuan dapat menghentikan proses seleksi Anda.</p>
    </section>`;
  }

  // Hanya alamat https yang menjadi tautan; teks lain tetap teks biasa.
  function tautan(s) {
    return String(s === null || s === undefined ? '' : s).split(/(https:\/\/[^\s<>"']+)/).map((p, i) => {
      if (i % 2 === 0) return esc(p);
      const url = p.replace(/[.,;:!?)]+$/, ''), sisa = p.slice(url.length);
      let host = '';
      try { host = new URL(url).hostname; } catch (e) { return esc(p); }
      const peta = /(^|\.)maps\.app\.goo\.gl$|^maps\.google\.|^(www\.)?google\.[a-z.]+$/.test(host) && /maps/.test(url);
      return `<a class="${peta ? 'linkbtn' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${peta ? 'Buka lokasi di Google Maps' : esc(url)}</a>${peta ? '' : esc(sisa)}`;
    }).join('');
  }

  function hasilHtml(h) {
    const riwayat = h.riwayat || [], alur = (h.alur || []).length ? h.alur : riwayat.map(r => r.nama);
    const lengkap = !!(h.alur || []).length, n = riwayat.length;
    const lolos = riwayat.filter(r => r.status === 'lolos').length;
    const akhir = h.status === 'lolos' && lengkap && n === alur.length, berikut = h.status === 'lolos' && lengkap ? alur[n] : '';
    const kepala = h.status === 'tidak'
      ? ['Belum dapat melanjutkan', `Proses seleksi Anda berhenti pada tahap ${esc(h.tahap)}. Terima kasih atas waktu dan minat Anda.`]
      : akhir ? ['Selamat, Anda lolos seluruh tahap seleksi', 'Ikuti tindak lanjut dari tim HR di bawah ini.']
        : h.status === 'lolos' ? [`Selamat, Anda lolos tahap ${esc(h.tahap)}`, berikut ? `Tahap berikutnya: ${esc(berikut)}.` : '']
          : ['Lamaran sedang diproses', 'Lamaran Anda sudah kami terima. Hasil tiap tahap akan tampil di halaman ini.'];
    const jenis = h.status === 'tidak' ? 'tidak' : h.status === 'lolos' ? 'lolos' : 'proses';
    const tampil = h.status === 'tidak' ? alur.slice(0, n) : alur;
    const label = { lolos: 'Lolos', tidak: 'Tidak lolos', kini: 'Berlangsung', nanti: '' };
    const langkah = tampil.map((nama, i) => {
      const s = (riwayat[i] || {}).status;
      const k = s === 'lolos' || s === 'tidak' ? s : i === n && h.status !== 'tidak' ? 'kini' : 'nanti';
      return `<li data-s="${k}"><span class="nama">${esc(nama)}</span><span class="ket">${label[k]}</span></li>`;
    }).join('');
    return `<section class="hasil" tabindex="-1">
      <header class="hasil-top"><p class="eyebrow">Hasil seleksi</p><h2>${esc(h.posisi)}</h2>
        <p class="note">${esc([h.perusahaan, `Nomor peserta ${h.nomor}`].filter(Boolean).join(' · '))}${h.tanggal ? ` · Diperbarui ${esc(R.tanggalId(h.tanggal))}` : ''}</p></header>
      <div class="hasil-status" data-s="${jenis}"><span class="ikon" aria-hidden="true"></span><div><h3>${kepala[0]}</h3>${kepala[1] ? `<p>${kepala[1]}</p>` : ''}</div></div>
      ${h.pesan ? `<div class="hasil-tindak"><h3>Tindak lanjut</h3><p class="pre">${tautan(h.pesan)}</p></div>` : ''}
      ${langkah ? `<div class="hasil-alur"><div class="hasil-alur-top"><h3>Perjalanan seleksi</h3>${lengkap ? `<span class="note">${lolos} dari ${alur.length} tahap</span>` : ''}</div><ol class="linimasa">${langkah}</ol></div>` : ''}
      <div class="hasil-kaki"><button type="button" class="ghost" id="c-lagi">Cek kode lain</button><p class="hint">Simpan kode lamaran Anda dan jangan bagikan kepada orang lain.</p></div>
    </section>`;
  }

  async function route() {
    if (!C.enabled()) { app.innerHTML = '<div class="empty">Portal lowongan belum tersedia.</div>'; return; }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    document.getElementById('hero').hidden = !!parts[0];
    app.innerHTML = '<div class="empty">Memuat...</div>';
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'cek') cek();
      else if (parts[0] === 'privasi') privasi();
      else if (parts[0] === 'l' && parts[1]) await detail(decodeURIComponent(parts[1]));
      else await home();
      app.focus({ preventScroll: true });
    } catch (e) {
      app.innerHTML = `<div class="empty">${NET_ERROR}</div>`;
    }
  }

  document.getElementById('cari').addEventListener('submit', e => { e.preventDefault(); saring.q = document.getElementById('q').value.trim(); daftar(); });
  document.getElementById('q').addEventListener('input', e => { saring.q = e.target.value.trim(); daftar(); });
  document.getElementById('lok').addEventListener('change', e => { saring.lok = e.target.value; daftar(); });
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
