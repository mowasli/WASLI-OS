-- Local development and managed PostgreSQL core. Never apply remotely without approval.
CREATE TABLE IF NOT EXISTS app_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id text PRIMARY KEY CHECK (id IN ('wasl','thv','personal','independent')), name text NOT NULL
);
INSERT INTO workspaces(id,name) VALUES ('wasl','WASL Ecosystems'),('thv','Tech Horizons Ventures'),('personal','Personal'),('independent','Freelancing & Volunteering') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS workspace_memberships (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','editor','viewer')),
 PRIMARY KEY(user_id,workspace_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_attempts (
 email text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, last_attempt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projects (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200), description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','on_hold','completed')),
 due_date text, category text NOT NULL DEFAULT 'general' CHECK(category IN ('general','freelance','volunteer')),
 milestones jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,workspace_id)
);
CREATE TABLE IF NOT EXISTS tasks (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), project_id uuid,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300), description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','blocked','done')),
 priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
 due_date text, assignee text NOT NULL DEFAULT '', tags jsonb NOT NULL DEFAULT '[]',
 category text NOT NULL DEFAULT 'general' CHECK(category IN ('general','freelance','volunteer')),
 estimated_minutes integer NOT NULL DEFAULT 0 CHECK(estimated_minutes BETWEEN 0 AND 100000), important boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,workspace_id), FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id)
);
CREATE TABLE IF NOT EXISTS task_dependencies (
 task_id uuid NOT NULL, dependency_id uuid NOT NULL, workspace_id text NOT NULL,
 PRIMARY KEY(task_id,dependency_id), CHECK(task_id<>dependency_id),
 FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(dependency_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id uuid PRIMARY KEY, user_id uuid REFERENCES app_users(id), workspace_id text REFERENCES workspaces(id),
 action text NOT NULL, entity_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_workspace_status_idx ON tasks(workspace_id,status,due_date);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS audit_workspace_idx ON audit_logs(workspace_id,created_at);
