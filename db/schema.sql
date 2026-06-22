-- Even Lab Dashboard — database schema (Neon Postgres)
-- All data AND files (blobs) live here. Run once to initialise; safe to re-run.

-- ============================================================
-- uploads: one row per uploaded CSV file
-- ============================================================
CREATE TABLE IF NOT EXISTS uploads (
  id              BIGSERIAL PRIMARY KEY,
  filename        TEXT        NOT NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  blob_url        TEXT,                       -- GCS object path (signed URL generated on demand)
  checksum        TEXT,                       -- sha256 of file bytes (idempotency)
  row_count       INTEGER,
  date_range_start DATE,
  date_range_end   DATE,
  new_count       INTEGER DEFAULT 0,
  updated_count   INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  dropped_count   INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'   -- pending | committed | failed
);

CREATE UNIQUE INDEX IF NOT EXISTS uploads_checksum_idx ON uploads (checksum);

-- ============================================================
-- tests: de-duplicated fact table (one row per test, upsert by test_uid)
-- TAT and report_date are GENERATED so they auto-recompute when a later
-- upload fills in a previously-missing timestamp (e.g. verification).
-- ============================================================
CREATE TABLE IF NOT EXISTS tests (
  test_uid          TEXT PRIMARY KEY,        -- accessionIdentifier || orderId || row id
  source_upload_id  BIGINT REFERENCES uploads(id),

  -- grouping ids (order = many tests, accession = one sample)
  order_id          TEXT,
  accession_id      TEXT,

  -- identity / case-mix (patient_name kept India-resident; never exported, shown only on audit-logged click)
  uhid              TEXT,
  patient_name      TEXT,
  patient_type      TEXT,                    -- IP | OP | ER
  department        TEXT,                    -- subDepartment_name
  service_item      TEXT,
  service_code      TEXT,
  treating_doctor   TEXT,
  is_outsourced     BOOLEAN,
  payer             TEXT,
  facility          TEXT,

  -- pathway timestamps (UTC)
  ts_ordered          TIMESTAMPTZ,
  ts_booked           TIMESTAMPTZ,
  ts_checkin          TIMESTAMPTZ,
  ts_collected        TIMESTAMPTZ,
  ts_dispatched       TIMESTAMPTZ,
  ts_acknowledged     TIMESTAMPTZ,
  ts_processed        TIMESTAMPTZ,
  ts_result_entry     TIMESTAMPTZ,
  ts_verified         TIMESTAMPTZ,
  ts_report_completed TIMESTAMPTZ,
  ts_report_uploaded  TIMESTAMPTZ,

  -- KareXpert per-segment status flags (Normal/Warning/Critical), merged across uploads
  kx_status_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  stage_durations_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- derived (generated) — report bucket = order/booking date in IST
  report_date DATE GENERATED ALWAYS AS
    ((COALESCE(ts_ordered, ts_booked) AT TIME ZONE 'Asia/Kolkata')::date) STORED,
  -- TAT 1: sample collection -> result entry (minutes)
  tat1_min NUMERIC GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (ts_result_entry - ts_collected)) / 60.0) STORED,
  -- TAT 2: result entry -> verification (minutes)
  tat2_min NUMERIC GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (ts_verified - ts_result_entry)) / 60.0) STORED
);

CREATE INDEX IF NOT EXISTS tests_report_date_idx ON tests (report_date);
CREATE INDEX IF NOT EXISTS tests_department_idx  ON tests (department);
CREATE INDEX IF NOT EXISTS tests_report_dept_idx ON tests (report_date, department);

-- ============================================================
-- daily_reports / monthly_summaries: generated artifacts (URLs to GCS)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id           BIGSERIAL PRIMARY KEY,
  report_date  DATE UNIQUE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kpis_json    JSONB,
  pdf_url      TEXT,
  png_url      TEXT,
  html_url     TEXT
);

CREATE TABLE IF NOT EXISTS monthly_summaries (
  id           BIGSERIAL PRIMARY KEY,
  month        DATE UNIQUE NOT NULL,        -- first day of the month
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pptx_url     TEXT,
  ai_narrative TEXT,
  kpis_json    JSONB,
  mom_deltas_json JSONB
);

-- ============================================================
-- files: all stored blobs live in the database (raw CSVs + generated
-- reports/images/decks). Served via an authenticated /api/files/:id route.
-- ============================================================
CREATE TABLE IF NOT EXISTS files (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,            -- raw_csv | daily_pdf | daily_png | daily_html | monthly_pptx
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  bytes       BYTEA NOT NULL,
  size_bytes  INTEGER,
  upload_id   BIGINT REFERENCES uploads(id),
  report_date DATE,
  month       DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_report_date_idx ON files (report_date);
CREATE INDEX IF NOT EXISTS files_month_idx ON files (month);
CREATE INDEX IF NOT EXISTS files_kind_idx ON files (kind);

-- ============================================================
-- audit_log: uploads, downloads, name reveals, logins
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor     TEXT,
  action    TEXT NOT NULL,                  -- upload | download | reveal_name | login
  entity    TEXT,
  meta_json JSONB
);
