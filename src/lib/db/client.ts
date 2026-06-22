// Even Lab — Postgres connection (Neon).
// Set DATABASE_URL to Neon's POOLED connection string (the "-pooler" host with
// ?sslmode=require) — recommended for Vercel serverless functions.
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}
