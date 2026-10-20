-- Apply to a managed database only after explicit operator/user approval.
-- OAuth tokens and PKCE verifiers are encrypted by the application with
-- AES-256-GCM; the encryption key is never stored in PostgreSQL.
CREATE TABLE IF NOT EXISTS integration_oauth_states (
 state_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspaces(id), service text NOT NULL CHECK(service IN ('drive','gmail','calendar')),
 session_hash text NOT NULL, verifier_ciphertext text NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_oauth_expiry_idx ON integration_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS integration_accounts (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspaces(id), service text NOT NULL CHECK(service IN ('drive','gmail','calendar')),
 access_ciphertext text NOT NULL, refresh_ciphertext text, expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','reconnect_required')),
 credential_generation uuid NOT NULL DEFAULT gen_random_uuid(),
 granted_scopes text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,service), UNIQUE(id,workspace_id)
);
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','reconnect_required'));
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_generation uuid NOT NULL DEFAULT gen_random_uuid();
CREATE TABLE IF NOT EXISTS integration_drive_files (
 integration_id uuid NOT NULL, workspace_id text NOT NULL, file_id text NOT NULL,
 selected_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(integration_id,file_id),
 FOREIGN KEY(integration_id,workspace_id) REFERENCES integration_accounts(id,workspace_id) ON DELETE CASCADE
);
-- Server-only tables: deliberately no browser/anon/authenticated RLS policies.
-- The approved server database role must be authorized independently; server
-- requests still enforce membership, role and connection ownership.
ALTER TABLE integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_drive_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON integration_oauth_states,integration_accounts,integration_drive_files FROM PUBLIC;
