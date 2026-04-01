/**
 * migrate.ts — run a SQL file against the Supabase Postgres database.
 *
 * Requires a direct Postgres connection string in DATABASE_URL.
 * Find it in: Supabase Dashboard → Project Settings → Database → Connection string → URI
 *
 * Usage:
 *   npx tsx server/scripts/migrate.ts <file.sql>
 *
 * Add DATABASE_URL to server/.env before running.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    'Missing DATABASE_URL.\n' +
    'Add it to server/.env — find it in:\n' +
    '  Supabase Dashboard → Project Settings → Database → Connection string → URI'
  );
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: npx tsx server/scripts/migrate.ts <file.sql>');
  process.exit(1);
}

const sqlPath = path.resolve(sqlFile);
if (!fs.existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8').trim();
if (!sql) {
  console.error('SQL file is empty.');
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`Running: ${sqlFile}`);
    console.log('---');

    const result = await client.query(sql);

    const rows = Array.isArray(result) ? result.flatMap(r => r.rows) : result.rows;
    if (rows.length > 0) {
      console.table(rows);
    } else {
      console.log('Success.');
    }
  } finally {
    await client.end();
  }
}

run().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Migration failed:', msg);
  process.exit(1);
});
