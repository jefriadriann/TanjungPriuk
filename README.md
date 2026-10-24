# Tanjung Priok — Fleet & Finance

Internal trucking monitoring: client-first analytics, transactions, fleet, trips, weekly reporting and printable monthly financial summaries. Node.js 22+, no runtime dependencies.

## Current access and storage

Login/password has been removed at the owner's request.

- Vercel without Redis: the app works immediately using localStorage in the visitor's browser. Data is not shared across devices or uploaded to a public asset. Import your private JSON conversion from **Impor data**. Export **Data & cadangan > Unduh cadangan** regularly, especially before clearing site data or switching devices.
- Local Node server: ignored `.local/data.json` stores data on the computer. Set VERCEL=1 locally to test browser storage behavior.
- Optional Upstash Redis: setting both REST variables activates a shared workspace. **Without login, everyone who can access the URL can read and change that shared data.** Reintroduce suitable access controls before using shared storage for confidential financial data.
- Browser cache JSON is validated before use. Failed quota writes leave the previous state intact. Revision checks reject stale writes; cloud updates use atomic Redis compare-and-set. localStorage revision checks are best-effort across tabs and do not replace a multi-user database.

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

Import jefriadriann/TanjungPriuk, preset Other. The repository sets the build command, dist output, static root rewrite and .mjs API entrypoint in vercel.json. Push main to trigger automatic deployment. No login or database environment variables are required for browser mode.

Optional shared storage variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Do not expose their values in client JavaScript or GitHub.

Manual operational updates include vehicle status, assigned driver, service/document dates and trip status. GPS, invoices/receivables and granular user roles are outside this version.
