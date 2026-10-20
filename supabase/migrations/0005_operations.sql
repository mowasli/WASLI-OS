-- Specialist operations. Apply remotely only after approval.
CREATE TABLE IF NOT EXISTS operations_records (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id),
 kind text NOT NULL CHECK(kind IN ('contact','startup','content','engagement')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 organization text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 due_date text, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','waiting','completed','archived')),
 category text NOT NULL DEFAULT 'general' CHECK(category IN ('general','freelance','volunteer')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sops (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) CHECK(workspace_id='thv'),
 title text NOT NULL, category text NOT NULL CHECK(category IN ('softlanding','venture_building')),
 current_version integer NOT NULL DEFAULT 1 CHECK(current_version>0), archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,workspace_id)
);
CREATE TABLE IF NOT EXISTS sop_versions (
 id uuid PRIMARY KEY, sop_id uuid NOT NULL, workspace_id text NOT NULL, version integer NOT NULL CHECK(version>0),
 title text NOT NULL, content text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
 drafted_by uuid NOT NULL REFERENCES app_users(id), approved_by uuid REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz,
 FOREIGN KEY(sop_id,workspace_id) REFERENCES sops(id,workspace_id), UNIQUE(sop_id,version),
 CHECK((status='draft' AND approved_by IS NULL AND approved_at IS NULL) OR (status='approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS operations_workspace_idx ON operations_records(workspace_id,kind,due_date);
CREATE INDEX IF NOT EXISTS sops_workspace_idx ON sops(workspace_id,archived);
CREATE OR REPLACE FUNCTION protect_approved_sop_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='approved' THEN RAISE EXCEPTION 'Approved SOP versions are immutable'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS immutable_approved_sop_version ON sop_versions;
CREATE TRIGGER immutable_approved_sop_version BEFORE UPDATE OR DELETE ON sop_versions FOR EACH ROW EXECUTE FUNCTION protect_approved_sop_version();

-- Browser/Data API access is denied until production policies are explicitly reviewed.
ALTER TABLE operations_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_versions ENABLE ROW LEVEL SECURITY;
