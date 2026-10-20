import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';

test('offline local backup restores actual database records and refuses overwrite',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'wasli-backup-'));
 const data=path.join(root,'source'),archive=path.join(root,'private.tar.gz'),restored=path.join(root,'restored');
 const cli=(...args:string[])=>spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/backup.ts',...args],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,DATABASE_URL:''}});
 try{
  const db=await PGlite.create(data);
  await db.exec('CREATE TABLE restore_evidence(id text PRIMARY KEY,content text)');
  await db.query('INSERT INTO restore_evidence VALUES($1,$2)',['restore-check','A real persisted row']);
  await db.close();
  const saved=cli('backup',data,archive);assert.equal(saved.status,0,saved.stderr);
  assert.equal((await stat(archive)).mode&0o777,0o600);
  assert.notEqual(cli('backup',data,archive).status,0,'Existing snapshots must not be overwritten');
  const loaded=cli('restore',archive,restored);assert.equal(loaded.status,0,loaded.stderr);
  const check=await PGlite.create(restored);
  assert.deepEqual((await check.query('SELECT * FROM restore_evidence')).rows,[{id:'restore-check',content:'A real persisted row'}]);
  await check.close();
  assert.notEqual(cli('restore',archive,restored).status,0,'Existing restored databases must not be overwritten');
 }finally{await rm(root,{recursive:true,force:true});}
});
