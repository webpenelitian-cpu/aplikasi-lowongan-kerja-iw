// Pustaka templat jabatan untuk formulir lowongan otomatis.
// Tugas dan keahlian dirangkum sendiri dari profil O*NET dan pola lowongan di Indonesia, bukan salinan iklan.
// Isinya titik awal: HR wajib meninjau, menambah, dan mengurangi sebelum lowongan terbit.
(function (root) {
  'use strict';

  const JENJANG = [
    { k: 'staf', label: 'Staf / Junior', tahun: 1 },
    { k: 'madya', label: 'Madya', tahun: 3 },
    { k: 'senior', label: 'Senior', tahun: 5 },
    { k: 'manajer', label: 'Manajer', tahun: 8 },
  ];

  const SKK = 'Tenaga kerja konstruksi wajib memiliki SKK (Pasal 70 UU 2/2017). Pastikan klasifikasi dan jenjangnya sesuai jabatan.';

  const TEMPLAT = [
    { id: 'site-engineer', nama: 'Site Engineer', sinonim: ['civil engineer', 'insinyur sipil', 'pelaksana lapangan', 'engineer lapangan'], onet: '17-2051.00', pendidikan: 's1', jurusan: ['Teknik Sipil'],
      tugas: ['Mengawasi pelaksanaan pekerjaan di lapangan sesuai gambar dan spesifikasi', 'Memeriksa mutu, keselamatan, dan kepatuhan pekerjaan terhadap standar', 'Menghitung dan memeriksa metode kerja serta kebutuhan material', 'Menyusun laporan progres harian dan mingguan', 'Berkoordinasi dengan tim mutu, K3, pengadaan, dan subkontraktor'],
      keahlian: [['AutoCAD', true], ['Microsoft Excel', true]], tambahan: ['Civil 3D', 'Revit', 'Microsoft Project', 'Bahasa Inggris'], sertifikat: [['SKK', true, SKK]] },
    { id: 'quantity-surveyor', nama: 'Quantity Surveyor', sinonim: ['qs', 'estimator', 'cost control', 'cost estimator', 'quantity engineer'], onet: '13-1051.00', pendidikan: 's1', jurusan: ['Teknik Sipil', 'Arsitektur'],
      tugas: ['Menghitung volume pekerjaan dan menyusun RAB serta BOQ', 'Menyiapkan penawaran dan dokumen tender', 'Mengendalikan biaya proyek dan membandingkan realisasi dengan anggaran', 'Memproses opname subkontraktor, pekerjaan tambah kurang, dan tagihan', 'Menyusun final account proyek'],
      keahlian: [['Microsoft Excel', true], ['RAB', true], ['AutoCAD', false]], tambahan: ['Cost Control', 'Manajemen Kontrak', 'Primavera', 'Bahasa Inggris'], sertifikat: [['SKK', true, SKK]] },
    { id: 'drafter', nama: 'Drafter', sinonim: ['juru gambar', 'cad operator', 'draftsman', 'drafter sipil', 'drafter arsitektur'], onet: '17-3011.00', pendidikan: 'd3', jurusan: ['Teknik Sipil', 'Arsitektur'],
      tugas: ['Membuat gambar kerja dan shop drawing berskala', 'Memeriksa kesesuaian gambar dengan spesifikasi dan ketentuan bangunan', 'Menggabungkan gambar struktur, arsitektur, dan mekanikal elektrikal', 'Merevisi gambar sesuai perubahan dan membuat as-built drawing', 'Mengelola arsip gambar proyek'],
      keahlian: [['AutoCAD', true]], tambahan: ['Civil 3D', 'Revit', 'SketchUp', 'Microsoft Excel'], sertifikat: [['SKK', true, SKK]] },
    { id: 'manajer-proyek', nama: 'Manajer Proyek', sinonim: ['project manager', 'pm', 'site manager', 'kepala proyek', 'construction manager'], onet: '11-9021.00', pendidikan: 's1', jurusan: ['Teknik Sipil', 'Teknik Industri'],
      tugas: ['Memimpin perencanaan dan pelaksanaan proyek sesuai biaya, mutu, dan waktu', 'Menyusun jadwal serta mengendalikan anggaran dan laporan biaya', 'Menjalankan program mutu dan keselamatan kerja', 'Mengarahkan tim proyek dan subkontraktor', 'Menjadi penghubung dengan pemilik proyek dan konsultan'],
      keahlian: [['Manajemen Proyek', true], ['Microsoft Excel', false]], tambahan: ['Primavera', 'Microsoft Project', 'Manajemen Kontrak', 'Bahasa Inggris'], sertifikat: [['SKK', true, SKK], ['PMP', false, '']] },
    { id: 'hse-officer', nama: 'HSE Officer', sinonim: ['k3', 'ahli k3', 'hse', 'safety officer', 'petugas k3', 'she officer'], onet: '19-5011.00', pendidikan: 's1', jurusan: ['Kesehatan Masyarakat', 'Teknik Lingkungan', 'Teknik Sipil', 'K3'],
      tugas: ['Menginspeksi tempat kerja terhadap ketentuan keselamatan', 'Menghentikan kegiatan yang tidak aman dan merekomendasikan perbaikan', 'Menyelidiki kecelakaan kerja dan mencari penyebabnya', 'Menyelenggarakan induksi dan pelatihan K3', 'Menyusun laporan dan menjalankan program K3 serta lingkungan'],
      keahlian: [['Identifikasi Bahaya / HIRADC', true], ['Microsoft Excel', false]], tambahan: ['ISO 45001', 'Investigasi Kecelakaan', 'Bahasa Inggris'], sertifikat: [['Ahli K3', true, 'Sesuaikan jenis sertifikat K3 dengan bidang dan ketentuan yang berlaku.'], ['SKK', false, SKK]] },
    { id: 'staf-hr', nama: 'Staf HR', sinonim: ['hr generalist', 'human resources', 'sdm', 'staf sdm', 'hrd', 'recruiter', 'talent acquisition', 'hrbp', 'personalia'], onet: '13-1071.00', pendidikan: 's1', jurusan: ['Psikologi', 'Manajemen', 'Hukum'],
      tugas: ['Menjalankan rekrutmen dan administrasi penerimaan karyawan', 'Menjelaskan kebijakan perusahaan dan ketentuan ketenagakerjaan', 'Mengelola data dan dokumen karyawan', 'Menangani hubungan industrial dan keluhan karyawan', 'Mengurus administrasi BPJS dan kontrak kerja'],
      keahlian: [['Rekrutmen', true], ['Microsoft Excel', true]], tambahan: ['Hukum Ketenagakerjaan', 'BPJS', 'Penggajian', 'Hubungan Industrial'], sertifikat: [['BNSP', false, '']] },
    { id: 'staf-akuntansi', nama: 'Staf Akuntansi', sinonim: ['accounting', 'akuntan', 'accounting staff', 'staf keuangan', 'finance', 'auditor', 'pajak', 'tax'], onet: '13-2011.00', pendidikan: 's1', jurusan: ['Akuntansi', 'Keuangan'],
      tugas: ['Mencatat transaksi dan membuat jurnal penyesuaian', 'Memproses faktur dan pembayaran', 'Melakukan rekonsiliasi akun dan menyelesaikan selisih', 'Menyiapkan perhitungan dan pelaporan pajak', 'Menyusun laporan keuangan berkala'],
      keahlian: [['Microsoft Excel', true], ['Akuntansi', true]], tambahan: ['Perpajakan', 'SAP', 'Accurate', 'PSAK'], sertifikat: [['Brevet', false, '']] },
    { id: 'staf-pengadaan', nama: 'Staf Pengadaan', sinonim: ['procurement', 'purchasing', 'pembelian', 'buyer', 'supply chain', 'logistik'], onet: '13-1023.00', pendidikan: 's1', jurusan: ['Teknik Industri', 'Manajemen', 'Teknik Sipil'],
      tugas: ['Mencari pemasok dan membandingkan harga serta mutu', 'Menyiapkan permintaan penawaran dan menjalankan negosiasi', 'Menerbitkan pesanan pembelian dan meninjau permintaan barang', 'Menjaga kepatuhan terhadap kebijakan pengadaan dan peraturan', 'Mengevaluasi kinerja vendor'],
      keahlian: [['Pengadaan', true], ['Microsoft Excel', true]], tambahan: ['SAP', 'Negosiasi', 'Manajemen Kontrak'], sertifikat: [['Sertifikat Pengadaan', false, '']] },
    { id: 'staf-it', nama: 'Software Developer', sinonim: ['programmer', 'web developer', 'developer', 'staf it', 'pengembang perangkat lunak', 'software engineer', 'full stack'], onet: '15-1252.00', pendidikan: 's1', jurusan: ['Teknik Informatika', 'Sistem Informasi'],
      tugas: ['Menganalisis kebutuhan pengguna dan kelayakannya', 'Merancang dan membangun aplikasi bersama tim', 'Menguji, memperbaiki galat, dan meningkatkan kinerja aplikasi', 'Menyusun dokumentasi teknis', 'Melaporkan kemajuan pekerjaan'],
      keahlian: [['Git', true], ['SQL', true]], tambahan: ['JavaScript', 'Python', 'Java', 'Cloud', 'Bahasa Inggris'], sertifikat: [] },
    { id: 'staf-penjualan', nama: 'Staf Penjualan', sinonim: ['sales', 'marketing', 'account executive', 'pemasaran', 'business development'], onet: '41-4012.00', pendidikan: 'd3', jurusan: ['Manajemen', 'Pemasaran'],
      tugas: ['Menjawab pertanyaan pelanggan tentang produk, harga, dan ketersediaan', 'Merekomendasikan produk sesuai kebutuhan pelanggan', 'Menyusun penawaran harga dan syarat penjualan', 'Mendampingi pelanggan setelah penjualan', 'Mengelola kontrak, pesanan, dan laporan penjualan'],
      keahlian: [['Penjualan', true], ['Komunikasi', true]], tambahan: ['Microsoft Excel', 'CRM', 'Negosiasi', 'Bahasa Inggris'], sertifikat: [] },
    { id: 'staf-admin', nama: 'Staf Administrasi', sinonim: ['admin', 'administrasi', 'admin proyek', 'sekretaris', 'resepsionis', 'office admin', 'customer service'], onet: '43-6014.00', pendidikan: 'sma', jurusan: [],
      tugas: ['Menerima telepon dan tamu serta menangani pertanyaan', 'Memasukkan dan memelihara data', 'Menyusun surat, dokumen, dan arsip', 'Mengatur jadwal dan keperluan kantor', 'Mengoperasikan peralatan kantor'],
      keahlian: [['Microsoft Excel', true], ['Microsoft Word', true]], tambahan: ['Pengarsipan', 'Komunikasi'], sertifikat: [] },
    { id: 'staf-legal', nama: 'Staf Legal', sinonim: ['legal officer', 'hukum', 'legal', 'paralegal', 'staf hukum', 'corporate legal'], onet: '23-2011.00', pendidikan: 's1', jurusan: ['Hukum'],
      tugas: ['Menyusun dan meninjau kontrak serta dokumen hukum', 'Meneliti peraturan yang berlaku', 'Mengelola arsip hukum dan perizinan', 'Menyiapkan surat dan korespondensi hukum', 'Berkoordinasi dengan unit kerja dan konsultan hukum'],
      keahlian: [['Penyusunan Kontrak', true], ['Microsoft Word', true]], tambahan: ['Hukum Perusahaan', 'Bahasa Inggris'], sertifikat: [] },
  ];

  const UMUM = { id: 'umum', nama: '', sinonim: [], onet: '', pendidikan: '', jurusan: [],
    tugas: ['Menjalankan pekerjaan utama jabatan sesuai target yang ditetapkan', 'Berkoordinasi dengan unit kerja terkait', 'Menyusun laporan pekerjaan berkala'],
    keahlian: [['Microsoft Excel', false]], tambahan: ['Komunikasi'], sertifikat: [] };

  const KETENTUAN = [
    'Seleksi tidak dipungut biaya apa pun',
    'Dokumen asli tidak ditahan selama seleksi maupun saat bekerja',
    'Terbuka bagi semua pelamar yang memenuhi syarat, termasuk penyandang disabilitas',
    'Hanya pelamar yang memenuhi syarat yang diproses ke tahap berikutnya',
  ];

  function cari(posisi) {
    const q = String(posisi || '').toLowerCase().replace(/\b(senior|junior|staf|staff|manajer|manager|madya|kepala|sr|jr)\b\.?/g, m => (/manager|manajer/.test(m) && /proyek|project/.test(posisi.toLowerCase()) ? m : ' ')).replace(/\s+/g, ' ').trim();
    if (!q) return null;
    let best = null, skor = 0;
    TEMPLAT.forEach(t => {
      [t.nama].concat(t.sinonim).forEach(n => {
        const s = n.toLowerCase().replace(/\b(staf|staff)\b/g, '').replace(/\s+/g, ' ').trim();
        const nilai = s === q ? 3 : (new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q) ? 2 : (q.length >= 3 && s.includes(q) ? 1 : 0));
        if (nilai > skor) { skor = nilai; best = t; }
      });
    });
    return best;
  }

  function susun(posisi, jenjang, templat) {
    const t = templat || UMUM, j = JENJANG.find(x => x.k === jenjang) || JENJANG[0];
    const on = x => ({ t: x, aktif: true });
    const tugas = t.tugas.slice();
    if (j.k === 'senior') tugas.push('Membimbing anggota tim yang lebih junior');
    if (j.k === 'manajer') tugas.push('Memimpin tim, menetapkan target, dan menilai kinerja anggota tim');
    const tambahan = t.tambahan.slice();
    if ((j.k === 'senior' || j.k === 'manajer') && !tambahan.includes('Kepemimpinan')) tambahan.push('Kepemimpinan');
    return {
      templat: t.id, onet: t.onet, posisi: String(posisi || '').trim(), jenjang: j.k,
      pendidikan: t.pendidikan, tahun: j.tahun,
      tugas: tugas.map(on), jurusan: t.jurusan.map(on),
      keahlian: t.keahlian.map(([x, wajib]) => ({ t: x, wajib, aktif: true })),
      tambahan: tambahan.map(on),
      sertifikat: t.sertifikat.map(([x, wajib, catatan]) => ({ t: x, wajib, aktif: true, catatan })),
      ketentuan: KETENTUAN.map(on),
    };
  }

  const aktif = list => list.filter(x => x.aktif && x.t.trim()).map(x => x.t.trim());
  const dan = a => (a.length < 3 ? a.join(' dan ') : `${a.slice(0, -1).join(', ')}, dan ${a[a.length - 1]}`);
  const atau = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} atau ${a[a.length - 1]}`);

  function keTeks(d, labelJenjang) {
    const tugas = aktif(d.tugas), jur = aktif(d.jurusan), ket = aktif(d.ketentuan);
    const wajib = d.keahlian.filter(x => x.aktif && x.wajib).map(x => x.t), opsi = d.keahlian.filter(x => x.aktif && !x.wajib).map(x => x.t).concat(aktif(d.tambahan));
    const sW = d.sertifikat.filter(x => x.aktif && x.wajib).map(x => x.t), sO = d.sertifikat.filter(x => x.aktif && !x.wajib).map(x => x.t);
    const syarat = [];
    if (labelJenjang) { const lv = labelJenjang(d.pendidikan); if (lv) syarat.push(`Minimal ${lv}${jur.length ? ` jurusan ${atau(jur)}` : ''}`); }
    if (+d.tahun > 0) syarat.push(`Pengalaman minimal ${d.tahun} tahun di bidang terkait`);
    if (wajib.length) syarat.push(`Menguasai ${dan(wajib)}`);
    if (sW.length) syarat.push(`Memiliki ${dan(sW)}`);
    if (opsi.length || sO.length) syarat.push(`Diutamakan memiliki ${dan(opsi.concat(sO))}`);
    const deskripsi = [tugas.length ? `Tanggung jawab utama:\n${tugas.map(x => `- ${x}`).join('\n')}` : '', ket.length ? `Ketentuan seleksi:\n${ket.map(x => `- ${x}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
    return { deskripsi, persyaratan: syarat.join('\n') };
  }

  function keKriteria(d, c) {
    c.pendidikan.level = d.pendidikan;
    c.jurusan.items = aktif(d.jurusan).join(', ');
    c.pengalaman.tahun = d.tahun;
    const pakai = d.keahlian.filter(x => x.aktif && x.t.trim());
    c.keahlian.items = pakai.filter(x => x.wajib).map(x => x.t).join(', ');
    c.nilaiTambah.items = pakai.filter(x => !x.wajib).map(x => x.t).concat(aktif(d.tambahan)).join(', ');
    const sert = d.sertifikat.filter(x => x.aktif && x.t.trim());
    c.sertifikasi.items = sert.map(x => x.t).join(', ');
    c.sertifikasi.wajib = sert.some(x => x.wajib);
    return c;
  }

  root.TemplatLowongan = { JENJANG, TEMPLAT, cari, susun, keTeks, keKriteria };
})(typeof window !== 'undefined' ? window : globalThis);
