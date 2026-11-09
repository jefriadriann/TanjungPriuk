# Kontrol Rit

Buku transaksi records gross receipts, Bagi Hasil expenses, and Uang jalan expenses separately. Gross receipts remain global business income. Armada revenue is the sum of Bagi Hasil expenses for that truck; its operating costs exclude those same share transfers. Share rows do not create another global receipt or double the trip count.

Kontrol Rit imports each dated, non-future Uang jalan transaction once when opened or reloaded. Each advance creates a separate control record, including multiple advances on one truck. Target rit follows an explicit `N rit` in the description, otherwise defaults to 5; rate initially follows amount / target when integral, otherwise Rp200,000. Check and edit target/rate to match the actual agreement. Uraian is free text. The form has no driver, client, owner or carry selector.

Use **Input ritase** to record a free-text uraian, execution date, truck, and completed quantity. Select the advance from Buku transaksi; choices follow the selected truck and show advance date/amount, sorted oldest first. The form displays provided cash and completed/target rit side by side. No order number or surat jalan number is required. Record completed rit only after checking execution. These entries reduce available funds by completed rit × agreed rate; they do not create financial transactions. Gross receipts and share rows never automatically verify execution. Corrections void a completion with an explanation and retain history. Existing surat jalan, verification, funding, and audit history remain readable; pending legacy documents can still be reviewed. Settlement locks the record and requires a note, including when unfinished rit or unused funds remain. The simplified interface does not offer carrying balances to another package.

Amounts/dates of linked advances update on reload while controls are open; previous values are retained. Missing or reclassified sources produce a warning and block settlement. Closed controls retain their historical funding. Future/undated Uang jalan is flagged and excluded until corrected in Buku transaksi. An advance is never counted twice. No payment is executed by this interface.

## Query1 import

`scripts/convert-query1.py SOURCE.xlsx PRIVATE_OUTPUT.json` reads **only Query1**, preserves its dates and amounts, validates columns and unique deterministic transaction IDs, and maps source categories. The workbook spelling B 9186 JG maps to the existing internal B 9286 JG vehicle key for compatibility; the UI displays B 9186 JG.

`QUERY1_IMPORT_GZIP_BASE64` is an encrypted Vercel deployment variable containing the gzip/base64 private import. The existing authenticated initial-data endpoint validates and serves it before the previous Supabase initial snapshot. Do not commit financial workbooks, converted records or environment values. The Supabase management token can be renewed later; the shared control table continues to use authenticated user sessions.

Query1 replaces earlier imported workbook rows. A full pre-import browser backup is saved before replacement and can be downloaded from Data & cadangan. Manual entries, vehicle status, trips and reports remain. Query1 import is idempotent; previously edited Query1 rows remain intact on reload. Legacy imported row edits are retained in the full backup. Old source snapshots in existing control packages remain available; unavailable revenue links must be explicitly reconciled.

Financial data remains in the existing browser storage. Shared control data is stored in Supabase `tp_rit_control`; switching browser or device does not synchronize browser financial edits. The control reload copies selected source snapshots using revision checks and authenticated server audit stamps. This is not live push synchronization. The existing two-email login allowlist and RLS remain in effect.

## Order list inside each control

Clicking a control row (or its Lihat order button) opens the full order list for that control. Keyboard users can focus the row and press Enter/Space. Order details show date, free-text uraian and quantity; entries from other controls are not mixed into the list. Empty controls show an empty-state message and Tambah order.

Active controls expose Edit and Hapus for each order. Editing preserves the order ID and previous field values with server account/time stamps. Validation checks dates, integer quantity, the package's target and the other existing/verified rit. Deletion requires a reason and archives the complete order including edit history. Rit completed, remaining rit and available funds recalculate from the saved data; the original cashbook funding remains unchanged. Settled controls retain a read-only order history to preserve approved balances.

Edit pada Catatan rit selesai memakai formulir yang sama dengan Input ritase: uraian, tanggal, jumlah rit, serta konteks armada dan uang jalan. Nilai lama langsung terisi. Armada dan sumber uang jalan mengikuti kontrol asal; ringkasan pendanaan dan realisasi tetap terlihat. Catatan pada kontrol yang targetnya sudah penuh tetap bisa diedit dengan batas rit semula ditambah sisa kapasitas.

## Ringkasan selisih bersih

Seluruh kartu ringkasan mengikuti daftar sesuai filter armada, periode uang jalan, dan status (Aktif/Selesai/Semua). Sisa rit dihitung dari jumlah target dikurangi seluruh rit selesai, tanpa membatasi selisih setiap catatan menjadi nol sebelum dijumlahkan. Hasil negatif ditampilkan sebagai Rit lebih. Sisa dana dihitung dari pendanaan total dikurangi total biaya rit pada tarif masing-masing kontrol; hasil negatif ditampilkan sebagai Kekurangan dana. Sisa dan kekurangan saling mengimbangi. Contoh target total 15 rit, realisasi 17 rit, pendanaan Rp3.000.000 dan tarif Rp200.000 menghasilkan Rit lebih 2 serta Kekurangan dana Rp400.000.

Aturan ini berlaku pada seluruh armada dan seluruh periode. Status Selesai dan Semua juga dijumlahkan sesuai daftar, bukan selalu menggunakan catatan aktif. Saldo yang diteruskan antarkontrol lama dihitung sebagai transfer internal bila kedua kontrol termasuk pilihan, sehingga pendanaan tidak dihitung dua kali. Rincian transaksi dan catatan rit tersimpan tidak berubah.
