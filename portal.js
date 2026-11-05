// Portal publik untuk pelamar: daftar lowongan, formulir lamaran, cek hasil dengan kode, dan pengumuman.
(function () {
  'use strict';
  const R = window.Rekrutmen, C = window.Cloud;
  const app = document.getElementById('app');
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NET_ERROR = 'Tidak bisa tersambung ke server. Periksa koneksi internet lalu coba lagi.';

  const tutupMs = l => (l.tutupPada && l.tutupPada.toMillis ? l.tutupPada.toMillis() : l.tutupPada ? new Date(l.tutupPada).getTime() : 0);
  const dibuka = l => l.status === 'buka' && tutupMs(l) > Date.now();
  const siap = l => !!(l.perusahaan && l.kontak && l.retensi); // tanpa ini pelamar tidak tahu siapa yang memegang datanya

  function meta(l) {
    return [l.perusahaan, l.lokasiKerja, l.tenggat ? `Tenggat ${R.tanggalId(l.tenggat)}` : ''].filter(Boolean).join(' · ');
  }

  async function home() {
    const list = (await C.listLowongan()).sort((a, b) => dibuka(b) - dibuka(a) || a.judul.localeCompare(b.judul));
    app.innerHTML = list.length ? `<div class="jobs">${list.map(l => `<a class="job" href="#/l/${esc(l.id)}">
        <span class="job-head"><strong>${esc(l.judul)}</strong><span class="badge ${dibuka(l) ? 'b-lolos' : 'b-none'}">${dibuka(l) ? 'Dibuka' : 'Ditutup'}</span></span>
        <small>${esc(meta(l))}</small></a>`).join('')}</div>`
      : '<div class="empty">Belum ada lowongan saat ini.</div>';
  }

  function announceHtml(p) {
    const list = a => (a.length ? `<ol class="nomor">${a.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : '<p>Tidak ada.</p>');
    return `<details class="panel"><summary>Hasil ${esc(p.tahap)}${p.tanggal ? ` (${esc(R.tanggalId(p.tanggal))})` : ''}</summary>
      <h4 class="pass">Dinyatakan lolos (${p.lolos.length} peserta)</h4>${list(p.lolos)}
      <h4 class="fail">Tidak lolos (${p.tidak.length} peserta)</h4>${list(p.tidak)}
      ${p.tindak ? `<h4>Tindak lanjut</h4><p class="pre">${esc(p.tindak)}</p>` : ''}</details>`;
  }

  function formHtml(l) {
    return `<form id="apply" class="panel" novalidate>
      <h3>Kirim lamaran</h3>
      <div class="field"><label for="a-nama">Nama lengkap</label><input id="a-nama" type="text" maxlength="100" autocomplete="name" required></div>
      <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" maxlength="120" autocomplete="email" required></div>
      <div class="field"><label for="a-telp">Nomor telepon</label><input id="a-telp" type="tel" maxlength="20" autocomplete="tel" required></div>
      <div class="field"><label for="a-cv">File CV</label><input id="a-cv" type="file" accept=".pdf,.docx,.txt" required>
        <span class="hint">PDF, DOCX, atau TXT, maksimal 15 MB. CV hasil scan atau foto tidak bisa dibaca.</span></div>
      <div class="hp" aria-hidden="true"><label>Situs <input id="a-situs" type="text" tabindex="-1" autocomplete="off"></label></div>
      <div class="field"><label class="consent"><input id="a-setuju" type="checkbox"> <span>Saya menyetujui ${esc(l.perusahaan)} memproses data pribadi dan isi CV saya untuk seleksi ${esc(l.judul)}, dan menyimpannya paling lama ${esc(l.retensi)}. Saya dapat meminta data saya diakses, diperbaiki, atau dihapus melalui ${esc(l.kontak)}.</span></label></div>
      <p id="a-err" class="warn" role="alert" hidden></p>
      <button type="submit" class="start">Kirim lamaran</button>
    </form>`;
  }

  async function detail(id) {
    const [l, ann] = await Promise.all([C.getLowongan(id), C.listPengumuman(id)]);
    if (!l) { app.innerHTML = '<div class="empty">Lowongan tidak ditemukan.</div>'; return; }
    ann.sort((a, b) => b.urutan - a.urutan);
    const closed = !dibuka(l) ? '<div class="empty">Pendaftaran untuk lowongan ini sudah ditutup.</div>'
      : !siap(l) ? '<div class="empty">Pendaftaran untuk lowongan ini belum dibuka.</div>' : '';
    app.innerHTML = `<a class="back" href="#/">Semua lowongan</a>
      <div class="two"><section class="panel"><h2>${esc(l.judul)}</h2><p class="note">${esc(meta(l))}</p>
        ${l.deskripsi ? `<h3>Deskripsi pekerjaan</h3><p class="pre">${esc(l.deskripsi)}</p>` : ''}
        ${l.persyaratan ? `<h3>Persyaratan</h3><p class="pre">${esc(l.persyaratan)}</p>` : ''}
      </section><div class="stack">${closed || formHtml(l)}${ann.length ? `<section class="stack"><h3>Pengumuman</h3>${ann.map(announceHtml).join('')}<p class="hint">Hanya nomor peserta yang ditampilkan. Nomor Anda ada di halaman Cek hasil.</p></section>` : ''}</div></div>`;
    const form = document.getElementById('apply');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send(l, form); });
  }

  function validate(v) {
    if (v.nama.length < 2) return 'Isi nama lengkap Anda.';
    if (!/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(v.email)) return 'Periksa kembali alamat email Anda.';
    if (!/^[+0-9 ()-]{8,20}$/.test(v.telepon)) return 'Periksa kembali nomor telepon Anda.';
    if (!v.file) return 'Pilih file CV Anda.';
    if (!v.setuju) return 'Centang persetujuan pemrosesan data untuk melanjutkan.';
    return '';
  }

  async function send(l, form) {
    const val = id => document.getElementById(id).value.trim();
    const err = document.getElementById('a-err'), btn = form.querySelector('button[type=submit]');
    const fail = m => { err.hidden = false; err.textContent = m; btn.disabled = false; btn.textContent = 'Kirim lamaran'; };
    const v = { nama: val('a-nama'), email: val('a-email'), telepon: val('a-telp'), file: document.getElementById('a-cv').files[0], setuju: document.getElementById('a-setuju').checked };
    const problem = validate(v);
    if (problem) { fail(problem); return; }
    err.hidden = true; btn.disabled = true; btn.textContent = 'Mengirim...';
    const kode = R.buatKode();
    if (val('a-situs')) { success(l, kode); return; } // isian jebakan untuk bot: pura-pura berhasil, tidak ada yang dikirim
    let text;
    try { text = await BacaCV.read(v.file); } catch (e) { fail(BacaCV.friendlyError(e)); return; }
    if (text.replace(/\s/g, '').length < 80) { fail('Teks CV tidak terbaca, kemungkinan hasil scan atau foto. Unggah CV yang teksnya bisa dipilih.'); return; }
    try {
      await C.submitLamaran(kode, { lowonganId: l.id, nama: v.nama, email: v.email, telepon: v.telepon, fileName: v.file.name.slice(0, 200), size: v.file.size, cvText: text.slice(0, 200000), persetujuan: true });
      success(l, kode);
    } catch (e) {
      fail('Lamaran belum terkirim. Lowongan mungkin sudah ditutup, atau koneksi terputus. Silakan coba lagi.');
    }
  }

  function success(l, kode) {
    const shown = R.tampilKode(kode);
    app.innerHTML = `<section class="panel done"><h2>Lamaran terkirim</h2>
      <p>Terima kasih telah melamar sebagai ${esc(l.judul)}. Simpan kode berikut. Anda memerlukannya untuk melihat hasil seleksi. Jangan bagikan kode ini kepada orang lain.</p>
      <p class="kode" id="kode">${esc(shown)}</p>
      <div class="inline"><button type="button" id="copy">Salin kode</button><a class="linkbtn" href="#/cek">Ke halaman Cek hasil</a></div>
      <p id="copy-note" class="note" role="status" hidden></p></section>`;
    document.getElementById('copy').addEventListener('click', async () => {
      const n = document.getElementById('copy-note');
      n.hidden = false;
      try { await navigator.clipboard.writeText(shown); n.textContent = 'Kode tersalin.'; } catch (e) { n.textContent = 'Gagal menyalin. Catat kode secara manual.'; }
    });
  }

  function cek() {
    app.innerHTML = `<form id="cek" class="panel narrow" novalidate><h2>Cek hasil seleksi</h2>
      <div class="field"><label for="c-kode">Kode lamaran</label><input id="c-kode" type="text" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH-IJKL-MNOP"></div>
      <button type="submit" class="start">Cek hasil</button></form><div id="c-out" class="narrow stack" role="status"></div>`;
    document.getElementById('cek').addEventListener('submit', async e => {
      e.preventDefault();
      const out = document.getElementById('c-out'), kode = R.normalKode(document.getElementById('c-kode').value);
      if (kode.length !== 16) { out.innerHTML = '<p class="warn">Kode terdiri dari 16 huruf dan angka. Periksa kembali.</p>'; return; }
      out.innerHTML = '<p class="note">Memeriksa...</p>';
      try {
        const h = await C.getHasil(kode);
        out.innerHTML = h ? hasilHtml(h) : '<p class="warn">Belum ada data untuk kode ini. Bila Anda baru melamar, lamaran mungkin belum diproses. Periksa juga penulisan kode.</p>';
      } catch (err) { out.innerHTML = `<p class="warn">${NET_ERROR}</p>`; }
    });
  }

  function hasilHtml(h) {
    const line = { lolos: 'Lolos', tidak: 'Tidak lolos' };
    const head = h.status === 'tidak'
      ? `<p class="status fail">Mohon maaf, Anda belum dapat melanjutkan setelah tahap ${esc(h.tahap)}.</p><p>Terima kasih atas waktu dan minat Anda.</p>`
      : h.status === 'lolos' ? `<p class="status pass">Selamat, Anda lolos tahap ${esc(h.tahap)}.</p>`
        : '<p class="status">Lamaran Anda sudah diterima dan sedang diproses.</p>';
    return `<section class="panel"><h3>${esc(h.posisi)}</h3><p class="note">${esc(h.perusahaan)} · Nomor peserta ${esc(h.nomor)}</p>${head}
      ${h.pesan ? `<h4>Tindak lanjut</h4><p class="pre">${esc(h.pesan)}</p>` : ''}
      ${(h.riwayat || []).length ? `<ul class="riwayat">${h.riwayat.map(r => `<li><span>${esc(r.nama)}</span><span class="badge b-${r.status === 'lolos' ? 'lolos' : 'tidak'}">${line[r.status]}</span></li>`).join('')}</ul>` : ''}</section>`;
  }

  async function route() {
    if (!C.enabled()) { app.innerHTML = '<div class="empty">Portal lowongan belum tersedia.</div>'; return; }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    app.innerHTML = '<div class="empty">Memuat...</div>';
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'cek') cek();
      else if (parts[0] === 'l' && parts[1]) await detail(decodeURIComponent(parts[1]));
      else await home();
    } catch (e) {
      app.innerHTML = `<div class="empty">${NET_ERROR}</div>`;
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
