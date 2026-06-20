# evenlab — Even Lab Operations Dashboard

Daily/monthly laboratory TAT dashboard for the Even Hospital Lab Director, deployed at **lab.evenos.app**. See the PRD (`Lab-Dashboard-PRD.md`) for the full design.

**Status:** Phase 0 + daily MVP foundation. Includes the ingestion engine (parse, dedup, TAT/stage metrics, Postgres upsert + schema), single-user auth (email + password), the upload flow (validate → commit), and the daily dashboard UI (KPIs, delayed-rate & status charts, leaderboards). Artifact generation (PDF/PNG/HTML), the calendar/monthly archive, and Vertex AI come next.

Verified: `next build` clean (13 routes); auth + route protection + login smoke-tested; upload preview returns the correct validation summary for the real sample export.

## Stack

- Next.js 14 on Vercel (functions pinned to `bom1` / Mumbai) — UI in a later phase
- GCP Cloud SQL for PostgreSQL, `asia-south1` (Mumbai) — full India data residency
- Google Cloud Storage, `asia-south1` — raw CSVs + generated reports
- Vertex AI (Gemini) — monthly synthesis, daily insight, trend/forecast (de-identified inputs only)

## Layout

```
db/schema.sql              Postgres schema (uploads, tests, reports, audit)
src/lib/ingest/            parse → metrics → dedup → ingest entry point
src/lib/db/                pg client + upsert
scripts/ingest-cli.ts      run ingestion against a local CSV
```

## Ingestion model (key rules, from the PRD)

- **Identity / dedup:** `accessionIdentifier` → `orderId` → row `id`. Uploads may overlap; records upsert by `test_uid`, coalescing field-by-field so a later upload (e.g. once verified) never erases earlier values.
- **Report date:** order/booking date, bucketed in IST.
- **TAT 1** = collection → result entry; **TAT 2** = result entry → verification. Computed in minutes; in the DB these and `report_date` are GENERATED columns, so they recompute when timestamps fill in.
- **Delay:** KareXpert `Critical` segment flag (stored in `kx_status_json`).
- **PHI:** addresses are never read/stored; `patient_name` is kept (India-resident DB) but never written to exports.

## Run it

```bash
npm install

# the web app (needs SESSION_SECRET, AUTH_EMAIL, AUTH_PASSWORD_HASH in .env.local):
npm run dev            # http://localhost:3000
npm run build          # production build

# ingestion CLI (no app needed):
npm run ingest -- /path/to/lab_service_tat_report.csv      # parse-only summary
npm run ingest -- /path/to/file.csv --db                   # also upsert (needs DATABASE_URL)
npm run typecheck
```

Generate the password hash for `AUTH_PASSWORD_HASH`:
```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],12))" 'your-password'
```

## Database setup

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## Configuration

Copy `.env.example` → `.env.local` and fill in. **Never commit** `.env*` or any `*-key.json` (already in `.gitignore`). On Vercel, store the GCP service-account JSON as an env var/secret, not a file.

The single dashboard login (Lab Director) is configured via `AUTH_EMAIL` + `AUTH_PASSWORD_HASH` (a hash, never the plaintext password).

## Security

- Secrets live only in env / secret manager — never in the repo or DB.
- All patient data stays in India (Mumbai region) end to end.
- Audit log records uploads, downloads, name reveals and logins.
