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
      keahlian: [['Microsoft Excel', true], ['RAB / BOQ', true], ['AutoCAD', false]], tambahan: ['Cost Control', 'Manajemen Kontrak', 'Primavera', 'Bahasa Inggris'], sertifikat: [['SKK', true, SKK]] },
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
      keahlian: [['Microsoft Word', true], ['Penyusunan Kontrak', false]], tambahan: ['Hukum Perusahaan', 'Bahasa Inggris'], sertifikat: [] },
  ];

  // Rumpun jabatan tambahan: disusun dari pengetahuan umum tanpa rujukan per jabatan, jadi perlu ditelaah lebih teliti.
  const STR = 'Tenaga kesehatan memerlukan STR dan izin praktik sesuai peraturan. Pastikan ketentuannya untuk jabatan ini.';
  const RUMPUN = [
    { id: 'perawat', nama: 'Perawat', sinonim: ['bidan', 'tenaga kesehatan', 'nakes', 'apoteker', 'analis kesehatan', 'dokter', 'paramedis'], pendidikan: 'd3', jurusan: ['Keperawatan', 'Kebidanan', 'Farmasi', 'Kedokteran'],
      tugas: ['Memberikan pelayanan kesehatan sesuai standar', 'Memantau kondisi dan mencatat rekam medis', 'Menjaga keselamatan pasien dan pengendalian infeksi', 'Berkoordinasi dengan tim medis'], keahlian: [['Pelayanan Pasien', true]], tambahan: ['BTCLS', 'Komunikasi'], sertifikat: [['STR', true, STR]] },
    { id: 'guru', nama: 'Guru', sinonim: ['pengajar', 'dosen', 'tutor', 'instruktur', 'trainer', 'pelatih'], pendidikan: 's1', jurusan: ['Pendidikan'],
      tugas: ['Menyusun rencana dan materi pembelajaran', 'Mengajar dan mendampingi peserta didik', 'Menilai hasil belajar', 'Berkomunikasi dengan orang tua atau pemangku kepentingan'], keahlian: [['Pembelajaran', true]], tambahan: ['Microsoft Office', 'Komunikasi', 'Bahasa Inggris'], sertifikat: [['Sertifikat Pendidik', false, '']] },
    { id: 'koki', nama: 'Koki', sinonim: ['chef', 'cook', 'juru masak', 'barista', 'pastry', 'kitchen', 'waiter', 'pramusaji', 'food and beverage', 'f&b'], pendidikan: 'sma', jurusan: ['Tata Boga', 'Perhotelan'],
      tugas: ['Menyiapkan makanan atau minuman sesuai standar resep', 'Menjaga kebersihan dan keamanan pangan', 'Mengelola bahan baku dan stok', 'Bekerja sama dengan tim layanan'], keahlian: [['Pengolahan Makanan', true]], tambahan: ['Keamanan Pangan', 'HACCP'], sertifikat: [['Sertifikat Kompetensi', false, 'Usaha pariwisata wajib mempekerjakan tenaga bersertifikat kompetensi. Pastikan ketentuannya.']] },
    { id: 'hotel', nama: 'Front Office', sinonim: ['resepsionis hotel', 'perhotelan', 'housekeeping', 'room attendant', 'guest relation', 'tour guide', 'pemandu wisata', 'ticketing', 'travel consultant'], pendidikan: 'sma', jurusan: ['Perhotelan', 'Pariwisata'],
      tugas: ['Melayani tamu dengan ramah sesuai standar', 'Mengelola reservasi dan administrasi tamu', 'Menangani pertanyaan dan keluhan', 'Berkoordinasi antarbagian'], keahlian: [['Pelayanan Tamu', true], ['Komunikasi', true]], tambahan: ['Bahasa Inggris', 'Microsoft Excel'], sertifikat: [['Sertifikat Kompetensi', false, '']] },
    { id: 'supir', nama: 'Supir', sinonim: ['sopir', 'driver', 'pengemudi', 'kurir', 'operator alat berat', 'operator forklift'], pendidikan: 'sma', jurusan: [],
      tugas: ['Mengoperasikan kendaraan atau alat dengan aman', 'Merawat dan memeriksa kondisi kendaraan', 'Mematuhi rute, jadwal, dan peraturan', 'Mengisi laporan perjalanan'], keahlian: [['Mengemudi', true]], tambahan: ['Perawatan Kendaraan', 'Pengetahuan Rute'], sertifikat: [['SIM', true, 'Sesuaikan golongan SIM dengan kendaraan. Operator alat tertentu memerlukan lisensi K3.']] },
    { id: 'gudang', nama: 'Staf Gudang', sinonim: ['warehouse', 'gudang', 'logistik', 'inventory', 'stock keeper', 'admin gudang', 'checker'], pendidikan: 'sma', jurusan: [],
      tugas: ['Menerima, memeriksa, dan menyimpan barang', 'Mencatat stok dan melakukan stock opname', 'Menyiapkan pengiriman barang', 'Menjaga kerapian dan keselamatan gudang'], keahlian: [['Pengelolaan Stok', true], ['Microsoft Excel', false]], tambahan: ['FIFO', 'ERP'], sertifikat: [] },
    { id: 'teknisi', nama: 'Teknisi', sinonim: ['mekanik', 'maintenance', 'teknisi listrik', 'electrician', 'operator produksi', 'operator mesin', 'welder', 'juru las', 'tukang'], pendidikan: 'sma', jurusan: ['Teknik Mesin', 'Teknik Elektro'],
      tugas: ['Memasang, merawat, dan memperbaiki peralatan', 'Memeriksa kondisi alat secara berkala', 'Menerapkan prosedur keselamatan kerja', 'Mencatat pekerjaan dan kerusakan'], keahlian: [['Perawatan Mesin', true]], tambahan: ['Pembacaan Gambar Teknik', 'K3'], sertifikat: [['Sertifikat Kompetensi', false, 'Pekerjaan listrik, las, atau ketinggian dapat memerlukan lisensi K3. Pastikan ketentuannya.']] },
    { id: 'desain', nama: 'Desainer Grafis', sinonim: ['graphic designer', 'desain grafis', 'ui ux', 'ui/ux', 'video editor', 'editor video', 'ilustrator', 'multimedia'], pendidikan: 'd3', jurusan: ['Desain Komunikasi Visual', 'Multimedia'],
      tugas: ['Membuat materi visual sesuai kebutuhan', 'Menerjemahkan arahan menjadi konsep desain', 'Merevisi karya berdasarkan masukan', 'Menjaga konsistensi identitas merek'], keahlian: [['Adobe Photoshop', true], ['Adobe Illustrator', false]], tambahan: ['Figma', 'Canva', 'Video Editing', 'Portofolio'], sertifikat: [] },
    { id: 'data', nama: 'Data Analyst', sinonim: ['analis data', 'business analyst', 'data scientist', 'business intelligence', 'bi analyst'], pendidikan: 's1', jurusan: ['Statistika', 'Matematika', 'Teknik Informatika', 'Sistem Informasi'],
      tugas: ['Mengumpulkan dan membersihkan data', 'Menganalisis data untuk menjawab kebutuhan bisnis', 'Membuat dasbor dan laporan', 'Menyampaikan temuan kepada pemangku kepentingan'], keahlian: [['SQL', true], ['Microsoft Excel', true]], tambahan: ['Python', 'Power BI', 'Tableau', 'Statistika'], sertifikat: [] },
    { id: 'digital', nama: 'Digital Marketing', sinonim: ['social media', 'media sosial', 'content creator', 'content writer', 'copywriter', 'seo', 'public relations', 'humas'], pendidikan: 'd3', jurusan: ['Komunikasi', 'Pemasaran', 'Manajemen'],
      tugas: ['Merencanakan dan menjalankan kampanye digital', 'Membuat dan menjadwalkan konten', 'Mengukur kinerja kampanye', 'Berkoordinasi dengan tim penjualan dan desain'], keahlian: [['Pemasaran Digital', true], ['Media Sosial', true]], tambahan: ['SEO', 'Google Ads', 'Copywriting', 'Google Analytics'], sertifikat: [] },
    { id: 'cs', nama: 'Customer Service', sinonim: ['layanan pelanggan', 'call center', 'kasir', 'cashier', 'telemarketing', 'teller'], pendidikan: 'sma', jurusan: [],
      tugas: ['Melayani pertanyaan dan keluhan pelanggan', 'Mencatat dan menindaklanjuti permintaan', 'Menjaga kepuasan pelanggan', 'Menyusun laporan layanan'], keahlian: [['Komunikasi', true], ['Pelayanan Pelanggan', true]], tambahan: ['Microsoft Excel', 'CRM', 'Bahasa Inggris'], sertifikat: [] },
    { id: 'satpam', nama: 'Satpam', sinonim: ['security', 'petugas keamanan', 'keamanan'], pendidikan: 'sma', jurusan: [],
      tugas: ['Menjaga keamanan area kerja', 'Melakukan patroli dan pemeriksaan', 'Mencatat dan melaporkan kejadian', 'Membantu penanganan keadaan darurat'], keahlian: [['Pengamanan', true]], tambahan: ['P3K', 'Komunikasi'], sertifikat: [['Gada Pratama', true, 'Syarat satpam diatur Perpol 4/2020, termasuk syarat fisik dan usia yang ditentukan peraturan. Pastikan ketentuannya.']] },
    { id: 'arsitek', nama: 'Arsitek', sinonim: ['architect', 'desainer interior', 'interior designer', 'perencana'], pendidikan: 's1', jurusan: ['Arsitektur', 'Desain Interior'],
      tugas: ['Menyusun konsep dan gambar desain', 'Berkoordinasi dengan klien dan konsultan', 'Memeriksa kesesuaian desain dengan ketentuan bangunan', 'Mengawasi kesesuaian pelaksanaan dengan desain'], keahlian: [['AutoCAD', true], ['SketchUp', false]], tambahan: ['Revit', 'Lumion', 'Portofolio'], sertifikat: [['SKK', false, SKK]] },
  ];
  const SEMUA = TEMPLAT.concat(RUMPUN);

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
    SEMUA.forEach(t => {
      [t.nama].concat(t.sinonim).forEach(n => {
        const s = n.toLowerCase().replace(/\b(staf|staff)\b/g, '').replace(/\s+/g, ' ').trim();
        // Padanan yang lebih panjang menang: "digital marketing" mengalahkan "marketing".
        const nilai = s === q ? 9 : (new RegExp(`(^|[^\\p{L}])${s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(q) ? 2 + s.length / 100 : (q.length >= 3 && s.includes(q) ? 1 : 0));
        if (nilai > skor) { skor = nilai; best = t; }
      });
    });
    return best;
  }

  // Jenjang dibaca dari judul; bila tidak tertulis, pakai bawaan yang diberikan.
  function deteksiJenjang(posisi) {
    const p = String(posisi || '').toLowerCase();
    if (/\b(magang|intern|internship|junior|jr|trainee|asisten|assistant|fresh graduate)\b/.test(p)) return 'staf';
    if (/\b(manajer|manager|kepala|head|direktur|director|gm)\b/.test(p)) return 'manajer';
    if (/\b(senior|sr|lead|supervisor|spv|koordinator|coordinator)\b/.test(p)) return 'senior';
    if (/\b(staf|staff|officer)\b/.test(p)) return 'staf';
    return null;
  }

  const hasilkan = (posisi, jenjang) => susun(posisi, deteksiJenjang(posisi) || jenjang || 'madya', cari(posisi));

  function susun(posisi, jenjang, templat) {
    const t = templat || { ...UMUM, tugas: [`Menjalankan pekerjaan utama sebagai ${String(posisi || '').trim()} sesuai target`].concat(UMUM.tugas.slice(1)) };
    const j = JENJANG.find(x => x.k === jenjang) || JENJANG[0];
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
      // Keahlian rumpun jarang tertulis persis di CV, jadi tidak dijadikan wajib agar pelamar layak tidak gugur.
      keahlian: t.keahlian.map(([x, wajib]) => ({ t: x, wajib: wajib && !!t.onet, aktif: true })),
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
    if (wajib.length) syarat.push(`Keahlian: ${dan(wajib)}`);
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

  root.TemplatLowongan = { JENJANG, TEMPLAT, SEMUA, cari, susun, hasilkan, deteksiJenjang, keTeks, keKriteria };
})(typeof window !== 'undefined' ? window : globalThis);
