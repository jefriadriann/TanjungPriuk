# PT Jaya Bintang Terang — Fleet & Finance

Internal trucking monitoring: client-first analytics, transactions, fleet, trips, weekly reporting and printable monthly financial summaries. Node.js 22+, no runtime dependencies.

## Current access and storage

Login uses a one-time email link through Supabase Auth. Only confirmed email addresses in `AUTH_ALLOWED_EMAILS` can access the workspace API. Missing auth configuration denies access. See [email login setup](docs/email-login.md) before deployment.

- Vercel without Redis: authenticated users use localStorage in their browser. This data is not shared across devices. Logging out does not erase previously downloaded browser data; use trusted devices and export backups regularly.
- Local Node server: ignored `.local/data.json` stores private data on the machine. Local development also requires auth configuration. The app does not automatically load `.env` files; use exported variables or `node --env-file=.env.local server.mjs`.
- Optional Upstash Redis: both REST variables activate a shared workspace. Email authentication applies to all workspace reads and writes. All approved users currently have the same read/write access; there is no separate admin role.
- Sessions last at most one hour, then require another email login. Browser cache revision checks are best-effort across tabs; Redis updates use atomic compare-and-set.

Financial source records must never be committed to this public repository or put in public/ or dist/. The private import file is supplied separately.

## Client analytics

Choose a month, truck and client to see recorded revenue, rit and contributing trucks. Client profiles use revenue-only monthly bars, revenue-only chart dialogs, and fleet/transaction tables without expense or difference columns. The view excludes expense records even when explicitly linked to the selected client; the dashboard, ledger and management reports retain their financial comparisons. Client names are grouped case-insensitively with whitespace normalized. Create a client profile with contact/PIC and notes. New income entries require a client; expense links are optional. Unassigned shared vehicle costs are never allocated to a client without explicit input.

## Transactions

- Income categories: Pendapatan angkutan, Sewa armada, Pendapatan lain.
- Expense categories: Solar / BBM, Tol & parkir, Uang jalan, Servis & sparepart, Ban, Oli, Garasi, Administrasi, Biaya lain, Perlu cek.
- Switching transaction type changes the category choices immediately. Domain/server validation rejects mismatched categories.
- Legacy Excel categories Pendapatan and Solar remain importable and display under the new corresponding labels.
- Missing dates and amounts remain missing, distinct from zero. Future dates or date/month-label conflicts are flagged for review; they are never silently corrected.

## Monthly report

The report includes categorized recorded income/expenses, prior-month figures when available, client contribution, vehicle totals, a trailing three-month Revenue/Expense line chart with a data-driven narrative, and preparer. Choose a month and **Cakupan armada** (one truck or all trucks), then **Cetak / Simpan PDF** and select Save as PDF in the browser dialog. The report includes matching transaction descriptions, totals, and prior-month comparisons. CSV export uses the same month/truck filter. Monthly review notes are saved separately for each truck and for the fleet-wide report; in browser mode these notes remain in that browser. Review notes appear only as internal notes above the report on screen and are excluded from PDF. The three-month comparison ends at the selected report month and follows its truck scope; unavailable periods remain gaps, and incomplete nominal values are marked rather than treated as confirmed zeros.

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

## Dashboard details

Transaction rows use light green for revenue and light red for expenses; an expense without an assigned client leaves the client cell empty. Click a donut segment or its legend to open a revenue detail dialog with client share, rit, serving trucks and recent transactions, then use its client link for the full profile. Chart dialogs use larger figures and green/red accents matching their financial direction. Click a cost category to inspect its individual expenses in descending amount order, or use the cost panel arrow to inspect all expenses. Unit totals and the unit column appear when all trucks are selected; a single-truck filter omits them. Click either monthly chart bar for full rupiah income/expense values and per-unit totals. Both dialogs respect the active period, truck, and client filters and support keyboard activation and Escape to close. Bar charts, donut slices and donut legend rows share the same floating tooltip system. Donut hints show the client, full rupiah revenue and contribution percentage with the segment colour as an accent; native SVG title bubbles are removed. Monthly bar tooltips are rendered outside the scrollable plot so the maximum-height bar cannot clip them. They display full rupiah values on hover or keyboard focus, stay inside the viewport, follow scrolling, and dismiss with Escape; clicking opens the full detail dialog.

## Manual spreadsheet entry

Open **Accounting** for the same eight plate-named sheets and five core columns as the reference workbook: No, Tanggal, Keterangan, Masuk (Rp), Keluar (Rp). Period sections have calculated subtotals. No and subtotal cells are calculated rather than editable Excel formulas.

Edit existing rows or use **Tambah row**. Add-row and Save controls sit together in the sticky bottom worksheet panel, above the truck sheet tabs. Adding a row focuses its date cell and keeps it clear of the bottom controls. Select a row number/cell for category, client, rit and period fields. New expenses default to **Perlu cek** until categorized; new income requires a client. Dates accept DD/MM/YYYY or YYYY-MM-DD; rupiah values accept integers or grouped thousands. Paste a rectangular range of up to 500 rows from Excel, including the optional No column when starting in Tanggal. Use one of Masuk/Keluar per row. Do not paste subtotal/formula rows as transactions.

Edits remain a draft across sheets and app navigation. **Simpan perubahan** validates the entire draft and uses the app's existing commit/revision flow, then all dashboard cards, charts and reports read the updated records. **Urungkan** reverses draft edits; **Batalkan draft** discards unsaved changes. An unload warning protects an unsaved draft, but unsaved drafts are not restored after a page reload. Invalid input, a stale workspace revision or a failed storage write keeps the draft for correction.

In the current production browser-storage mode, saving updates only the same browser/device and does not update the public Supabase initial snapshot or synchronize other devices. Download app backups regularly. The supplied Excel is a layout reference; adding this editor does not replace the existing dataset with a new workbook import.

Google sign-in is prepared behind `AUTH_GOOGLE_ENABLED`; see [Google activation](docs/google-login.md). It uses the existing approved-email list, PKCE and server-verified sessions without sending login emails. The provider still needs a Google OAuth Web client before activation. Keep the website in its existing access mode until provider sign-in and data access policies are verified.

## Corporate monthly reporting

Monthly reports use a corporate editorial layout with a company masthead, reporting scope, current/prior-month comparative tables, client revenue contribution, fleet performance, a three-month Revenue/Expense comparison and the complete transaction appendix. Empty management-note placeholders, data-quality counts and the extended basis-of-preparation section are omitted from the printable report. The report remains a management summary of recorded transactions; it is not presented as audited financial statements or accounting net profit. Screen labels use Revenue while stored transaction types/categories remain compatible with existing data. Accounting is the entry/editing workspace; the dashboard no longer exposes import/add-transaction shortcuts.

## Visual analytics and operations map

The dashboard uses an interactive revenue donut with exact rupiah amounts and reconciled client shares, including unassigned revenue and disclosure of unknown amounts. The client portfolio focuses on full-width client cards without repeating the dashboard donut. Chart bars retain clickable monthly details and an explicit scale. Accounting and transaction forms display Indonesian grouped amounts (20.000) while storing validated numeric rupiah values.

Operations uses locally hosted Leaflet 1.9.4 (license in public/vendor/leaflet/LICENSE) with OpenStreetMap tiles and visible attribution. The map covers North Jakarta and offers a Tanjung Priok focus. Markers/labels are approximate geographic reference points, not live vehicle positions or administrative boundaries. Road tiles require Internet access to tile.openstreetmap.org; if unavailable, the UI retains the coordinate-based reference points and explicitly indicates that street mapping is unavailable. Do not interpret the fallback as a detailed street map. The cloud allowlist addition is saved as a draft until reviewed/published; browser tile loading in production uses the viewer's own network.

Driver fields are hidden on fleet cards and the fleet editor. Existing driver data is retained for compatibility, and trip-specific driver entry is unchanged.

## Company identity

The final company identity follows the supplied PT Jaya Bintang Terang logo proposal. See [brand guidance](docs/brand.md). The shared `public/brand.css` stylesheet is loaded last and applies the navy/gold palette to every menu, login, dialogs, Accounting and A4 reports, while preserving the distinct menu layouts and green/red financial semantics. Public brand artwork follows the user-supplied JBT reference; the truck backdrop carries the new company identity. Source financial records remain excluded. The existing deployment URL, OAuth callbacks, storage keys, source IDs and database names are intentionally retained for compatibility.

## Fleet rit comparison and financial labels

The business overview financial chart includes a compact line comparison of recorded rit by truck directly below the monthly Revenue/Expenses bars. The horizontal axis identifies trucks, not months. It follows the active period, truck and client filters, highlights the highest recorded rit, and supports hover/focus tooltips plus click/Enter/Space detail dialogs. Small screens can scroll the eight-truck plot horizontally. Rit totals include only Revenue transaction records, including those with unknown amounts; legacy rit on expense records never contributes. Zero means no rit recorded in that scope and is not proof of inactivity.

Visible transaction types, headings, category labels, chart series and CSV exports use Revenue and Expenses consistently. Existing stored Indonesian type/category identifiers and JSON backups are preserved for import/save compatibility; source descriptions are not rewritten.

## Fleet status scenes

Fleet cards retain their eight distinct vehicle illustrations and choose a scene from the saved vehicle status: **Siap jalan** gently moves out of and back into a garage, **Beroperasi** drives on a toll road with rotating wheels and moving scenery, **Servis** remains in a hangar with a working mechanic and tools, and **Idle** stays motionless in an open-sided, semi-outdoor shelter. Unknown/unupdated status uses a separate static parked scene and is not changed to Idle. Status edits update the illustration immediately. `public/fleet-scenes.mjs` and `public/fleet-scenes.css` own the scenes. The page pause control stops every scene animation; reduced-motion preferences render all scenes without movement. Rendering never changes fleet statuses or financial records.
