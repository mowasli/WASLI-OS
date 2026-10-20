/** Offline, local-only database snapshot. Stop the server before running. */
import { PGlite } from '@electric-sql/pglite';
import { stat, writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const [action, source, target] = process.argv.slice(2);
  if (!['backup','restore'].includes(action) || !source || !target || process.env.DATABASE_URL) {
    throw new Error('Local offline usage: tsx scripts/backup.ts backup DATA_DIR SNAPSHOT.tar.gz | restore SNAPSHOT.tar.gz NEW_DATA_DIR. Stop the server first. DATABASE_URL must be unset.');
  }
  if (action === 'backup') {
    if (!(await stat(path.join(source,'PG_VERSION')).catch(()=>null))?.isFile()) throw new Error('Not an existing PostgreSQL data directory');
    if (await stat(target).catch(()=>null)) throw new Error('Output already exists; refusing to overwrite');
    const database = await PGlite.create(source);
    try {
      await database.exec('CHECKPOINT');
      const archive = await database.dumpDataDir('gzip');
      await mkdir(path.dirname(target),{recursive:true,mode:0o700});
      await writeFile(target,new Uint8Array(await archive.arrayBuffer()),{mode:0o600,flag:'wx'});
      console.log('Private local snapshot created. It contains credentials and confidential records; do not share it.');
    } finally { await database.close(); }
  } else {
    if (await stat(target).catch(()=>null)) throw new Error('Restore destination already exists; use a new directory');
    const bytes = await readFile(source);
    const database = await PGlite.create({dataDir:target,loadDataDir:new Blob([bytes])});
    try { await database.query('SELECT 1'); console.log('Local snapshot restored into a new directory.'); }
    finally { await database.close(); }
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Backup operation failed');process.exitCode=1;});
