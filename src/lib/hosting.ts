import { supabaseAuthConfig } from './supabase-auth';

export const HOSTED_TABLES = [
  'app_users', 'workspaces', 'workspace_memberships', 'sessions', 'login_attempts',
  'projects', 'tasks', 'task_dependencies', 'audit_logs', 'knowledge_documents',
  'knowledge_chunks', 'assistant_messages', 'integration_oauth_states', 'integration_accounts',
  'integration_drive_files', 'intelligence_sources', 'intelligence_records', 'intelligence_jobs',
  'intelligence_comments', 'operations_records', 'sops', 'sop_versions',
] as const;

/** Offline, value-free report. It never creates infrastructure, applies SQL or authenticates a user. */
export function hostingConfigurationIssues(env:Readonly<Record<string,string|undefined>>=process.env,nodeMajor=Number(process.versions.node.split('.')[0])):string[] {
  const issues:string[]=[];
  if(nodeMajor!==24) issues.push('Use Node.js 24.');
  if(env.WASLI_AUTH_PROVIDER!=='supabase') issues.push('Set WASLI_AUTH_PROVIDER=supabase.');
  try { supabaseAuthConfig(env); }
  catch { issues.push('Set a canonical HTTPS SUPABASE_URL and a public SUPABASE_PUBLISHABLE_KEY (sb_publishable_...).'); }
  if(env.ALLOW_LOCAL_AUTH==='true') issues.push('Remove ALLOW_LOCAL_AUTH for hosted deployments.');
  if(env.WASLI_DATA_DIR) issues.push('Remove WASLI_DATA_DIR; hosted persistence must use PostgreSQL.');
  try {
    const origin=new URL(env.WASLI_APP_ORIGIN??'');
    if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||
      ['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error();
  } catch { issues.push('Set WASLI_APP_ORIGIN to the exact public HTTPS origin, without a path.'); }
  try {
    const url=new URL(env.DATABASE_URL??'');
    if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.password||url.pathname.length<2||
      ['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.searchParams.get('sslmode')==='disable') throw new Error();
  } catch { issues.push('Set DATABASE_URL to an authenticated remote PostgreSQL pooler URL with TLS.'); }
  return issues;
}
