import { loadEnvConfig } from '@next/env';
import { openDatabase } from '../src/lib/db';
import { HOSTED_TABLES, hostingConfigurationIssues } from '../src/lib/hosting';

async function main():Promise<void> {
loadEnvConfig(process.cwd(), false);
const argumentsAllowed=new Set(['--database']);
if(process.argv.slice(2).some(value=>!argumentsAllowed.has(value))) {
  console.error('Usage: npm run hosting:check [-- --database]'); process.exit(1);
}
const issues=hostingConfigurationIssues();
if(issues.length) {
  console.error('Hosting configuration is incomplete. No credential values are printed.');
  issues.forEach(issue=>console.error(`- ${issue}`));
  process.exit(1);
}
console.log('Offline hosting configuration checks passed. No live login, migration or deployment was performed.');
if(process.argv.includes('--database')) {
  let connection:Awaited<ReturnType<typeof openDatabase>>|undefined;
  try {
    connection=await openDatabase();
    await connection.transaction(async tx=>{
      await tx.query('SET TRANSACTION READ ONLY');
      const tables=await tx.query<{name:string;rls:boolean}>("SELECT c.relname AS name,c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY($1::text[])",[[...HOSTED_TABLES]]);
      const missing=HOSTED_TABLES.filter(name=>!tables.rows.some(row=>row.name===name));
      const unprotected=tables.rows.filter(row=>!row.rls).map(row=>row.name);
      if(missing.length||unprotected.length) throw new Error('Schema/RLS checks failed; review approved migrations.');
      const owner=await tx.query<{id:string}>("SELECT u.id FROM app_users u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.role='owner' GROUP BY u.id HAVING count(DISTINCT m.workspace_id)=4 LIMIT 1");
      if(!owner.rows.length) throw new Error('Provision the approved owner identity and memberships.');
    });
    console.log('Read-only database connection, expected tables, RLS enablement and owner membership checks passed. This does not verify policy semantics or a live Supabase login.');
  } catch {
    console.error('Database readiness check failed. Check connectivity, TLS, approved migrations and owner provisioning. Details and credential values are not printed.');
    process.exitCode=1;
  } finally { await connection?.close(); }
}

}
main().catch(()=>{console.error("Hosting preflight could not complete. No credential values are printed.");process.exitCode=1;});
