# Tanjung Priok — Fleet & Finance

Dashboard internal trucking berbahasa Indonesia. Node.js 22+, tanpa dependency runtime tambahan.

## Fitur

Ringkasan keuangan, filter periode/armada, komposisi biaya, input/edit transaksi, peninjauan data tidak lengkap, pencarian, ekspor CSV, cadangan JSON, impor dengan deduplikasi ID, status armada, driver, jadwal servis/dokumen, trip manual, laporan mingguan dan riwayat penyimpanan.

## Lokal

Salin `.env.example` ke `.env.local`. Isi APP_PASSWORD (minimal 12 karakter) dan SESSION_SECRET (minimal 32 karakter acak).

```
node --env-file=.env.local server.mjs
```

Buka http://127.0.0.1:3100. Tanpa Redis, data lokal ada di `.local/data.json` yang diabaikan Git. LOCAL_PREVIEW=1 melewati login hanya pada server lokal loopback dan selalu diabaikan di Vercel.

## Deploy Vercel

1. Import repository `jefriadriann/TanjungPriuk`. Framework: **Other**. Build: `node scripts/build.mjs`. Output: `dist`.
2. Hubungkan database **Upstash Redis** milik bisnis melalui Vercel Marketplace atau Upstash. Gunakan penyimpanan permanen, bukan database sementara.
3. Isi environment variables: APP_PASSWORD, SESSION_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. Jangan bagikan nilainya di chat atau commit ke GitHub.
4. Deploy/redeploy, lalu login memakai kata sandi tim.
5. Buka **Data & pengaturan > Impor data JSON**, pilih file konversi privat yang disediakan terpisah.
6. Uji tambah transaksi dan refresh dari perangkat lain. Unduh cadangan rutin.

Data keuangan asli sengaja tidak disertakan di repo public ini. Jangan menaruhnya di public/, dist/, atau Git. API membutuhkan autentikasi; penyimpanan Vercel menolak fallback ke file sementara.

## Definisi & batas versi pertama

- Impor menggunakan baris transaksi, tanpa subtotal/dashboard untuk mencegah penghitungan ganda.
- Tanggal/nominal kosong tetap null. Periode gabungan Excel dipertahankan dan tidak dipecah secara rekaan.
- Ringkasan menjumlahkan nominal yang diketahui; data yang kosong tetap ditandai untuk dilengkapi.
- Selisih tercatat bukan laba bersih akuntansi atau saldo kas. Tidak mencakup transaksi yang belum dicatat, piutang, utang, atau saldo awal.
- Laporan mingguan menjumlahkan transaksi bertanggal selama 7 hari sejak tanggal awal. Transaksi tanpa tanggal tidak disertakan. Laporan mengikuti perubahan data, belum berupa pembukuan yang dikunci.
- Rit historis dan trip operasional adalah ukuran terpisah dan tidak dijumlahkan.
- Status armada/trip diperbarui manual. Belum termasuk GPS, invoice/piutang, peran per pengguna, atau buku besar akuntansi.
- Kata sandi dibagikan untuk tim internal; seluruh pengguna yang masuk dapat membaca/memperbarui. Riwayat mencatat penyimpanan workspace tanpa identitas per pengguna.
- Rotasi APP_PASSWORD dan SESSION_SECRET bersamaan untuk mengakhiri semua sesi.
- Database menyimpan satu dokumen workspace dengan pemeriksaan revisi atomik. Untuk banyak pengguna/transaksi atau peran granular, migrasikan ke database relasional dan autentikasi per pengguna.

## Verifikasi

```
node --test tests/*.test.mjs
node scripts/build.mjs
```

[Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js) · [Upstash REST API](https://upstash.com/docs/redis/features/restapi)
