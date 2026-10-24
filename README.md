# Tanjung Priok — Fleet & Finance

Internal trucking monitoring: client-first analytics, transactions, fleet, trips, weekly reporting and printable monthly financial summaries. Node.js 22+, no runtime dependencies.

## Current access and storage

Login uses a one-time email link through Supabase Auth. Only confirmed email addresses in `AUTH_ALLOWED_EMAILS` can access the workspace API. Missing auth configuration denies access. See [email login setup](docs/email-login.md) before deployment.

- Vercel without Redis: authenticated users use localStorage in their browser. This data is not shared across devices. Logging out does not erase previously downloaded browser data; use trusted devices and export backups regularly.
- Local Node server: ignored `.local/data.json` stores private data on the machine. Local development also requires auth configuration. The app does not automatically load `.env` files; use exported variables or `node --env-file=.env.local server.mjs`.
- Optional Upstash Redis: both REST variables activate a shared workspace. Email authentication applies to all workspace reads and writes. All approved users currently have the same read/write access; there is no separate admin role.
- Sessions last at most one hour, then require another email login. Browser cache revision checks are best-effort across tabs; Redis updates use atomic compare-and-set.

Financial source records must never be committed to this public repository or put in public/ or dist/. The private import file is supplied separately.

## Client analytics

Choose a month, truck and client to see recorded income, rit and contributing trucks. Client names are grouped case-insensitively with whitespace normalized. Create a client profile with contact/PIC and notes. New income entries require a client; expense links are optional. Unassigned shared vehicle costs are never allocated to a client without explicit input.

## Transactions

- Income categories: Pendapatan angkutan, Sewa armada, Pendapatan lain.
- Expense categories: Solar / BBM, Tol & parkir, Uang jalan, Servis & sparepart, Ban, Oli, Garasi, Administrasi, Biaya lain, Perlu cek.
- Switching transaction type changes the category choices immediately. Domain/server validation rejects mismatched categories.
- Legacy Excel categories Pendapatan and Solar remain importable and display under the new corresponding labels.
- Missing dates and amounts remain missing, distinct from zero. Future dates or date/month-label conflicts are flagged for review; they are never silently corrected.

## Monthly report

The report includes categorized recorded income/expenses, prior-month figures when available, client contribution, vehicle totals, completeness notes, reviewer notes and preparer. Choose **Cetak / PDF** to use the browser print dialog, or export the month's transactions to CSV.

Month attribution uses a real transaction date first, then an exact single-month source label for undated records. Undated combined periods (e.g. two months) remain outside individual monthly reports. Weekly reports require actual transaction dates and use a 7-day half-open interval.

Reports sum known amounts and follow current records. Review status is a review marker, not an immutable accounting close. Recorded difference is not accounting net profit or cash balance; opening balances, receivables, payables, tax/depreciation adjustments and unrecorded items are not inferred. No formal balance sheet or complete accounting ledger is implemented.

## Run and verify

```
node server.mjs
node --test tests/*.test.mjs
node scripts/build.mjs
```

Local URL: http://127.0.0.1:3100. Set PORT to use a different port.

## Vercel

Import jefriadriann/TanjungPriuk, preset Other. The repository sets the build command, dist output, static root rewrite and .mjs API entrypoint in vercel.json. Push main to trigger automatic deployment. Configure the email login variables and Supabase settings described in docs/email-login.md. Database variables remain optional for browser mode.

Optional shared storage variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Do not expose their values in client JavaScript or GitHub.

Manual operational updates include vehicle status, assigned driver, service/document dates and trip status. GPS, invoices/receivables and granular user roles are outside this version.

## Optional public initial dataset

With explicit permission to publish financial records, `PUBLIC_EXCEL_IMPORT=1` may enable automatic initial data loading in Vercel browser mode (`REQUIRE_EMAIL_LOGIN=0`, no Redis). The API reads the `initial` row of Supabase `public.tp_public_import` through its publishable key. This dataset is publicly readable; anonymous writes must be revoked and RLS must allow only SELECT. Keep records out of Git and static assets. The browser merges source IDs once without overwriting existing edits; subsequent changes stay in that browser. Without this flag, no public source dataset is fetched. Table creation and data publication require separate explicit authorization for the destination.
