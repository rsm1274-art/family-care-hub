import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';

/**
 * Minimal migration runner for the packaged app (no Prisma CLI at runtime).
 * Applies the SQL files under prisma/migrations in name order, tracking
 * applied ones in _fch_migrations. Dev keeps using `prisma migrate dev`.
 *
 * Statements are split on trailing semicolons — fine for the DDL Prisma
 * generates here; avoid functions/triggers in migrations or upgrade this.
 */
export async function runMigrations(): Promise<void> {
  const dir =
    process.env.MIGRATIONS_DIR || path.resolve(__dirname, '../prisma/migrations');
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS _fch_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM _fch_migrations`
  );
  const applied = new Set(rows.map((r) => r.name));

  const folders = fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    if (applied.has(folder)) continue;
    const sqlPath = path.join(dir, folder, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(/;\s*[\r\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log(`Applying migration ${folder} (${statements.length} statements)`);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO _fch_migrations (name) VALUES ($1)`,
      folder
    );
  }
}
