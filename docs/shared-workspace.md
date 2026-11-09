# Penyimpanan bersama

Pada Vercel dengan login email wajib dan tanpa Redis, Buku transaksi, Accounting, armada, klien dan laporan kini memakai database Supabase bersama yang sama dengan Kontrol Rit. Mode publik sementara (`REQUIRE_EMAIL_LOGIN=0`) tetap tidak mendapat akses baca/tulis database tim. Redis dan penyimpanan lokal Node tidak berubah.

Workspace disimpan sebagai properti `workspace` pada JSON `state` di baris privat `tp_rit_control/main`. Tidak diperlukan tabel, grant, secret atau migrasi SQL baru. Akses tetap memakai token sesi pengguna yang telah diverifikasi dan RLS tim yang sudah ada. Snapshot workspace dan hasil sinkronisasi uang jalan ditulis dalam satu operasi bersyarat terhadap revisi baris; pembaruan bersamaan ditolak dengan HTTP 409. Revisi keuangan diperiksa terpisah sehingga perubahan rit tidak membuat seluruh formulir transaksi usang. API kontrol menggunakan sumber keuangan server ketika workspace tersedia, bukan salinan yang dikirim browser lama.

Pada pembukaan pertama oleh pengguna terautentikasi, workspace diinisialisasi dari sumber privat yang sudah dikonfigurasi. Catatan uang jalan yang belum ada dipulihkan dari pembayaran Kontrol Rit menggunakan sourceId, tanggal, armada dan nominal yang tersimpan; nama kontrol dipakai sebagai keterangan dan asal pemulihan ditandai. Tidak ada revenue atau transaksi baru yang disimpulkan dari jumlah rit. Tombstone dan sumber yang dikecualikan tidak dipulihkan.

Salinan localStorage yang lama tidak ditimpa. Saat perangkat lama membuka aplikasi, data browser disinkronkan dengan ID asli, hanya sekali untuk setiap isi salinan. Catatan manual yang belum ada ditambahkan. Koreksi terhadap data awal diterapkan hanya bila data bersama masih sama dengan baseline. Data bersama yang sudah berbeda dipertahankan; kedua versi disimpan dalam `migrationConflicts` untuk ditinjau dan dapat diunduh di Data & cadangan. Penghapusan dari browser lama tidak otomatis menghapus transaksi bersama. Catatan yang sudah dihapus di database tidak dimunculkan kembali. Salinan browser sebelum sinkronisasi juga dapat diunduh di menu tersebut.

Data yang hanya tersimpan pada perangkat yang belum membuka versi baru belum dapat dibaca dari perangkat lain. Buka situs dan masuk melalui perangkat asal untuk menyinkronkannya. Snapshot Kontrol Rit hanya dapat memulihkan uang jalan yang memiliki sourceId, bukan seluruh transaksi pendapatan/biaya lain yang hilang dari perangkat lain.

Aplikasi memeriksa pembaruan ketika jendela aktif kembali dan setiap 30 detik. Pembaruan tidak mengganti formulir terbuka atau draft Accounting. Menyimpan data dengan revisi lama ditolak; draft tetap tersedia untuk ditinjau sebelum memuat ulang. Tidak ada fallback ke simpan lokal saat database gagal.

Verifikasi: pengujian pemulihan November, migrasi browser idempoten, pelestarian konflik/tombstone, dua perangkat, compare-and-set bersamaan, dan penolakan snapshot uang jalan lama. Data uji sintetis; tidak ada data keuangan produksi di Git.
