-- Managed Supabase defense in depth. Requires explicit operator approval.
-- Local PGlite has no auth schema: this migration intentionally has no effect there.
-- Service-side API authorization remains mandatory even when a privileged DB role
-- bypasses RLS. Supabase user provisioning/JWT validation must be configured before
-- hosted production authentication is enabled.
DO $migration$
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='auth') THEN
  EXECUTE $function$
   CREATE OR REPLACE FUNCTION public.wasli_workspace_access(target_workspace text,require_write boolean DEFAULT false)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
   AS 'SELECT EXISTS(SELECT 1 FROM public.workspace_memberships m WHERE m.workspace_id=target_workspace AND m.user_id=auth.uid() AND (NOT require_write OR m.role IN (''owner'',''editor'')))'
  $function$;
  EXECUTE 'REVOKE ALL ON FUNCTION public.wasli_workspace_access(text,boolean) FROM PUBLIC';
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   EXECUTE 'GRANT EXECUTE ON FUNCTION public.wasli_workspace_access(text,boolean) TO authenticated';
  END IF;
  ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
  ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS own_profile ON app_users;
  CREATE POLICY own_profile ON app_users FOR SELECT USING(id=auth.uid());
  DROP POLICY IF EXISTS own_membership ON workspace_memberships;
  CREATE POLICY own_membership ON workspace_memberships FOR SELECT USING(user_id=auth.uid());
  DROP POLICY IF EXISTS workspace_read ON workspaces;
  CREATE POLICY workspace_read ON workspaces FOR SELECT USING(public.wasli_workspace_access(id,false));
  DROP POLICY IF EXISTS project_read ON projects;
  CREATE POLICY project_read ON projects FOR SELECT USING(public.wasli_workspace_access(workspace_id,false));
  DROP POLICY IF EXISTS project_insert ON projects;
  CREATE POLICY project_insert ON projects FOR INSERT WITH CHECK(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS project_update ON projects;
  CREATE POLICY project_update ON projects FOR UPDATE USING(public.wasli_workspace_access(workspace_id,true)) WITH CHECK(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS project_delete ON projects;
  CREATE POLICY project_delete ON projects FOR DELETE USING(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS task_read ON tasks;
  CREATE POLICY task_read ON tasks FOR SELECT USING(public.wasli_workspace_access(workspace_id,false));
  DROP POLICY IF EXISTS task_insert ON tasks;
  CREATE POLICY task_insert ON tasks FOR INSERT WITH CHECK(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS task_update ON tasks;
  CREATE POLICY task_update ON tasks FOR UPDATE USING(public.wasli_workspace_access(workspace_id,true)) WITH CHECK(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS task_delete ON tasks;
  CREATE POLICY task_delete ON tasks FOR DELETE USING(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS dependency_read ON task_dependencies;
  CREATE POLICY dependency_read ON task_dependencies FOR SELECT USING(public.wasli_workspace_access(workspace_id,false));
  DROP POLICY IF EXISTS dependency_write ON task_dependencies;
  CREATE POLICY dependency_write ON task_dependencies FOR ALL USING(public.wasli_workspace_access(workspace_id,true)) WITH CHECK(public.wasli_workspace_access(workspace_id,true));
  DROP POLICY IF EXISTS audit_read ON audit_logs;
  CREATE POLICY audit_read ON audit_logs FOR SELECT USING(public.wasli_workspace_access(workspace_id,false));
  -- No browser policies exist for sessions/login_attempts or privileged member
  -- provisioning; these remain accessible only to authorized server operators.
 END IF;
END
$migration$;
