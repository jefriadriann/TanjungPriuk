# Buku transaksi: input and exports

Excel (.xlsx), PDF and Cetak use all rows matching the active period, vehicle, client, type, completeness and search filters, in table order, including rows beyond the current 25-row page. The export contains the scope, row count, numeric amounts, totals and balance. Missing amounts remain blank in Excel and are labelled in PDF/print. Export libraries run locally in the browser and are served from `public/vendor/exports`; no transaction upload is needed. PDF is downloaded directly. Cetak opens the browser print dialog with the full filtered ledger and repeats table headers; the monthly report print layout is separate.

New Revenue input hides vehicle and rit, stores an empty vehicle key as global revenue, and records zero rit. Existing historical vehicle/rit metadata is preserved when editing earlier revenue entries. Expenses still require a vehicle; Bagi Hasil exposes the rit input. Ringkasan Bisnis rit cards, charts and details count only expenses Bagi Hasil and respect active filters. Kontrol Rit continues to track completed driver execution separately, without adding its numbers a second time to the dashboard.

New Expenses choices omit Solar / BBM, Tol & parkir and Perlu cek, and include Gaji pegawai and Operasional. Historical transactions in retired categories remain valid and can be opened or round-tripped in the sheet editor without being recategorized.

## Armada workbook and global receipts

Buku transaksi treats every Revenue receipt as global, including older Excel rows with a retained truck identifier. The Global filter includes all receipts; a specific vehicle filter returns only that vehicle's expenses. Its table, summaries and Excel/PDF/print exports use the same filtered rows. Stored financial entries are not rewritten.

**Excel Armada** downloads a separate workbook with Ringkasan Armada and one detail worksheet for each selected vehicle. **Excel mobil** on a card downloads that vehicle's summary and detail. These exports follow the selected period, vehicle and Armada-specific search/type filters, independent of hidden filters from other menus. Bagi Hasil expenses appear once as fleet income; other truck expenses except Uang jalan remain costs. Uang jalan stays in Buku transaksi and continues funding Kontrol Rit. Gross business Revenue is excluded, and road funding rit is not counted as completed fleet rit. The workbook's numeric totals match the cards; this is a derived report and does not create duplicate receipts in Buku transaksi.

Armada includes a transaction table with date/period, vehicle, description, revenue/expense category, client, nominal amounts and Bagi Hasil rit. It offers its own search, type filter and 25-row pagination. Cards, detail totals, Excel, PDF and print all use the same report rules; exports include all matching rows, not only the visible page. Source edit links open the original Buku transaksi record, so reports do not create duplicate receipts.

**PDF Armada / Cetak Armada** export selected vehicles grouped into separate sections/pages. Each card also offers Excel/PDF/Cetak for that vehicle and active period. Reports show the vehicle, scope, transaction rows, revenue, costs and balance. Uang jalan is excluded even when its nominal is zero or missing.
