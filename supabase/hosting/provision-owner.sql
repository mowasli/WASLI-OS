-- PREPARED ONLY. Review and obtain approval before applying to a hosted database.
-- psql variables: owner_id, owner_email, owner_name. Supply values securely.
-- Example invocation is documented in docs/HOSTING.md. No public signup exists.
-- Fails/rolls back if the verified Supabase user is absent or the app profile exists.
BEGIN;
INSERT INTO public.app_users(id,email,name,password_hash) VALUES (
 (SELECT id FROM auth.users WHERE id=:'owner_id'::uuid AND lower(email)=lower(:'owner_email')
  AND email_confirmed_at IS NOT NULL AND COALESCE(is_anonymous,false)=false),
 lower(:'owner_email'),:'owner_name',NULL
);
INSERT INTO public.workspace_memberships(user_id,workspace_id,role)
SELECT :'owner_id'::uuid,id,'owner' FROM public.workspaces;
COMMIT;
