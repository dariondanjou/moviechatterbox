// Execute a SQL file (or inline SQL) against DATABASE_URL from .env.
// Usage: node scripts/db-exec.mjs <path-to-sql-file>
//        node scripts/db-exec.mjs --sql "select 1"
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error('DATABASE_URL not found in .env');

const [arg, inline] = process.argv.slice(2);
const query = arg === '--sql' ? inline : fs.readFileSync(arg, 'utf8');
if (!query) throw new Error('usage: db-exec.mjs <file.sql> | --sql "..."');

const sql = postgres(url, { ssl: 'require', connect_timeout: 20, max: 1 });
try {
  const result = await sql.unsafe(query);
  console.log(JSON.stringify(result, null, 2).slice(0, 8000));
} finally {
  await sql.end();
}
