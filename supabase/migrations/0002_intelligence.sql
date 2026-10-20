-- Additive intelligence storage; production application requires explicit operator approval.
CREATE TABLE IF NOT EXISTS intelligence_sources (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), name text NOT NULL,
 endpoint text NOT NULL, enabled boolean NOT NULL DEFAULT true, last_attempt_at timestamptz,
 last_success_at timestamptz, last_error text
);
CREATE TABLE IF NOT EXISTS intelligence_records (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), external_id text NOT NULL,
 title text NOT NULL, organization text NOT NULL DEFAULT '', country text NOT NULL DEFAULT '',
 type text NOT NULL DEFAULT 'procurement_notice', description text NOT NULL DEFAULT '', source_url text NOT NULL,
 published_at text, deadline text, last_verified_at timestamptz NOT NULL, content_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('new','updated','expired','unverified','archived')),
 eligibility text NOT NULL CHECK(eligibility IN ('unknown','eligible','ineligible')),
 fit_score integer NOT NULL CHECK(fit_score BETWEEN 0 AND 100), score_method text NOT NULL DEFAULT 'rules-based',
 recommended_action text NOT NULL, verification_note text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,external_id)
);
CREATE TABLE IF NOT EXISTS intelligence_jobs (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), trigger text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','succeeded','partial','failed')),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 discovered integer NOT NULL DEFAULT 0, updated integer NOT NULL DEFAULT 0,
 source_results jsonb NOT NULL DEFAULT '[]', error text
);
CREATE UNIQUE INDEX IF NOT EXISTS intelligence_one_running_job ON intelligence_jobs(workspace_id) WHERE status='running';
CREATE INDEX IF NOT EXISTS intelligence_workspace_deadline ON intelligence_records(workspace_id,deadline);
ALTER TABLE intelligence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_jobs ENABLE ROW LEVEL SECURITY;
-- Browser clients receive no grants here. Application endpoints authenticate membership.
-- Supabase production policies are applied only when the auth schema is installed.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') THEN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='intelligence_records' AND policyname='intelligence_member_read') THEN
   EXECUTE 'CREATE POLICY intelligence_member_read ON intelligence_records FOR SELECT USING (EXISTS (SELECT 1 FROM workspace_memberships m WHERE m.workspace_id=intelligence_records.workspace_id AND m.user_id=auth.uid()))';
   EXECUTE 'CREATE POLICY intelligence_source_member_read ON intelligence_sources FOR SELECT USING (EXISTS (SELECT 1 FROM workspace_memberships m WHERE m.workspace_id=intelligence_sources.workspace_id AND m.user_id=auth.uid()))';
   EXECUTE 'CREATE POLICY intelligence_job_member_read ON intelligence_jobs FOR SELECT USING (EXISTS (SELECT 1 FROM workspace_memberships m WHERE m.workspace_id=intelligence_jobs.workspace_id AND m.user_id=auth.uid()))';
  END IF;
 END IF;
END $$;

INSERT INTO intelligence_sources(id,workspace_id,name,endpoint) VALUES
 ('worldbank-yemen','wasl','World Bank procurement — Yemen','https://search.worldbank.org/api/v2/procnotices?format=json&rows=50&os=0&qterm=Yemen'),
 ('worldbank-entrepreneurship','wasl','World Bank procurement — entrepreneurship (MENA filter)','https://search.worldbank.org/api/v2/procnotices?format=json&rows=50&os=0&qterm=entrepreneurship')
ON CONFLICT(id) DO NOTHING;

-- User-curated intelligence data is deliberately separate from scanner-owned facts.
ALTER TABLE intelligence_records ADD COLUMN IF NOT EXISTS saved boolean NOT NULL DEFAULT false;
ALTER TABLE intelligence_records ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';
ALTER TABLE intelligence_records ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE intelligence_records ADD COLUMN IF NOT EXISTS project_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS intelligence_record_workspace_id ON intelligence_records(id,workspace_id);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='intelligence_project_workspace_fk') THEN
  ALTER TABLE intelligence_records ADD CONSTRAINT intelligence_project_workspace_fk
   FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE SET NULL (project_id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS intelligence_comments (
 id uuid PRIMARY KEY, record_id uuid NOT NULL, workspace_id text NOT NULL REFERENCES workspaces(id),
 user_id uuid NOT NULL REFERENCES app_users(id), author text NOT NULL, body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(record_id,workspace_id) REFERENCES intelligence_records(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS intelligence_comments_record_date ON intelligence_comments(record_id,created_at);
ALTER TABLE intelligence_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='intelligence_comments' AND policyname='intelligence_comments_member_read') THEN
  EXECUTE 'CREATE POLICY intelligence_comments_member_read ON intelligence_comments FOR SELECT USING (EXISTS (SELECT 1 FROM workspace_memberships m WHERE m.workspace_id=intelligence_comments.workspace_id AND m.user_id=auth.uid()))';
 END IF;
END $$;
