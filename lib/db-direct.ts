import { Pool } from 'pg';

// Direct Postgres connection, bypassing Supabase's REST API (PostgREST).
//
// Why this exists: the REST API (supabaseAdmin() / @supabase/supabase-js)
// was observed serving stale data for the rdv_requests table -- new rows
// confirmed present via direct SQL were invisible through the REST API for
// hours, across redeploys and project restarts. This talks to the database
// directly instead, sidestepping whatever layer (cache / replica / load
// balancer) sits between PostgREST and the primary database on Supabase's
// side.
//
// Requires a DATABASE_URL env var in Vercel: Supabase -> Project Settings
// -> Database -> Connection string -> "Transaction" pooler (port 6543),
// URI format, with the real password filled in.

let pool: Pool | null = null;

export function directDb(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it in your Vercel project settings (Supabase -> Database -> Connection string, Transaction pooler).');
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  return pool;
}
