// Membaca teks dari file CV di browser. Dipakai portal pelamar dan aplikasi HR.
(function (root) {
  'use strict';
  const MAX_SIZE = 15 * 1024 * 1024;
  const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const WORKER_SHA384 = 'SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2';
  let workerBlob = null;

  // Worker melihat isi CV, jadi keasliannya diperiksa sebelum dijalankan (atribut integrity tidak berlaku untuk worker).
  async function verifiedWorker() {
    if (workerBlob) return workerBlob;
    const buf = await (await fetch(WORKER_URL)).arrayBuffer();
    const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-384', buf))));
    if (hash !== WORKER_SHA384) throw new Error('Pembaca PDF gagal diverifikasi. Muat ulang halaman atau gunakan file DOCX.');
    workerBlob = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
    return workerBlob;
  }

  const MIN_FONT = 4;
  const MAX_PAGES = 30;

  function linesOf(items) {
    const lines = [];
    items.forEach(i => {
      let line = lines.find(ln => Math.abs(ln.y - i.y) < 3);
      if (!line) { line = { y: i.y, parts: [] }; lines.push(line); }
      line.parts.push(i);
    });
    lines.sort((a, b) => b.y - a.y);
    return lines.map(ln => {
      ln.parts.sort((a, b) => a.x - b.x);
      return ln.parts.reduce((acc, p, idx) => {
        const prev = ln.parts[idx - 1];
        const gap = prev && p.x - prev.end > 1 && !/\s$/.test(acc) && !/^\s/.test(p.s);
        return acc + (gap ? ' ' : '') + p.s;
      }, '');
    }).join('\n');
  }

  // Mencari celah vertikal di tengah halaman. Boleh dilintasi sedikit baris lebar seperti nama atau judul.
  function findGutter(items, width) {
    if (items.length < 16) return null;
    const BIN = 4, bins = new Array(Math.ceil(width / BIN)).fill(0);
    items.forEach(i => {
      for (let b = Math.floor(i.x / BIN); b <= Math.floor(i.end / BIN) && b < bins.length; b++) if (b >= 0) bins[b]++;
    });
    const limit = Math.max(2, items.length * 0.08);
    const from = Math.floor(width * 0.2 / BIN), to = Math.ceil(width * 0.8 / BIN);
    let best = null, start = null;
    for (let b = from; b <= to; b++) {
      if (bins[b] <= limit) { if (start === null) start = b; continue; }
      if (start !== null && (!best || b - start > best[1] - best[0])) best = [start, b];
      start = null;
    }
    if (!best || (best[1] - best[0]) * BIN < 12) return null;
    const g = (best[0] + best[1]) / 2 * BIN;
    const left = new Set(items.filter(i => i.end <= g).map(i => Math.round(i.y)));
    const right = new Set(items.filter(i => i.x >= g).map(i => Math.round(i.y)));
    return left.size >= 8 && right.size >= 8 ? g : null;
  }

  async function pdfText(file) {    if (!root.pdfjsLib) throw new Error('Pembaca PDF belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = await verifiedWorker();
    // isEvalSupported dimatikan untuk menutup CVE-2024-4367; PDF yang sangat panjang dibatasi.
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    const pages = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      // Teks sangat kecil tidak terbaca manusia, jadi tidak ikut dinilai (trik menyisipkan kata kunci).
      const items = content.items.filter(i => i.str && i.str.trim() && Math.abs(i.transform[3]) >= MIN_FONT)
        .map(i => ({ y: i.transform[5], x: i.transform[4], s: i.str, end: i.transform[4] + (i.width || 0) }));
      const gutter = findGutter(items, page.getViewport({ scale: 1 }).width);
      if (gutter === null) { pages.push(linesOf(items)); continue; }
      // CV dua kolom: baca baris lebar di atas, lalu kolom kiri sampai habis, baru kolom kanan.
      const cross = items.filter(i => i.x < gutter && i.end > gutter);
      pages.push([cross, items.filter(i => i.end <= gutter), items.filter(i => i.x >= gutter)].map(linesOf).filter(Boolean).join('\n'));
    }
    await doc.destroy();
    return pages.join('\n');
  }

  async function docxText(file) {
    if (!root.mammoth) throw new Error('Pembaca DOCX belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }

  async function read(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (file.size > MAX_SIZE) throw new Error('Ukuran file lebih dari 15 MB.');
    if (ext === 'pdf') return pdfText(file);
    if (ext === 'docx') return docxText(file);
    if (ext === 'txt') return file.text();
    if (ext === 'doc') throw new Error('Format .doc lama belum didukung. Simpan ulang sebagai .docx atau PDF.');
    throw new Error('Format file tidak didukung. Gunakan PDF, DOCX, atau TXT.');
  }

  function friendlyError(e) {
    if (e && e.name === 'PasswordException') return 'PDF dikunci dengan kata sandi.';
    if (e && e.name === 'InvalidPDFException') return 'File PDF rusak atau bukan PDF.';
    return (e && e.message) || 'File tidak bisa dibaca.';
  }

  root.BacaCV = { read, friendlyError };
})(window);
