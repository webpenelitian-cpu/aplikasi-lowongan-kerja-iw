// Membaca teks dari file CV di browser. Dipakai portal pelamar dan aplikasi HR.
(function (root) {
  'use strict';
  const MAX_SIZE = 15 * 1024 * 1024;

  async function pdfText(file) {
    if (!root.pdfjsLib) throw new Error('Pembaca PDF belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const lines = [];
      content.items.filter(i => i.str).forEach(i => {
        const y = i.transform[5], x = i.transform[4];
        let line = lines.find(ln => Math.abs(ln.y - y) < 3);
        if (!line) { line = { y, parts: [] }; lines.push(line); }
        line.parts.push({ x, s: i.str, end: x + (i.width || 0) });
      });
      lines.sort((a, b) => b.y - a.y);
      pages.push(lines.map(ln => {
        ln.parts.sort((a, b) => a.x - b.x);
        return ln.parts.reduce((acc, p, idx) => {
          const prev = ln.parts[idx - 1];
          const gap = prev && p.x - prev.end > 1 && !/\s$/.test(acc) && !/^\s/.test(p.s);
          return acc + (gap ? ' ' : '') + p.s;
        }, '');
      }).join('\n'));
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
