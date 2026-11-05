// Sambungan ke Firebase. SDK dimuat hanya saat dibutuhkan.
(function (root) {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
  const cfg = root.FIREBASE_CONFIG || {};
  let A = null, F = null, app = null, auth = null, db = null, user = null;

  const enabled = () => !!(cfg.apiKey && cfg.projectId && cfg.appId);

  async function initDb() {
    if (db) return;
    const [appMod, fsMod] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`)]);
    F = fsMod;
    app = appMod.initializeApp(cfg);
    // CAPTCHA tanpa teka-teki: tiap permintaan membawa token reCAPTCHA yang diperiksa Firebase.
    if (cfg.recaptchaSiteKey) {
      const ac = await import(`${SDK}/firebase-app-check.js`);
      ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(cfg.recaptchaSiteKey), isTokenAutoRefreshEnabled: false }); // token diambil saat dibutuhkan, agar tetap di kuota gratis
    }
    db = F.getFirestore(app);
  }

  async function initHr() {
    await initDb();
    if (!auth) {
      A = await import(`${SDK}/firebase-auth.js`);
      auth = A.getAuth(app);
      auth.languageCode = 'id';
      // Sesi berakhir saat browser ditutup, supaya data pelamar tidak terbuka di komputer bersama.
      await A.setPersistence(auth, A.browserSessionPersistence);
    }
    user = await new Promise(res => { const off = A.onAuthStateChanged(auth, u => { off(); res(u); }); });
    return user;
  }

  async function signIn() {
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    user = (await A.signInWithPopup(auth, p)).user;
    return user;
  }
  async function signOut() { await A.signOut(auth); user = null; }
  const email = () => (user && user.email) || '';

  // Nomor peserta diambil lewat transaksi agar dua akun HR tidak mendapat nomor yang sama.
  async function reserveNomor(lowonganId, jumlah) {
    const ref = F.doc(db, 'lowongan_hr', lowonganId);
    return F.runTransaction(db, async tx => {
      const s = await tx.get(ref);
      const awal = (s.exists() && s.data().nomorBerikut) || 0;
      tx.set(ref, { nomorBerikut: awal + jumlah }, { merge: true });
      return awal;
    });
  }
  async function isAdmin() {
    try { return (await F.getDoc(F.doc(db, 'admins', user.uid))).exists(); } catch (e) { return false; }
  }

  const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // ---- Portal pelamar ----
  async function listLowongan() {
    await initDb();
    // Draf tidak boleh terbaca publik, jadi kueri harus menyebut status yang boleh dibaca.
    return rows(await F.getDocs(F.query(F.collection(db, 'lowongan'), F.where('status', 'in', ['buka', 'tutup']))));
  }
  async function getLowongan(id) {
    await initDb();
    try {
      const s = await F.getDoc(F.doc(db, 'lowongan', id));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    } catch (e) {
      if (e && e.code === 'permission-denied') return null; // draf terlihat seperti tidak ada
      throw e;
    }
  }
  async function listPengumuman(lowonganId) {
    await initDb();
    return rows(await F.getDocs(F.query(F.collection(db, 'pengumuman'), F.where('lowonganId', '==', lowonganId))));
  }
  async function submitLamaran(kode, data) {
    await initDb();
    await F.setDoc(F.doc(db, 'lamaran', kode), { ...data, dibuat: F.serverTimestamp() });
  }
  async function getHasil(kode) {
    await initDb();
    const s = await F.getDoc(F.doc(db, 'hasil', kode));
    return s.exists() ? s.data() : null;
  }

  // ---- Aplikasi HR ----
  async function loadAll() {
    const [lowongan, lam] = await Promise.all([muatLowongan(), F.getDocs(F.collection(db, 'lamaran'))]);
    return { lowongan, kandidat: rows(lam).map(lamaranKe) };
  }

  async function muatLowongan() {
    const [pub, hr] = await Promise.all(['lowongan', 'lowongan_hr'].map(c => F.getDocs(F.collection(db, c))));
    const hrById = new Map(rows(hr).map(x => [x.id, x]));
    return rows(pub).map(l => {
      const { tutupPada, ...rest } = l;
      return { ...rest, ...(hrById.get(l.id) || {}) };
    });
  }

  function lamaranKe(k) {
    const { cvText, dibuat, diubah, persetujuan, ...rest } = k;
    return { tahap: {}, error: '', ...rest, text: cvText === undefined ? null : cvText, dibuatMs: dibuat && dibuat.toMillis ? dibuat.toMillis() : 0, diubahMs: diubah && diubah.toMillis ? diubah.toMillis() : 0 };
  }

  // Lamaran setelah waktu tertentu saja: hemat kuota baca dan unduhan.
  async function newLamaran(sejakMs) {
    const q = F.query(F.collection(db, 'lamaran'), F.where('dibuat', '>', F.Timestamp.fromMillis(sejakMs)));
    return rows(await F.getDocs(q)).map(lamaranKe);
  }

  // Lamaran yang diubah akun HR lain setelah waktu tertentu.
  async function ubahLamaran(sejakMs) {
    const q = F.query(F.collection(db, 'lamaran'), F.where('diubah', '>', F.Timestamp.fromMillis(sejakMs)));
    return rows(await F.getDocs(q)).map(lamaranKe);
  }

  // sets: daftar [jalur, data]. Hanya kolom yang dikirim yang diganti, jadi waktu kirim dan persetujuan pelamar tetap utuh.
  async function apply(sets, deletes) {
    const ops = sets.map(([p, v]) => ['set', p, v]).concat(deletes.map(p => ['del', p]));
    for (let i = 0; i < ops.length; i += 400) {
      const batch = F.writeBatch(db);
      ops.slice(i, i + 400).forEach(([kind, p, v]) => {
        const ref = F.doc(db, ...p.split('/'));
        if (kind === 'del') { batch.delete(ref); return; }
        const data = { ...v };
        if (data.tutupPada) data.tutupPada = new Date(data.tutupPada);
        if (p.startsWith('lamaran/')) data.diubah = F.serverTimestamp();
        batch.set(ref, data, { mergeFields: Object.keys(data) });
      });
      await batch.commit();
    }
  }

  root.Cloud = { newLamaran, ubahLamaran, muatLowongan, email, reserveNomor, enabled, initHr, signIn, signOut, isAdmin, listLowongan, getLowongan, listPengumuman, submitLamaran, getHasil, loadAll, apply };
})(window);
