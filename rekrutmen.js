// Aturan tahapan seleksi dan penyusunan pengumuman. Tidak menyentuh tampilan.
(function (root) {
  'use strict';

  // Halaman ini tidak boleh dimuat di dalam situs lain (mencegah clickjacking; GitHub Pages tidak bisa memasang header).
  if (typeof window !== 'undefined' && window.top !== window.self) document.documentElement.innerHTML = '';

  // Urutan mengikuti alur attract, assess, decide, pre-boarding. Pemeriksaan kesehatan ditaruh setelah penawaran bersyarat.
  const DEFAULT_TAHAP = [
    { nama: 'Seleksi Administrasi', keterangan: 'Tim HR memeriksa kesesuaian CV dengan persyaratan jabatan.', pelaksana: 'Tim HR', targetHari: 5 },
    { nama: 'Asesmen Kompetensi', keterangan: 'Tes keterampilan kerja sesuai jabatan. Psikotes, bila dipakai, dijalankan oleh psikolog berizin.', pelaksana: 'Tim HR dan psikolog', targetHari: 7 },
    { nama: 'Wawancara HR', keterangan: 'Wawancara terstruktur tentang pengalaman dan cara kerja, dengan pertanyaan yang sama untuk semua peserta.', pelaksana: 'Tim HR', targetHari: 5 },
    { nama: 'Wawancara Teknis', keterangan: 'Panel dari unit kerja menilai kemampuan teknis memakai lembar penilaian yang sama.', pelaksana: 'Panel unit kerja', targetHari: 5 },
    { nama: 'Verifikasi Dokumen dan Referensi', keterangan: 'Pemeriksaan salinan ijazah, sertifikat, dan referensi atas persetujuan Anda. Dokumen asli tidak ditahan.', pelaksana: 'Tim HR', targetHari: 5 },
    { nama: 'Penawaran Kerja Bersyarat', keterangan: 'Penawaran tertulis berisi jabatan, status hubungan kerja, dan paket remunerasi.', pelaksana: 'Tim HR dan pimpinan', targetHari: 3 },
    { nama: 'Pemeriksaan Kesehatan', keterangan: 'Dilakukan setelah penawaran bersyarat, terbatas pada hal yang relevan dengan jabatan.', pelaksana: 'Klinik rekanan', targetHari: 5 },
    { nama: 'Persiapan Bergabung', keterangan: 'Kelengkapan administrasi dan jadwal hari pertama kerja.', pelaksana: 'Tim HR', targetHari: 7 },
  ];
  let counter = 0;
  const uid = () => Date.now().toString(36) + (counter++).toString(36);
  const newTahapan = () => DEFAULT_TAHAP.map(t => ({ id: uid(), ...t }));

  // Contoh ini ditutup dan ditandai agar tidak ada orang yang mengira lowongannya sungguhan.
  const contohLowongan = () => ({
    judul: 'CONTOH: Site Engineer', perusahaan: 'PT Contoh Konstruksi (fiktif)', lokasiKerja: 'Bekasi', tenggat: '',
    deskripsi: 'Ini lowongan contoh untuk memperlihatkan tampilan dan alur seleksi. Lowongan ini tidak nyata dan tidak menerima lamaran.\n\nTanggung jawab utama:\n- Mengawasi pelaksanaan pekerjaan struktur sesuai gambar dan spesifikasi.\n- Menyusun laporan progres mingguan.\n- Berkoordinasi dengan tim mutu, K3, dan pengadaan.',
    persyaratan: 'Minimal S1 jurusan Teknik Sipil\nPengalaman minimal 3 tahun\nMenguasai AutoCAD, Microsoft Excel\nDiutamakan memiliki SKK',
    kontak: 'hr@contoh.test', retensi: '6 bulan setelah seleksi selesai', status: 'tutup', contoh: true,
  });

  const statusOf = (k, t) => (k.tahap && k.tahap[t.id]) || '';

  // Peserta hanya boleh dinilai pada suatu tahap bila semua tahap sebelumnya lolos.
  function reachable(k, tahapan, index) {
    for (let i = 0; i < index; i++) if (statusOf(k, tahapan[i]) !== 'lolos') return false;
    return index >= 0 && index < tahapan.length;
  }

  function progress(k, tahapan) {
    for (let i = 0; i < tahapan.length; i++) {
      const s = statusOf(k, tahapan[i]);
      if (s === 'tidak') return { state: 'gugur', index: i, tahap: tahapan[i] };
      if (s !== 'lolos') return { state: 'proses', index: i, tahap: tahapan[i] };
    }
    return tahapan.length
      ? { state: 'lolos', index: tahapan.length, tahap: null }
      : { state: 'proses', index: 0, tahap: null };
  }

  const progressLabel = p => (p.state === 'lolos' ? 'Lolos semua tahap'
    : p.state === 'gugur' ? `Tidak lolos di ${p.tahap.nama}`
      : p.tahap ? `Menunggu ${p.tahap.nama}` : 'Belum ada tahapan');

  // Hasil tahap setelah titik putus tidak berlaku lagi, jadi dibersihkan.
  function normalize(k, tahapan) {
    k.tahap = k.tahap || {};
    const known = new Set(tahapan.map(t => t.id));
    Object.keys(k.tahap).forEach(id => { if (!known.has(id)) delete k.tahap[id]; });
    let open = true;
    tahapan.forEach(t => {
      if (!open) { delete k.tahap[t.id]; return; }
      if (statusOf(k, t) !== 'lolos') open = false;
    });
  }

  // Menekan status yang sama sekali lagi berarti membatalkannya.
  function setTahap(k, tahapan, tahapId, value) {
    const index = tahapan.findIndex(t => t.id === tahapId);
    if (!reachable(k, tahapan, index)) return false;
    k.tahap = k.tahap || {};
    if (k.tahap[tahapId] === value) delete k.tahap[tahapId];
    else k.tahap[tahapId] = value;
    normalize(k, tahapan);
    return true;
  }

  function groupsAt(list, tahapan, index) {
    const g = { lolos: [], tidak: [], belum: [] };
    list.forEach(k => {
      if (!reachable(k, tahapan, index)) return;
      const s = statusOf(k, tahapan[index]);
      g[s === 'lolos' ? 'lolos' : s === 'tidak' ? 'tidak' : 'belum'].push(k);
    });
    const byNomor = (a, b) => String(a.nomor).localeCompare(String(b.nomor));
    g.lolos.sort(byNomor); g.tidak.sort(byNomor); g.belum.sort(byNomor);
    return g;
  }

  function kodeLowongan(judul) {
    const words = String(judul || '').match(/[\p{L}\p{N}]+/gu) || [];
    const kode = words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
    return kode || 'LK';
  }
  function nextNomor(lowongan) {
    lowongan.kode = lowongan.kode || kodeLowongan(lowongan.judul);
    lowongan.nomorBerikut = (lowongan.nomorBerikut || 0) + 1;
    return `${lowongan.kode}-${String(lowongan.nomorBerikut).padStart(3, '0')}`;
  }

  function tanggalId(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // nama(k) diberikan oleh pemanggil karena nama dibaca dari teks CV.
  function announcementText(l, tahap, g, opts, nama) {
    const line = (k, i, show) => `${i + 1}. ${k.nomor}${show ? ` - ${nama(k)}` : ''}`;
    const parts = [`PENGUMUMAN HASIL ${tahap.nama.toUpperCase()}`, `Lowongan: ${l.judul}`];
    if (l.perusahaan) parts.push(`Perusahaan: ${l.perusahaan}`);
    if (opts.tanggal) parts.push(`Tanggal: ${tanggalId(opts.tanggal)}`);
    parts.push('', `DINYATAKAN LOLOS (${g.lolos.length} peserta)`);
    parts.push(...(g.lolos.length ? g.lolos.map((k, i) => line(k, i, true)) : ['Tidak ada.']));
    parts.push('', `TIDAK LOLOS (${g.tidak.length} peserta)`);
    parts.push(...(g.tidak.length ? g.tidak.map((k, i) => line(k, i, opts.tampilkanNama)) : ['Tidak ada.']));
    if (opts.tindak) parts.push('', 'Tindak lanjut', opts.tindak);
    parts.push('', 'Keputusan panitia seleksi bersifat final.');
    return parts.join('\n');
  }

  function personalMessage(k, l, tahap, status, opts, namaPeserta) {
    const pengirim = l.perusahaan || 'Tim Rekrutmen';
    const head = `Yth. ${namaPeserta},\n\nTerima kasih telah mengikuti seleksi ${l.judul} (nomor peserta ${k.nomor}).`;
    const body = status === 'lolos'
      ? `Dengan senang hati kami sampaikan bahwa Anda dinyatakan LOLOS tahap ${tahap.nama}.${opts.tindak ? `\n\n${opts.tindak}` : ''}`
      : `Setelah melalui pertimbangan, kami sampaikan bahwa Anda belum dapat melanjutkan ke tahap berikutnya setelah tahap ${tahap.nama}. Kami menghargai waktu dan minat Anda, dan semoga sukses dalam langkah karier selanjutnya.`;
    return `${head}\n\n${body}\n\nSalam,\n${pengirim}`;
  }

  // Berkas cadangan bisa berasal dari luar, jadi bentuknya diperiksa sebelum dipakai.
  function validBackup(d) {
    const idSah = x => typeof x === 'string' && /^[\w-]{1,64}$/.test(x); // id dipakai sebagai jalur dokumen
    return !!d && Array.isArray(d.lowongan) && Array.isArray(d.kandidat) &&
      d.lowongan.every(l => l && idSah(l.id) && typeof l.judul === 'string' && Array.isArray(l.tahapan) && l.criteria) &&
      d.kandidat.every(k => k && idSah(k.id) && idSah(k.lowonganId));
  }

  // Kode lamaran: 16 karakter acak (80 bit), sulit ditebak, dan tanpa huruf yang mirip angka.
  const KODE_ABJAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function buatKode() {
    const b = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, x => KODE_ABJAD[x & 31]).join('');
  }
  const normalKode = s => String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const tampilKode = k => k.match(/.{1,4}/g).join('-');

  // Yang terbit ke publik: hanya nomor peserta dan hasil tahap ini, tanpa nama, kontak, atau skor.
  // Hasil tiap peserta disusun dari SEMUA tahap yang sudah terbit, supaya menerbitkan ulang tahap lama
  // tidak menimpa hasil tahap yang lebih baru, dan hasil yang dibatalkan HR tidak tertinggal.
  function publishPayload(l, list, index, opts) {
    const tahap = l.tahapan[index], g = groupsAt(list, l.tahapan, index);
    const terbit = { ...(l.terbit || {}), [tahap.id]: true };
    const tindakOf = t => (t.id === tahap.id ? opts.tindak : ((l.pengumuman || {})[t.id] || {}).tindak) || '';
    const sets = [[`pengumuman/${l.id}__${tahap.id}`, {
      lowonganId: l.id, tahap: tahap.nama, urutan: index, tanggal: opts.tanggal || '', tindak: opts.tindak || '',
      lolos: g.lolos.map(k => k.nomor), tidak: g.tidak.map(k => k.nomor),
    }]];
    list.forEach(k => {
      let last = -1;
      l.tahapan.forEach((t, i) => { if (terbit[t.id] && statusOf(k, t)) last = i; });
      if (last < 0) { sets.push(hasilAwal(k, l)); return; }
      const t = l.tahapan[last], status = statusOf(k, t);
      sets.push([`hasil/${k.id}`, {
        nomor: k.nomor, posisi: l.judul, perusahaan: l.perusahaan || '', status, tahap: t.nama,
        riwayat: l.tahapan.slice(0, last + 1).map(x => ({ nama: x.nama, status: statusOf(k, x) })),
        pesan: status === 'lolos' ? tindakOf(t) : '',
      }]);
    });
    return sets;
  }

  // Saringan tahap: jumlah peserta yang sampai, lolos, tidak lolos, dan masih menunggu di tiap tahap.
  function funnel(list, tahapan) {
    return tahapan.map((t, i) => {
      const g = groupsAt(list, tahapan, i);
      return { tahap: t, sampai: g.lolos.length + g.tidak.length + g.belum.length, lolos: g.lolos.length, tidak: g.tidak.length, menunggu: g.belum.length };
    });
  }

  const hasilAwal = (k, l) => [`hasil/${k.id}`, { nomor: k.nomor, posisi: l.judul, perusahaan: l.perusahaan || '', status: 'proses', tahap: '', riwayat: [], pesan: '' }];

  // Memecah data aplikasi menjadi dokumen Firestore. Bagian publik dan bagian khusus HR sengaja dipisah.
  function docsFromDb(db) {
    const out = new Map();
    const clean = v => JSON.parse(JSON.stringify(v));
    db.lowongan.forEach(l => {
      out.set(`lowongan/${l.id}`, clean({
        judul: l.judul, perusahaan: l.perusahaan || '', lokasiKerja: l.lokasiKerja || '', tenggat: l.tenggat || '',
        tutupPada: l.tenggat ? `${l.tenggat}T23:59:59+07:00` : '2100-01-01T00:00:00+07:00',
        deskripsi: l.deskripsi || '', persyaratan: l.persyaratan || '', status: l.status || 'buka',
        kontak: l.kontak || '', retensi: l.retensi || '', contoh: !!l.contoh,
        alur: (l.tahapan || []).map(t => ({ nama: t.nama, keterangan: t.keterangan || '' })),
      }));
      out.set(`lowongan_hr/${l.id}`, clean({
        criteria: l.criteria, tahapan: l.tahapan, pengumuman: l.pengumuman || {},
        kode: l.kode || '', terbit: l.terbit || {}, hapusPada: l.hapusPada || '',
      }));
    });
    db.kandidat.forEach(k => {
      out.set(`lamaran/${k.id}`, clean({
        lowonganId: k.lowonganId, nomor: k.nomor || '', fileName: k.fileName || '', size: k.size || 0, error: k.error || '',
        cvText: k.text === undefined ? null : k.text, tahap: k.tahap || {},
        nama: k.nama || '', email: k.email || '', telepon: k.telepon || '',
        catatan: k.catatan || '', jejak: k.jejak || [], talentPool: !!k.talentPool,
      }));
    });
    return out;
  }

  // Dokumen turunan ikut dihapus agar tidak ada sisa data pelamar di bagian publik.
  function followDeletes(path, oldJson) {
    const [col, id] = path.split('/');
    if (col === 'lamaran') return [`hasil/${id}`];
    if (col === 'lowongan_hr') return Object.keys(JSON.parse(oldJson).terbit || {}).map(t => `pengumuman/${id}__${t}`);
    return [];
  }

  // Lowongan yang tanggal hapus datanya sudah lewat.
  const lewatMasaSimpan = (l, hariIni) => !!l.hapusPada && l.hapusPada <= hariIni;

  // Cadangan terenkripsi: AES-GCM dengan kunci dari kata sandi. Kata sandi tidak disimpan di mana pun.
  const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function kunci(pw, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function enkripsi(text, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kunci(pw, salt), new TextEncoder().encode(text));
    return JSON.stringify({ format: 'lowongan-terenkripsi-1', salt: b64(salt), iv: b64(iv), data: b64(data) });
  }
  async function dekripsi(o, pw) {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, await kunci(pw, unb64(o.salt)), unb64(o.data));
    return new TextDecoder().decode(data);
  }

  root.Rekrutmen = { lewatMasaSimpan, enkripsi, dekripsi, contohLowongan, funnel, buatKode, normalKode, tampilKode, publishPayload, hasilAwal, docsFromDb, followDeletes, DEFAULT_TAHAP, uid, newTahapan, statusOf, reachable, progress, progressLabel, normalize, setTahap, groupsAt, kodeLowongan, nextNomor, tanggalId, announcementText, personalMessage, validBackup };
})(typeof window !== 'undefined' ? window : globalThis);
