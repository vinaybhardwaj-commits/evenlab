# evenlab — Even Lab Operations Dashboard

Daily/monthly laboratory TAT dashboard for the Even Hospital Lab Director, deployed at **lab.evenos.app**. See the PRD (`Lab-Dashboard-PRD.md`) for the full design.

This commit contains **Phase-0 / ingestion engine**: parsing KareXpert CSV exports, de-duplication, TAT & pathway-stage computation, and the Postgres upsert + schema. The Next.js UI, artifact generation, and Vertex AI come in later phases.

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
# parse-only summary (no DB needed):
npm run ingest -- /path/to/lab_service_tat_report.csv
# also upsert into Postgres (set DATABASE_URL first):
npm run ingest -- /path/to/file.csv --db
npm run typecheck
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
