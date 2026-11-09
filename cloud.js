// Sambungan ke Firebase. SDK dimuat hanya saat dibutuhkan.
(function (root) {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
  const cfg = root.FIREBASE_CONFIG || {};
  let A = null, F = null, app = null, auth = null, db = null, user = null;

  const enabled = () => !!(cfg.apiKey && cfg.projectId && cfg.appId);

  // Simpan data di perangkat untuk dipakai offline: hanya halaman HR, hanya bila HR memilihnya, dan dihapus saat keluar.
  const KUNCI_OFFLINE = 'hr-simpan-offline';
  let persist = false, tertunda = 0;
  const simpanOffline = () => { try { return localStorage.getItem(KUNCI_OFFLINE) === '1'; } catch (e) { return false; } };
  const aturSimpanOffline = v => { try { if (v) localStorage.setItem(KUNCI_OFFLINE, '1'); else localStorage.removeItem(KUNCI_OFFLINE); } catch (e) { /* mode privat */ } };
  const offlineAktif = () => persist;
  const perluMuatUlang = () => simpanOffline() !== persist; // dipanggil setelah masuk: database dibuka ulang dengan pilihan baru

  async function initApp() {
    if (app) return;
    const [appMod, fsMod] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`)]);
    F = fsMod;
    app = appMod.initializeApp(cfg);
    // CAPTCHA tanpa teka-teki: tiap permintaan membawa token reCAPTCHA yang diperiksa Firebase.
    if (cfg.recaptchaSiteKey) {
      const ac = await import(`${SDK}/firebase-app-check.js`);
      ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(cfg.recaptchaSiteKey), isTokenAutoRefreshEnabled: false }); // token diambil saat dibutuhkan, agar tetap di kuota gratis
    }
  }

  // adaUser: salinan di perangkat hanya dipakai saat HR masuk. Saat belum masuk (misalnya browser sempat ditutup tanpa keluar), salinan lama dihapus.
  async function initDb(hr, adaUser) {
    if (db) return;
    await initApp();
    persist = !!hr && !!adaUser && simpanOffline();
    if (persist) {
      db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } else {
      // Bila HR berhenti memakai mode offline, salinan lama di perangkat ikut dibersihkan.
      if (hr) await F.clearIndexedDbPersistence(F.getFirestore(app)).catch(() => {});
      db = F.getFirestore(app);
    }
  }

  async function initHr() {
    await initApp();
    if (!auth) {
      A = await import(`${SDK}/firebase-auth.js`);
      auth = A.getAuth(app);
      auth.languageCode = 'id';
      // Sesi berakhir saat browser ditutup, supaya data pelamar tidak terbuka di komputer bersama.
      await A.setPersistence(auth, A.browserSessionPersistence);
    }
    user = await new Promise(res => { const off = A.onAuthStateChanged(auth, u => { off(); res(u); }); });
    await initDb(true, !!user);
    return user;
  }

  async function signIn() {
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    user = (await A.signInWithPopup(auth, p)).user;
    return user;
  }
  async function signOut() {
    await A.signOut(auth);
    user = null;
    if (persist) { await F.terminate(db); await F.clearIndexedDbPersistence(db).catch(() => {}); } // data pelamar tidak tertinggal di perangkat
  }
  const jumlahTertunda = () => tertunda;
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
    try { return (await F.getDoc(F.doc(db, 'admins', user.uid))).exists(); } catch (e) { if (!navigator.onLine) throw e; return false; }
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
  async function kirimSurvei(kode, data) {
    await initDb();
    await F.setDoc(F.doc(db, 'survei', kode), { ...data, dibuat: F.serverTimestamp() });
  }
  async function getHasil(kode) {
    await initDb();
    const s = await F.getDoc(F.doc(db, 'hasil', kode));
    return s.exists() ? s.data() : null;
  }

  // ---- Aplikasi HR ----
  async function loadAll() {
    const [lowongan, lam, survei] = await Promise.all([muatLowongan(), F.getDocs(F.collection(db, 'lamaran')), muatSurvei()]);
    return { lowongan, kandidat: rows(lam).map(lamaranKe), survei };
  }

  // Id survei adalah kode pelamar, jadi tidak dibawa ke tampilan HR. Survei tidak boleh menggagalkan pemuatan data utama.
  async function muatSurvei() {
    try {
      return rows(await F.getDocs(F.collection(db, 'survei'))).map(({ id, dibuat, ...s }) => s);
    } catch (e) { return []; }
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
      const kirim = batch.commit();
      if (navigator.onLine) { await kirim; continue; }
      // Offline: perubahan antre di perangkat dan dikirim otomatis saat tersambung.
      if (!persist) { kirim.catch(() => {}); throw new Error('offline'); }
      tertunda += 1;
      kirim.catch(() => {}).finally(() => { tertunda -= 1; });
    }
  }

  root.Cloud = { simpanOffline, aturSimpanOffline, offlineAktif, perluMuatUlang, jumlahTertunda, kirimSurvei, muatSurvei, newLamaran, ubahLamaran, muatLowongan, email, reserveNomor, enabled, initHr, signIn, signOut, isAdmin, listLowongan, getLowongan, listPengumuman, submitLamaran, getHasil, loadAll, apply };
})(window);
