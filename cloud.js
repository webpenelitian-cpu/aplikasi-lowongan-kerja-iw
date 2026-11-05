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
    db = F.getFirestore(app);
  }

  async function initHr() {
    await initDb();
    if (!auth) {
      A = await import(`${SDK}/firebase-auth.js`);
      auth = A.getAuth(app);
      auth.languageCode = 'id';
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
  async function isAdmin() {
    try { return (await F.getDoc(F.doc(db, 'admins', user.uid))).exists(); } catch (e) { return false; }
  }

  const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // ---- Portal pelamar ----
  async function listLowongan() {
    await initDb();
    return rows(await F.getDocs(F.collection(db, 'lowongan')));
  }
  async function getLowongan(id) {
    await initDb();
    const s = await F.getDoc(F.doc(db, 'lowongan', id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
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
    const [pub, hr, lam] = await Promise.all(['lowongan', 'lowongan_hr', 'lamaran'].map(c => F.getDocs(F.collection(db, c))));
    const hrById = new Map(rows(hr).map(x => [x.id, x]));
    return {
      lowongan: rows(pub).map(l => {
        const { tutupPada, ...rest } = l;
        return { ...rest, ...(hrById.get(l.id) || {}) };
      }),
      kandidat: rows(lam).map(k => {
        const { cvText, dibuat, persetujuan, ...rest } = k;
        return { tahap: {}, error: '', ...rest, text: cvText === undefined ? null : cvText };
      }),
    };
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
        batch.set(ref, data, { mergeFields: Object.keys(data) });
      });
      await batch.commit();
    }
  }

  root.Cloud = { enabled, initHr, signIn, signOut, isAdmin, listLowongan, getLowongan, listPengumuman, submitLamaran, getHasil, loadAll, apply };
})(window);
