import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface QueryResult<T = Record<string, unknown>> { rows: T[] }
export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(work: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

declare global { var wasliDatabase: Promise<Database> | undefined; }

export async function openDatabase(directory?: string): Promise<Database> {
  let adapter: Database;
  if (!directory && process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    // Do not allow URL parameters to silently override certificate verification.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    const pool = new Pool({ connectionString: url.toString(), ssl: local ? undefined : { rejectUnauthorized: true }, max: 5 });
    const wrap = (query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>): Database => ({
      query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await query(sql, params)).rows as T[] }),
      exec: async sql => { await query(sql); },
      transaction: async work => {
        const client = await pool.connect();
        try { await client.query('BEGIN'); const value = await work(wrap((s, p) => client.query(s, p))); await client.query('COMMIT'); return value; }
        catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      close: () => pool.end(),
    });
    adapter = wrap((sql, params) => pool.query(sql, params));
  } else {
    const dataDirectory = directory ?? process.env.WASLI_DATA_DIR ?? path.join(process.cwd(), '.data/wasli');
    if (!dataDirectory.startsWith('memory://')) await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    const engine = new PGlite(dataDirectory);
    await engine.waitReady;
    const wrap = (handle: Pick<PGlite, 'query' | 'exec'>): Database => ({
      query: async <T>(sql: string, params?: unknown[]) => { const result = await handle.query(sql, params); return { rows: result.rows as T[] }; },
      exec: async sql => { await handle.exec(sql); },
      transaction: work => engine.transaction(async tx => work(wrap(tx as unknown as Pick<PGlite, 'query' | 'exec'>))),
      close: () => engine.close(),
    });
    adapter = wrap(engine);
  }
  // Applying core migrations is restricted to local development. Managed databases
  // must be explicitly migrated by an approved operator before the server starts.
  if (directory || !process.env.DATABASE_URL) {
    const migration = await readFile(path.join(process.cwd(), 'supabase/migrations/0001_core.sql'), 'utf8');
    await adapter.exec(migration);
  }
  return adapter;
}

export function db(): Promise<Database> {
  globalThis.wasliDatabase ??= openDatabase();
  return globalThis.wasliDatabase;
}
