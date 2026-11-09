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

  // Teks tebal ditulis *seperti ini*: langsung tebal di WhatsApp, dan diubah ke HTML untuk email.
  function personalMessage(k, l, tahap, status, opts, namaPeserta) {
    const pt = l.perusahaan ? ` di *${l.perusahaan}*` : '';
    const akhir = (l.tahapan || []).length && l.tahapan[l.tahapan.length - 1].id === tahap.id;
    const baris = [`Yth. Sdr./Sdri. *${namaPeserta}*`, `Nomor peserta: ${k.nomor}`];
    if (opts.tanggal) baris.push(`Tanggal: ${tanggalId(opts.tanggal)}`);
    baris.push('', `Perihal: *Hasil Tahap ${tahap.nama} untuk Posisi ${l.judul}*`, '', 'Dengan hormat,', '');
    if (status === 'lolos') {
      baris.push(`Terima kasih atas partisipasi Anda dalam proses seleksi untuk posisi *${l.judul}*${pt}.`, '');
      baris.push(akhir
        ? `Berdasarkan hasil penilaian, dengan senang hati kami sampaikan bahwa Anda dinyatakan *LOLOS* seluruh tahapan seleksi, hingga tahap *${tahap.nama}*.`
        : `Berdasarkan hasil penilaian, dengan senang hati kami sampaikan bahwa Anda dinyatakan *LOLOS* pada tahap *${tahap.nama}*.`, '');
      if (opts.tindak) baris.push('*Tindak lanjut:*', String(opts.tindak).replace(/\n{2,}/g, '\n').trim(), '');
      baris.push('Mohon konfirmasi penerimaan pesan ini dengan membalasnya.');
      if (l.kontak) baris.push(`Informasi lebih lanjut dapat ditanyakan melalui ${l.kontak}.`);
      baris.push('', 'Seluruh proses seleksi tidak dipungut biaya apa pun. Mohon abaikan pihak yang meminta pembayaran atas nama perusahaan kami.');
    } else {
      baris.push(`Terima kasih atas waktu dan minat Anda mengikuti proses seleksi untuk posisi *${l.judul}*${pt}.`, '');
      baris.push(`Setelah melalui proses penilaian, dengan berat hati kami sampaikan bahwa Anda *belum dapat melanjutkan* ke tahap berikutnya setelah tahap *${tahap.nama}*.`, '');
      baris.push('Keputusan ini tidak mengurangi penghargaan kami atas kemampuan dan pengalaman Anda. Semoga Anda sukses dalam langkah karier selanjutnya.');
      if (k.talentPool) baris.push('', 'Sesuai persetujuan Anda, data Anda tetap kami simpan untuk ditawari lowongan lain yang sesuai selama masa simpan.');
      if (l.kontak) baris.push('', `Pertanyaan, keberatan, atau permintaan terkait data pribadi Anda dapat disampaikan melalui ${l.kontak}.`);
    }
    baris.push('', 'Demikian kami sampaikan. Atas perhatian Anda, kami ucapkan terima kasih.', '', 'Hormat kami,', '');
    if (l.picNama) baris.push(`*${l.picNama}*`);
    if (l.picJabatan) baris.push(l.picJabatan);
    baris.push(l.perusahaan ? `*${l.perusahaan}*` : 'Tim Rekrutmen');
    return baris.join('\n');
  }

  const pesanPolos = s => String(s).replace(/\*([^*\n]+)\*/g, '$1');
  function pesanHtml(s) {
    const aman = String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return aman.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  // Logo disimpan sebagai gambar kecil di dokumen lowongan. Hanya bitmap: SVG bisa membawa skrip.
  const logoSah = s => typeof s === 'string' && s.length <= 60000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(s);

  // Berkas cadangan bisa berasal dari luar, jadi bentuknya diperiksa sebelum dipakai.
  function validBackup(d) {
    const idSah = x => typeof x === 'string' && /^[\w-]{1,64}$/.test(x); // id dipakai sebagai jalur dokumen
    return !!d && Array.isArray(d.lowongan) && Array.isArray(d.kandidat) &&
      d.lowongan.every(l => l && idSah(l.id) && typeof l.judul === 'string' && Array.isArray(l.tahapan) && l.criteria && (!l.logo || logoSah(l.logo))) &&
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
      // tindak dikosongkan: lokasi dan kontak hanya untuk peserta yang lolos, lewat dokumen hasil yang dibuka dengan kode.
      lowonganId: l.id, tahap: tahap.nama, urutan: index, tanggal: opts.tanggal || '', tindak: '',
      lolos: g.lolos.map(k => k.nomor), tidak: g.tidak.map(k => k.nomor),
    }]];
    list.forEach(k => {
      let last = -1;
      l.tahapan.forEach((t, i) => { if (terbit[t.id] && statusOf(k, t)) last = i; });
      if (last < 0) { sets.push(hasilAwal(k, l)); return; }
      const t = l.tahapan[last], status = statusOf(k, t);
      sets.push([`hasil/${k.id}`, {
        nomor: k.nomor, posisi: l.judul, perusahaan: l.perusahaan || '', lowonganId: l.id, kontak: l.kontak || '', status, tahap: t.nama,
        riwayat: l.tahapan.slice(0, last + 1).map(x => ({ nama: x.nama, status: statusOf(k, x) })),
        alur: l.tahapan.map(x => x.nama), tanggal: opts.tanggal || '',
        pesan: status === 'lolos' ? tindakOf(t) : '',
      }]);
    });
    return sets;
  }

  // Pengalaman kandidat mencakup semua pelamar, termasuk yang tidak diterima: siapa yang sudah menerima kabar?
  function kabarPelamar(l, list) {
    const out = { dikabari: 0, tertunda: 0, menunggu: 0 };
    list.forEach(k => {
      const putus = l.tahapan.filter(t => statusOf(k, t));
      if (!putus.length) out.menunggu += 1;
      else if ((l.terbit || {})[putus[putus.length - 1].id]) out.dikabari += 1;
      else out.tertunda += 1;
    });
    return out;
  }

  const SUMBER = [['portal', 'Situs lowongan perusahaan ini'], ['situs', 'Situs lowongan lain'], ['sosial', 'Media sosial'], ['referensi', 'Referensi karyawan atau kenalan'], ['kampus', 'Kampus atau komunitas'], ['lain', 'Lainnya']];

  // Ringkasan survei tanpa identitas: hanya angka dan komentar.
  function ringkasSurvei(list) {
    const n = list.length;
    return { n, rata: n ? list.reduce((a, s) => a + s.nilai, 0) / n : null, jelas: n ? list.filter(s => s.jelas === 'ya').length / n : null, komentar: list.map(s => s.komentar).filter(Boolean) };
  }

  // Kecocokan rekomendasi screening dengan keputusan HR. Lolos dan Pertimbangkan dihitung positif; Perlu cek manual tidak dihitung.
  function kinerjaScreening(rows) {
    const x = rows.filter(r => ['lolos', 'pertimbangkan', 'tidak'].includes(r.rekomendasi) && ['lolos', 'tidak'].includes(r.hasil));
    const pos = r => r.rekomendasi !== 'tidak', tp = x.filter(r => pos(r) && r.hasil === 'lolos').length;
    const fp = x.filter(r => pos(r) && r.hasil === 'tidak').length, fn = x.filter(r => !pos(r) && r.hasil === 'lolos').length;
    const tn = x.length - tp - fp - fn, bagi = (a, b) => (b ? a / b : null);
    const presisi = bagi(tp, tp + fp), recall = bagi(tp, tp + fn);
    return { n: x.length, akurasi: bagi(tp + tn, x.length), presisi, recall, f1: presisi !== null && recall !== null && presisi + recall ? 2 * presisi * recall / (presisi + recall) : null };
  }

  // Saringan tahap: jumlah peserta yang sampai, lolos, tidak lolos, dan masih menunggu di tiap tahap.
  function funnel(list, tahapan) {
    return tahapan.map((t, i) => {
      const g = groupsAt(list, tahapan, i);
      return { tahap: t, sampai: g.lolos.length + g.tidak.length + g.belum.length, lolos: g.lolos.length, tidak: g.tidak.length, menunggu: g.belum.length };
    });
  }

  const hasilAwal = (k, l) => [`hasil/${k.id}`, { nomor: k.nomor, posisi: l.judul, perusahaan: l.perusahaan || '', lowonganId: l.id, kontak: l.kontak || '', status: 'proses', tahap: '', riwayat: [], alur: (l.tahapan || []).map(t => t.nama), pesan: '' }];

  // Memecah data aplikasi menjadi dokumen Firestore. Bagian publik dan bagian khusus HR sengaja dipisah.
  function docsFromDb(db) {
    const out = new Map();
    const clean = v => JSON.parse(JSON.stringify(v));
    db.lowongan.forEach(l => {
      out.set(`lowongan/${l.id}`, clean({
        judul: l.judul, perusahaan: l.perusahaan || '', logo: l.logo || '', lokasiKerja: l.lokasiKerja || '', tenggat: l.tenggat || '',
        tutupPada: l.tenggat ? `${l.tenggat}T23:59:59+07:00` : '2100-01-01T00:00:00+07:00',
        deskripsi: l.deskripsi || '', tentang: l.tentang || '', kompensasi: l.kompensasi || '', persyaratan: l.persyaratan || '', status: l.status || 'buka',
        kontak: l.kontak || '', retensi: l.retensi || '', contoh: !!l.contoh,
        alur: (l.tahapan || []).map(t => ({ nama: t.nama, keterangan: t.keterangan || '' })),
      }));
      out.set(`lowongan_hr/${l.id}`, clean({
        criteria: l.criteria, tahapan: l.tahapan, pengumuman: l.pengumuman || {},
        kode: l.kode || '', terbit: l.terbit || {}, hapusPada: l.hapusPada || '', picNama: l.picNama || '', picJabatan: l.picJabatan || '',
        permintaanNomor: l.permintaanNomor || '', permintaanUnit: l.permintaanUnit || '', permintaanJumlah: l.permintaanJumlah || '', pembelajaran: l.pembelajaran || '',
        permintaanJenis: l.permintaanJenis || '', permintaanTanggal: l.permintaanTanggal || '', terisiTanggal: l.terisiTanggal || '', saluran: l.saluran || '', preboarding: l.preboarding || {},
      }));
    });
    db.kandidat.forEach(k => {
      out.set(`lamaran/${k.id}`, clean({
        lowonganId: k.lowonganId, nomor: k.nomor || '', fileName: k.fileName || '', size: k.size || 0, error: k.error || '',
        cvText: k.text === undefined ? null : k.text, tahap: k.tahap || {},
        nama: k.nama || '', email: k.email || '', telepon: k.telepon || '',
        catatan: k.catatan || '', jejak: k.jejak || [], talentPool: !!k.talentPool, sumber: k.sumber || '',
      }));
    });
    return out;
  }

  // Dokumen turunan ikut dihapus agar tidak ada sisa data pelamar di bagian publik.
  function followDeletes(path, oldJson) {
    const [col, id] = path.split('/');
    if (col === 'lamaran') return [`hasil/${id}`, `survei/${id}`];
    if (col === 'lowongan_hr') return Object.keys(JSON.parse(oldJson).terbit || {}).map(t => `pengumuman/${id}__${t}`);
    return [];
  }

  // Lowongan yang tanggal hapus datanya sudah lewat.
  const lewatMasaSimpan = (l, hariIni) => !!l.hapusPada && l.hapusPada <= hariIni;

  // Cadangan terenkripsi: AES-GCM dengan kunci dari kata sandi. Kata sandi tidak disimpan di mana pun.
  const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  // 600.000 putaran mengikuti rekomendasi OWASP terbaru untuk PBKDF2-SHA256. Cadangan lama (310.000, tanpa kolom iter) tetap bisa dibuka.
  const ITER = 600000, ITER_SAH = [310000, 600000];
  async function kunci(pw, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function enkripsi(text, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kunci(pw, salt, ITER), new TextEncoder().encode(text));
    return JSON.stringify({ format: 'lowongan-terenkripsi-1', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) });
  }
  async function dekripsi(o, pw) {
    const iter = o.iter === undefined ? 310000 : o.iter;
    if (!ITER_SAH.includes(iter)) throw new Error('Format cadangan tidak dikenal.'); // file buatan orang lain tidak boleh memaksa jutaan putaran
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, await kunci(pw, unb64(o.salt), iter), unb64(o.data));
    return new TextDecoder().decode(data);
  }

  root.Rekrutmen = { SUMBER, ringkasSurvei, kinerjaScreening, kabarPelamar, pesanPolos, pesanHtml, logoSah, lewatMasaSimpan, enkripsi, dekripsi, contohLowongan, funnel, buatKode, normalKode, tampilKode, publishPayload, hasilAwal, docsFromDb, followDeletes, DEFAULT_TAHAP, uid, newTahapan, statusOf, reachable, progress, progressLabel, normalize, setTahap, groupsAt, kodeLowongan, nextNomor, tanggalId, announcementText, personalMessage, validBackup };
})(typeof window !== 'undefined' ? window : globalThis);
