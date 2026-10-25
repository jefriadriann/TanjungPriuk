# Kontrol rit & kasbon

Open **Kontrol rit & kasbon**, fill the three owner names, then create an order package for a truck and driver. Owner names are operational labels; they do not create login accounts. The existing two-account allowlist remains in effect.

1. Set the start date, truck, driver, client, responsible owner, target and agreed driver advance per rit. The editable defaults are 5 rit × Rp 200.000. Client revenue is a separate amount and never determines the advance rate.
2. Link actual revenue rows from **Accounting**, allocating only the relevant rit. The protected latest Excel import feeds Accounting; no historical rows are automatically grouped into funded orders. Source allocations cannot be reused or exceed the package target.
3. Record funding either by linking a dated **Uang jalan** expense on that truck or by recording a real transfer with date and reference. Linking a financial row does not create another expense. A newly recorded cash advance stays in the control ledger; it does not automatically post an expense in Accounting.
4. Record the driver’s claimed rit separately to expose the gap between reported and verified trips. A driver claim never consumes funding or verifies a trip. Add each surat jalan with a unique document number, date and HTTPS evidence link accessible to the team. One surat jalan represents one rit. An approved workspace account must inspect and verify the document before it counts. The application does not authenticate the document's contents or infer dishonesty.
5. Review pending documents and explicitly approve settlement, including a note for unfinished targets. Closed packages are immutable. An approved remaining balance can fund the next package on the same truck and driver once.

Example: Rp 1.000.000 funding minus 3 verified rit × Rp 200.000 leaves Rp 400.000 to account for. Completing the old package's remaining two rit needs no new funding. If settlement explicitly approves carrying Rp 400.000 into a new 5-rit package, its transfer recommendation is Rp 600.000. A recommendation does not execute a transfer.

The board shows the earliest incomplete stage: funding, execution/evidence, document review, settlement. Pending evidence is also counted independently, so it remains visible while funding is incomplete. Outstanding cash includes funds reserved for unfinished trips; it is not automatically a loss or fraud finding. Filters apply to package start month and source transaction month respectively.

Before settlement, changed/missing linked revenue must be explicitly reconciled, preserving prior snapshots. Changed linked cash transactions must be corrected or voided and relinked. Incorrect pending/rejected evidence can be edited and resubmitted; verified evidence is locked. Cash entry voids retain their amounts, references, account and reason in the private control backup.

## Storage and access

The control ledger is shared in Supabase `public.tp_rit_control`, separate from browser financial storage. The top bar identifies shared control storage on this page. Accounting edits still follow the existing browser-local financial storage model; only selected source snapshots are copied to the shared control ledger. Opening a linked transaction in a browser without that source shows a missing-source notice rather than silently creating financial entries.

`/api/index?action=rit-control` authenticates the existing Supabase session, limits access to the existing confirmed email allowlist, checks write origin, validates commands and stamps the account and time server-side. PUT uses a revision-filtered Supabase PATCH; stale updates return 409 and require reloading. Updates appear on reopening the menu or pressing **Muat ulang kontrol**; this version does not claim live push notifications.

Apply [the migration](../supabase/migrations/20261025_rit_control.sql) once before deployment. Its initial document contains no financial records. It enables RLS and grants SELECT/UPDATE only to the two approved email addresses; anonymous access and user INSERT/DELETE are revoked. Owner profiles do not grant access. Do not put document files, source workbooks, access tokens or private financial JSON in Git or static assets.

Use **Unduh cadangan kontrol** for the shared control backup. The financial workspace's existing backup remains separate. Test documents and demonstration packages must stay in local test fixtures, never in production control data.
