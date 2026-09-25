import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add it privately to .env.local, then run npm run db:migrate.');
  process.exit(1);
}
try {
  const sql = neon(process.env.DATABASE_URL);
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  // This schema contains no procedural blocks or semicolons inside string values.
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  await sql.transaction(statements.map((statement) => sql.query(statement)));
  console.log('Database schema applied successfully. No connection details were printed.');
} catch {
  console.error('Schema migration failed. Check the private DATABASE_URL, database access and btree_gist extension support in the Neon SQL Editor. No connection details were printed.');
  process.exit(1);
}
