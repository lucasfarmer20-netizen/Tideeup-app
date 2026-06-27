#!/usr/bin/env node
/**
 * TideeUp migration runner.
 *
 * Applies the plain-SQL files in supabase/migrations/ in lexical order against
 * the Postgres database identified by SUPABASE_DB_URL, tracking which have run
 * in a `schema_migrations` table so each applies exactly once.
 *
 * Usage:
 *   node scripts/migrate.mjs              Apply all pending migrations
 *   node scripts/migrate.mjs --status     List applied / pending without changing anything
 *   node scripts/migrate.mjs --baseline <file>
 *                                         Mark every migration up to and including
 *                                         <file> as applied WITHOUT running it. Use once
 *                                         on a database that was provisioned by hand
 *                                         before this runner existed.
 *
 * Connection: set SUPABASE_DB_URL in .env.local to your Supabase connection
 * string (Dashboard → Project Settings → Database → Connection string → URI).
 * Use the session pooler / direct connection (port 5432), not the transaction
 * pooler — DDL needs a session.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

// ─── Minimal .env.local loader (real env always wins) ─────────────────────────
function loadEnvLocal() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function migrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedSet(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const isStatus = args.includes('--status');
  const baselineIdx = args.indexOf('--baseline');
  const baselineTarget = baselineIdx !== -1 ? args[baselineIdx + 1] : null;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      'Missing SUPABASE_DB_URL. Add it to .env.local — Supabase Dashboard →\n' +
        'Project Settings → Database → Connection string → URI (port 5432).',
    );
    process.exit(1);
  }

  const files = migrationFiles();

  if (baselineTarget && !files.includes(baselineTarget)) {
    console.error(`--baseline target not found among migrations: ${baselineTarget}`);
    console.error(`Available:\n  ${files.join('\n  ')}`);
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    // Supabase requires TLS; its cert chain isn't in Node's default store.
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await ensureTrackingTable(client);
    const applied = await appliedSet(client);

    if (isStatus) {
      console.log('Migration status:');
      for (const f of files) {
        console.log(`  ${applied.has(f) ? '✓ applied' : '· pending'}  ${f}`);
      }
      const pendingCount = files.filter((f) => !applied.has(f)).length;
      console.log(`\n${applied.size} applied, ${pendingCount} pending.`);
      return;
    }

    if (baselineTarget) {
      const upTo = files.slice(0, files.indexOf(baselineTarget) + 1);
      let marked = 0;
      for (const f of upTo) {
        if (applied.has(f)) continue;
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
          [f],
        );
        marked++;
        console.log(`  ✓ baselined (not run)  ${f}`);
      }
      console.log(`\nBaseline complete: ${marked} marked as applied up to ${baselineTarget}.`);
      return;
    }

    // Default: apply pending migrations in order, each in its own transaction.
    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('✓ schema_migrations ensured\n✓ Up to date — no pending migrations.');
      return;
    }

    console.log('✓ schema_migrations ensured');
    for (const f of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      process.stdout.write(`  → applying ${f} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        console.log('done');
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        console.error(`\nMigration ${f} failed and was rolled back:\n${err.message}`);
        process.exit(1);
      }
    }
    console.log(`\n✓ ${pending.length} applied, 0 pending.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
