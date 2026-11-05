// Konfigurasi proyek Firebase khusus aplikasi lowongan (terpisah dari aplikasi keuangan).
// Nilai ini memang publik; keamanan data dijaga oleh firestore.rules.
// Bila dikosongkan, hr.html berjalan tanpa server dan portal pelamar menampilkan pesan belum tersedia.
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAyYIRU20f7Ed-ZNxQXvGkKby17o9qVO38',
  authDomain: 'aplikasi-web-lowongan-kerja-iw.firebaseapp.com',
  projectId: 'aplikasi-web-lowongan-kerja-iw',
  appId: '1:451297326014:web:d959242158663aa86d3fef',
  recaptchaSiteKey: '', // kunci situs reCAPTCHA Enterprise untuk App Check (publik)
};
