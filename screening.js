// Logika screening CV: membaca fakta dari teks CV lalu menilainya terhadap ketentuan pengguna.
// Tidak menyentuh tampilan, supaya bisa diuji sendiri (lihat tests/uji.html).
(function (root) {
  'use strict';

  const LEVELS = [
    { k: 'sma', label: 'SMA/SMK', rank: 1 },
    { k: 'd3', label: 'D3', rank: 2 },
    { k: 's1', label: 'S1/D4', rank: 3 },
    { k: 's2', label: 'S2', rank: 4 },
    { k: 's3', label: 'S3', rank: 5 },
  ];
  const levelOf = k => LEVELS.find(l => l.k === k) || null;

  const LEVEL_PATTERNS = [
    ['s3', /\bS\s?-?3\b|\bdoktor(al)?\b|\bdoctoral\b|\bdoctor of\b|\bph\.?\s?d\b/i],
    ['s2', /\bS\s?-?2\b|\bmagister\b|\bmaster of\b|\bmaster'?s\b|\bmaster degree\b|\bMBA\b|\bM\.(T|M|Si|Kom|Ak|Sc|Eng|Pd|H)\b/i],
    ['s1', /\bS\s?-?1\b|\bsarjana\b|\bbachelor\b|\bundergraduate\b|\bD\s?-?(IV|4)\b|\bdiploma\s+(iv|4)\b|\bS\.(T|Kom|E|H|Psi|Si|Pd|Ak|Sos|Ked|Tr|Ars|I\.?Kom)\b/i],
    ['d3', /\bD\s?-?(III|3)\b|\bdiploma\s+(iii|3)\b|\bahli madya\b|\bA\.?\s?Md\b|\bassociate degree\b/i],
    ['sma', /\bSMA\b|\bSMK\b|\bSTM\b|\bSLTA\b|\bSMU\b|\bhigh school\b|\bsekolah menengah (atas|kejuruan)\b/i],
  ];

  // Padanan Indonesia-Inggris agar CV berbahasa Inggris tidak gugur hanya karena beda bahasa.
  const SYNONYMS = [
    ['akuntansi', 'accounting'], ['keuangan', 'finance'], ['perpajakan', 'pajak', 'taxation', 'tax'],
    ['teknik sipil', 'civil engineering'], ['teknik mesin', 'mechanical engineering'],
    ['teknik elektro', 'electrical engineering'], ['teknik informatika', 'informatika', 'computer science', 'ilmu komputer'],
    ['sistem informasi', 'information systems'], ['manajemen proyek', 'project management'],
    ['manajemen', 'management'], ['sumber daya manusia', 'sdm', 'hrd', 'human resources', 'human resource'],
    ['pemasaran', 'marketing'], ['penjualan', 'sales'], ['rekrutmen', 'recruitment', 'recruiting'],
    ['kepemimpinan', 'leadership'], ['komunikasi', 'communication'],
    ['analisis data', 'data analysis', 'data analytics'], ['bahasa inggris', 'english', 'toefl', 'ielts'],
    ['hukum', 'law'], ['psikologi', 'psychology'], ['pengadaan', 'procurement'],
    ['k3', 'hse', 'keselamatan dan kesehatan kerja'],
    ['hubungan industrial', 'industrial relations', 'employee relations'],
    ['penggajian', 'payroll', 'upah', 'wage'],
    ['hukum ketenagakerjaan', 'labour law', 'labor law', 'employment law'],
    ['seleksi', 'selection'], ['pelatihan', 'training'],
  ];

  // Ciri pribadi yang tidak boleh menjadi dasar seleksi tanpa alasan pekerjaan yang sah.
  const PROTECTED = /\b(jenis kelamin|gender|pria|wanita|laki-laki|perempuan|agama|islam|kristen|katolik|hindu|buddha|konghucu|suku|etnis|ras|status (pernikahan|perkawinan)|menikah|lajang|usia|umur|penampilan menarik|golongan darah|tinggi badan|berat badan)\b/i;

  const normalize = s => String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―−]/g, '-').replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n');

  const parseList = str => {
    const seen = new Set(), out = [];
    String(str || '').split(/[,;\n]+/).forEach(x => {
      const t = x.trim(), k = t.toLowerCase();
      if (t && !seen.has(k)) { seen.add(k); out.push(t); }
    });
    return out;
  };

  const esc = t => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  function termRegex(term) {
    const body = term.trim().split(/[\s-]+/).filter(Boolean).map(esc).join('[\\s\\-]+');
    return new RegExp('(?<![\\p{L}\\p{N}])' + body + '(?![\\p{L}\\p{N}])', 'iu');
  }

  function expandTerm(item) {
    const out = [];
    const add = t => { if (t && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t); };
    item.split('/').map(x => x.trim()).filter(Boolean).forEach(alt => {
      add(alt);
      const group = SYNONYMS.find(g => g.includes(alt.toLowerCase()));
      if (group) group.forEach(add);
      // "Microsoft Excel" di ketentuan harus tetap cocok dengan "Excel" atau "MS Excel" di CV.
      const brand = /^(microsoft|ms\.?|adobe|autodesk|google)\s+(.+)$/i.exec(alt);
      if (brand) add(brand[2]);
    });
    return out;
  }

  function snippetAt(text, index, length) {
    let a = text.lastIndexOf('\n', index) + 1, b = text.indexOf('\n', index + length);
    if (b < 0) b = text.length;
    a = Math.max(a, index - 60); b = Math.min(b, index + length + 60);
    return text.slice(a, b).replace(/\s+/g, ' ').trim();
  }

  function matchTerm(text, item) {
    for (const term of expandTerm(item)) {
      const m = termRegex(term).exec(text);
      if (m) return { found: true, item, term, snippet: snippetAt(text, m.index, m[0].length) };
    }
    return { found: false, item };
  }

  // ---- Pembagian bagian CV ----
  const HDR_OTHER = /^(professional summary|career summary|pengalaman magang|magang|internship|internships|internship experience|keahlian|kemampuan|kompetensi|skills?|technical skills|hard skills?|soft skills?|sertifikat|sertifikasi|certifications?|certificates?|pelatihan|training|kursus|courses?|organisasi|pengalaman organisasi|organi[sz]ational experience|organi[sz]ations?|proyek|projects?|bahasa|languages?|referensi|references?|ringkasan|profil|profil singkat|profile|summary|tentang saya|about me|prestasi|penghargaan|awards?|achievements?|data pribadi|data diri|personal data|personal information|personal details|kontak|contact|publikasi|publications?|hobi|interests?|volunteer|kegiatan)$/;
  const HDR_EXP = /^(pengalaman|pengalaman kerja|pengalaman profesional|pengalaman bekerja|riwayat pekerjaan|riwayat kerja|riwayat pengalaman|pengalaman proyek|work experience|work experiences|working experience|working experiences|professional experience|professional experiences|project experience|project experiences|employment|employment history|employment record|experience|experiences|career history)$/;
  const HDR_EDU = /^(pendidikan|pendidikan formal|pendidikan terakhir|riwayat pendidikan|latar belakang pendidikan|education|education background|educational background|education history|academic background)$/;

  function headerType(line) {
    const raw = line.trim();
    if (!raw || raw.length > 48) return null;
    let h = raw.toLowerCase();
    if (/^(\p{L}\s)+\p{L}$/u.test(h)) h = h.replace(/\s/g, '');
    h = h.split(/[/&|]/)[0].replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
    if (HDR_OTHER.test(h)) return 'other';
    if (HDR_EXP.test(h)) return 'exp';
    if (HDR_EDU.test(h)) return 'edu';
    return null;
  }

  function splitSections(text) {
    const buf = { head: [], exp: [], edu: [], other: [] };
    let cur = 'head', hasExp = false, hasEdu = false;
    text.split('\n').forEach(line => {
      const t = headerType(line);
      if (t) { cur = t; hasExp = hasExp || t === 'exp'; hasEdu = hasEdu || t === 'edu'; return; }
      buf[cur].push(line);
    });
    return {
      exp: buf.exp.join('\n'), edu: buf.edu.join('\n'),
      rest: buf.head.concat(buf.other).join('\n'), hasExp, hasEdu,
    };
  }

  // ---- Lama pengalaman ----
  const MON = 'januari|january|jan|februari|february|feb|maret|march|mar|april|apr|mei|may|juni|june|jun|juli|july|jul|agustus|august|agu|agt|ags|aug|september|sept|sep|oktober|october|okt|oct|nopember|november|nov|desember|december|des|dec';
  const DATE = `(?:(?:(?:\\d{1,2}\\s+)?(${MON})\\.?,?\\s*(?:\\d{1,2},\\s*)?)?(\\d{4})|(\\d{1,2})[/.\\-](\\d{4}))`;
  const NOW_WORDS = 'sekarang|saat ini|kini|present|current|now|today|ongoing|masih bekerja';
  const SEP = '\\s*(?:-|to|s\\.?\\s?d\\.?|s/d|sampai(?:\\s+dengan)?|hingga|until)\\s*';
  const RANGE = new RegExp(`(?<![\\p{L}\\p{N}/.\\-])${DATE}${SEP}(?:${DATE}|(${NOW_WORDS}))(?![\\p{L}\\p{N}])`, 'giu');
  const MONTH_KEYS = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, agt: 7, ags: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, nop: 10, des: 11, dec: 11 };

  function dateParts(name, year, num, numYear) {
    if (numYear) {
      const m = +num - 1;
      return m >= 0 && m < 12 ? { y: +numYear, m } : null;
    }
    if (!year) return null;
    return { y: +year, m: name ? MONTH_KEYS[name.slice(0, 3).toLowerCase()] : null };
  }

  function parseIntervals(text, now) {
    const nowIdx = now.getFullYear() * 12 + now.getMonth() + 1, out = [];
    RANGE.lastIndex = 0;
    let r;
    while ((r = RANGE.exec(text))) {
      const a = dateParts(r[1], r[2], r[3], r[4]);
      if (!a || a.y < 1960) continue;
      const start = a.y * 12 + (a.m === null ? 0 : a.m);
      let end, precise = a.m !== null;
      if (r[9]) end = nowIdx;
      else {
        const b = dateParts(r[5], r[6], r[7], r[8]);
        if (!b) continue;
        end = b.m === null ? b.y * 12 : b.y * 12 + b.m + 1;
        precise = precise && b.m !== null;
      }
      end = Math.min(end, nowIdx);
      if (end > start) out.push({ start, end, precise });
    }
    // Rentang tanpa bulan (misalnya tahun proyek di dalam satu jabatan) tidak boleh memperpanjang
    // rentang yang sudah jelas bulannya, karena awal tahunnya hanya perkiraan.
    const exact = out.filter(i => i.precise);
    return out
      .filter(i => i.precise || !exact.some(p => i.start < p.end && p.start < i.end))
      .map(i => [i.start, i.end]);
  }

  function mergedMonths(intervals) {
    const s = intervals.slice().sort((p, q) => p[0] - q[0]);
    let total = 0, cs = null, ce = null;
    s.forEach(([a, b]) => {
      if (ce === null || a > ce) { if (ce !== null) total += ce - cs; cs = a; ce = b; }
      else ce = Math.max(ce, b);
    });
    if (ce !== null) total += ce - cs;
    return total;
  }

  const EDU_LINE = /universitas|university|institut|politeknik|polytechnic|sekolah|fakultas|jurusan|\bIPK\b|\bGPA\b|\bSMA\b|\bSMK\b|\bS-?[123]\b|\bD-?[34]\b|sarjana|bachelor/i;

  function claimedYears(text) {
    const unit = '(?:tahun|thn|years?|yrs?)', word = '(?:pengalaman|berpengalaman|experience)';
    const res = [
      new RegExp(`(\\d{1,2})\\s*\\+?\\s*${unit}\\s*(?:lebih\\s+)?(?:of\\s+)?${word}`, 'gi'),
      new RegExp(`${word}[^\\n.]{0,40}?(\\d{1,2})\\s*\\+?\\s*${unit}`, 'gi'),
    ];
    let best = null;
    res.forEach(re => {
      let m;
      while ((m = re.exec(text))) {
        const v = +m[1];
        if (v > 0 && v <= 50 && (best === null || v > best)) best = v;
      }
    });
    return best;
  }

  function experience(text, sec, now) {
    const source = sec.hasExp
      ? sec.exp
      : (sec.rest + '\n' + sec.exp).split('\n').filter(l => !EDU_LINE.test(l)).join('\n');
    let months = mergedMonths(parseIntervals(source, now));
    // Judul pengalaman ada tetapi tanggalnya tertulis di luar bagian itu.
    if (!months && sec.hasExp) months = mergedMonths(parseIntervals(sec.rest.split('\n').filter(l => !EDU_LINE.test(l)).join('\n'), now));
    const claim = claimedYears(text);
    if (months > 0) {
      return { years: Math.round(months / 12 * 10) / 10, source: 'tanggal', claim };
    }
    if (claim !== null) return { years: claim, source: 'pernyataan', claim };
    return { years: null, source: null, claim: null };
  }

  // ---- Pendidikan, IPK, kontak ----
  function detectLevel(text) {
    for (const [k, re] of LEVEL_PATTERNS) {
      const m = re.exec(text);
      if (m) return { level: k, snippet: snippetAt(text, m.index, m[0].length) };
    }
    return null;
  }

  function detectIpk(text) {
    const re = /(?:IPK|GPA)\s*[:=]?\s*(\d[.,]\d{1,2})/gi;
    let m, best = null;
    while ((m = re.exec(text))) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v <= 4 && (best === null || v > best)) best = v;
    }
    return best;
  }

  // Baris jabatan sering berada di atas CV dan tidak boleh terbaca sebagai nama.
  const JOB_TITLE = /\b(surveyor|engineer|engineering|drafter|arsitek|architect|manager|manajer|staff|staf|supervisor|officer|konsultan|consultant|teknik|estimator|inspector|inspektur|pelaksana|portfolio|portofolio|profile|profil)\b/i;

  function detectName(text, fallback) {
    const labeled = /^\s*(?:nama(?: lengkap)?|full name|name)\s*:?[ \t]*\n?[ \t]*:?[ \t]*([^\n:@\d]{3,60})$/im.exec(text);
    if (labeled && !JOB_TITLE.test(labeled[1])) return labeled[1].trim();
    const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8);
    for (const l of lines) {
      if (headerType(l)) break; // nama selalu berada sebelum bagian pertama CV
      if (l.length < 3 || l.length > 60 || /[@\d:<>=]/.test(l)) continue;
      if (/^(curriculum vitae|daftar riwayat hidup|riwayat hidup|resume|cv)$/i.test(l) || JOB_TITLE.test(l)) continue;
      if (/\p{L}/u.test(l)) return l;
    }
    return fallback;
  }

  function extractFacts(rawText, fileName, now) {
    const text = normalize(rawText);
    const sec = splitSections(text);
    const when = now || new Date();
    const edu = (sec.hasEdu && detectLevel(sec.edu)) || detectLevel(text);
    const email = (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [''])[0];
    const phone = ((text.match(/(?:\+?62|0)[\s-]?8\d[\d\s-]{7,13}\d/) || [''])[0]).replace(/\s+/g, ' ').trim();
    return {
      text, sec,
      name: detectName(text, String(fileName || '').replace(/\.[^.]+$/, '')),
      email, phone,
      level: edu ? edu.level : null,
      levelSnippet: edu ? edu.snippet : '',
      ipk: detectIpk(text),
      exp: experience(text, sec, when),
      readable: text.replace(/\s/g, '').length >= 80,
    };
  }

  // ---- Ketentuan & penilaian ----
  const defaultCriteria = () => ({
    posisi: '',
    pendidikan: { level: '', wajib: true, bobot: 20 },
    jurusan: { items: '', wajib: false, bobot: 15 },
    ipk: { min: '', wajib: false, bobot: 5 },
    pengalaman: { tahun: '', wajib: true, bobot: 25 },
    keahlian: { items: '', wajib: true, bobot: 25 },
    nilaiTambah: { items: '', bobot: 5 },
    sertifikasi: { items: '', wajib: false, bobot: 5 },
    lokasi: { items: '', wajib: false, bobot: 5 },
    tambahan: [],
    ambang: 70,
  });

  const num = v => {
    const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const idn = (n, digits) => (digits === undefined ? String(n) : n.toFixed(digits)).replace('.', ',');

  function listCheck(id, label, cfg, items, text, mode) {
    const res = items.map(i => matchTerm(text, i));
    const hit = res.filter(r => r.found), miss = res.filter(r => !r.found).map(r => r.item);
    const nilai = mode === 'all' ? hit.length / res.length : (hit.length ? 1 : 0);
    const status = nilai === 1 ? 'ok' : nilai > 0 ? 'partial' : 'no';
    const detail = mode === 'all'
      ? `Ditemukan ${hit.length} dari ${res.length}` + (miss.length ? `. Tidak ditemukan: ${miss.join(', ')}` : '')
      : hit.length ? `Cocok: ${hit.map(h => h.item).join(', ')}` : `Tidak ditemukan: ${miss.join(', ')}`;
    return { id, label, bobot: num(cfg.bobot), wajib: !!cfg.wajib, status, nilai, detail, bukti: hit.map(h => ({ term: h.term, snippet: h.snippet })) };
  }

  function buildChecks(f, c) {
    const checks = [];
    const eduText = f.sec.hasEdu ? f.sec.edu + '\n' + f.text : f.text;

    const need = levelOf(c.pendidikan.level);
    if (need) {
      const have = levelOf(f.level);
      const base = { id: 'pendidikan', label: `Pendidikan minimal ${need.label}`, bobot: num(c.pendidikan.bobot), wajib: !!c.pendidikan.wajib };
      if (!have) checks.push({ ...base, status: 'unknown', nilai: 0, detail: 'Jenjang pendidikan tidak terbaca dari CV', bukti: [] });
      else {
        const ok = have.rank >= need.rank;
        checks.push({ ...base, status: ok ? 'ok' : 'no', nilai: ok ? 1 : 0, detail: `Terbaca ${have.label}`, bukti: f.levelSnippet ? [{ term: have.label, snippet: f.levelSnippet }] : [] });
      }
    }

    const jurusan = parseList(c.jurusan.items);
    if (jurusan.length) checks.push(listCheck('jurusan', 'Jurusan', c.jurusan, jurusan, eduText, 'any'));

    const minIpk = num(c.ipk.min);
    if (minIpk > 0) {
      const base = { id: 'ipk', label: `IPK minimal ${idn(minIpk, 2)}`, bobot: num(c.ipk.bobot), wajib: !!c.ipk.wajib, bukti: [] };
      if (f.ipk === null) checks.push({ ...base, status: 'unknown', nilai: 0, detail: 'IPK tidak tercantum di CV' });
      else {
        const ok = f.ipk >= minIpk;
        checks.push({ ...base, status: ok ? 'ok' : 'no', nilai: ok ? 1 : 0, detail: `Terbaca IPK ${idn(f.ipk, 2)}` });
      }
    }

    const minYears = num(c.pengalaman.tahun);
    if (minYears > 0) {
      const base = { id: 'pengalaman', label: `Pengalaman minimal ${idn(minYears)} tahun`, bobot: num(c.pengalaman.bobot), wajib: !!c.pengalaman.wajib, bukti: [] };
      const y = f.exp.years;
      if (y === null) checks.push({ ...base, status: 'unknown', nilai: 0, detail: 'Lama pengalaman tidak terbaca dari CV' });
      else {
        const nilai = Math.min(1, y / minYears);
        const src = f.exp.source === 'tanggal' ? 'dihitung dari tanggal kerja' : 'dari pernyataan di CV, tanpa tanggal kerja';
        const claim = f.exp.source === 'tanggal' && f.exp.claim !== null && f.exp.claim !== Math.round(y) ? `; CV menyatakan ${f.exp.claim} tahun` : '';
        checks.push({ ...base, status: nilai >= 1 ? 'ok' : (c.pengalaman.wajib || y === 0 ? 'no' : 'partial'), nilai, detail: `Sekitar ${idn(y)} tahun (${src}${claim})` });
      }
    }

    const keahlian = parseList(c.keahlian.items);
    if (keahlian.length) checks.push(listCheck('keahlian', 'Keahlian', c.keahlian, keahlian, f.text, 'all'));
    const tambah = parseList(c.nilaiTambah.items);
    if (tambah.length) checks.push(listCheck('nilaiTambah', 'Nilai tambah', { ...c.nilaiTambah, wajib: false }, tambah, f.text, 'all'));
    const sert = parseList(c.sertifikasi.items);
    if (sert.length) checks.push(listCheck('sertifikasi', 'Sertifikasi', c.sertifikasi, sert, f.text, 'any'));
    const lokasi = parseList(c.lokasi.items);
    if (lokasi.length) checks.push(listCheck('lokasi', 'Lokasi', c.lokasi, lokasi, f.text, 'any'));

    (c.tambahan || []).forEach((t, i) => {
      const items = parseList(t.kata);
      if (items.length) checks.push(listCheck('tambahan' + i, t.label || 'Ketentuan tambahan', t, items, f.text, 'any'));
    });
    return checks;
  }

  // Kata kunci yang diulang berlebihan menandakan CV sengaja diisi untuk mengelabui pencocokan.
  function stuffing(text, c) {
    const items = parseList(c.keahlian.items).concat(parseList(c.nilaiTambah.items));
    const hit = items.filter(i => expandTerm(i).some(t => (text.match(new RegExp(termRegex(t).source, 'giu')) || []).length >= 12));
    return hit.length ? `Kata kunci berulang tidak wajar: ${hit.join(', ')}. Periksa CV aslinya.` : '';
  }

  function evaluate(facts, criteria) {
    const c = criteria;
    const checks = buildChecks(facts, c);
    if (!checks.length) return { checks, score: null, rekomendasi: null, alasan: [] };

    const totalBobot = checks.reduce((s, x) => s + x.bobot, 0);
    const raw = totalBobot > 0 ? checks.reduce((s, x) => s + x.bobot * x.nilai, 0) / totalBobot * 100 : 0;
    const score = Math.round(raw);
    const ambang = num(c.ambang);

    const failed = checks.filter(x => x.wajib && x.status !== 'ok' && x.status !== 'unknown');
    const unknown = checks.filter(x => x.wajib && x.status === 'unknown');
    let rekomendasi, alasan;
    if (failed.length) {
      rekomendasi = 'tidak';
      alasan = failed.map(x => `${x.label}: ${x.detail}`);
    } else if (unknown.length) {
      rekomendasi = 'cek';
      alasan = unknown.map(x => `${x.label}: ${x.detail}`);
    } else if (score >= ambang) {
      rekomendasi = 'lolos';
      alasan = [`Semua ketentuan wajib terpenuhi, skor ${score} mencapai ambang ${ambang}`];
    } else if (score >= ambang - 20) {
      rekomendasi = 'pertimbangkan';
      alasan = [`Ketentuan wajib terpenuhi, skor ${score} sedikit di bawah ambang ${ambang}`];
    } else {
      rekomendasi = 'tidak';
      alasan = [`Skor ${score} jauh di bawah ambang ${ambang}`];
    }
    return { checks, score, rekomendasi, alasan, peringatan: stuffing(facts.text, c) };
  }

  // ---- Membaca teks lowongan menjadi ketentuan ----
  const cleanItem = s => s.replace(/^\s*(memiliki|mempunyai|punya|yang|dari|di|pada|dengan|seperti|antara lain|berpengalaman|program)\s+/i, '').replace(/[\s:.]+$/, '').trim();
  const splitItems = s => s.split(/,|\/|&|\bdan\b|\batau\b|\bserta\b/i).map(cleanItem).filter(x => x.length > 1);

  function parseKetentuan(input) {
    const out = { level: '', tahun: '', ipk: '', jurusan: [], keahlian: [], nilaiTambah: [], sertifikasi: [], lokasi: [], diabaikan: [] };
    const push = (arr, items) => items.forEach(i => { if (!arr.some(a => a.toLowerCase() === i.toLowerCase())) arr.push(i); });

    normalize(input).split(/\n|;/).map(l => l.replace(/^[\s\-*•\d.)]+/, '').trim()).filter(Boolean).forEach(line => {
      if (PROTECTED.test(line)) { out.diabaikan.push(line); return; }
      let m;
      if ((m = /\b(nilai tambah|diutamakan|lebih disukai)\b\s*:?\s*(.+)$/i.exec(line))) { push(out.nilaiTambah, splitItems(m[2])); return; }

      if ((m = /\b(?:minimal|minimum|min\.?|pendidikan|lulusan)\b[^\n]{0,20}?\b(S-?[123]|D-?[34]|SMA|SMK|sarjana|diploma)\b/i.exec(line))) {
        const v = m[1].toLowerCase().replace('-', '');
        out.level = { s1: 's1', s2: 's2', s3: 's3', d3: 'd3', d4: 's1', sma: 'sma', smk: 'sma', sarjana: 's1', diploma: 'd3' }[v] || '';
      }
      if ((m = /\b(?:IPK|GPA)\b[^\d\n]{0,15}(\d[.,]\d{1,2})/i.exec(line))) out.ipk = m[1].replace(',', '.');
      if ((m = /(?:pengalaman|experience)[^\n]{0,40}?(\d{1,2})\s*\+?\s*(?:tahun|thn|years?)/i.exec(line)) ||
          (m = /(\d{1,2})\s*\+?\s*(?:tahun|thn|years?)\s*(?:pengalaman|experience)/i.exec(line))) out.tahun = m[1];
      if ((m = /\b(?:jurusan|program studi|prodi)\b\s*:?\s*(.+)$/i.exec(line))) push(out.jurusan, splitItems(m[1]));
      if ((m = /\b(?:sertifikat|sertifikasi)\b\s*:?\s*(.+)$/i.exec(line))) push(out.sertifikasi, splitItems(m[1]));
      if ((m = /\b(?:domisili|berdomisili|penempatan|lokasi)\b\s*:?\s*(.+)$/i.exec(line))) push(out.lokasi, splitItems(m[1]));
      if ((m = /\b(?:menguasai|mahir|keahlian|kemampuan|skills?|memahami|familiar dengan)\b\s*:?\s*(.+)$/i.exec(line))) push(out.keahlian, splitItems(m[1]));
    });
    return out;
  }

  const findProtected = s => {
    const m = PROTECTED.exec(String(s || ''));
    return m ? m[0] : null;
  };

  const RANK = { lolos: 0, pertimbangkan: 1, cek: 2, tidak: 3 };

  const api = { headerType, LEVELS, levelOf, idn, normalize, parseList, matchTerm, expandTerm, splitSections, extractFacts, evaluate, defaultCriteria, parseKetentuan, findProtected, RANK };
  root.Screening = api;
})(typeof window !== 'undefined' ? window : globalThis);
