-- HISTORICAL DRAFT ONLY. SUPERSEDED 2026-10-22. DO NOT RUN.
-- See SECURITY-AUDIT-2026-10-22.md and sql/security-hardening.sql for applied changes.
-- This old draft uses public trigger functions and direct bucket metadata updates;
-- neither is the deployment approach used by the completed audit.
-- REVIEW DRAFT, 2026-10-21. NOT APPLIED. NOT A MIGRATION.
-- Default ROLLBACK makes this a rehearsal, not an installation.
-- Review/test in an isolated database first. Deploy the new avatar client together.
-- Existing ownerless Storage files are deliberately NOT reassigned or deleted.
BEGIN;

-- Replace internal auth trigger bodies with schema-qualified references.
-- SECURITY DEFINER already exists and is required for these internal auth triggers.
CREATE OR REPLACE FUNCTION public.check_email_whitelist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email nie je na whiteliste';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, pg_catalog.split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_email_whitelist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Remove unused client privileges; RLS continues to enforce row ownership.
REVOKE ALL ON TABLE public.profiles, public.watchlist, public.watch_history, public.allowed_emails
FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.watchlist, public.watch_history TO authenticated;

ALTER POLICY "Own profile only" ON public.profiles TO authenticated
USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
ALTER POLICY "Own watchlist only" ON public.watchlist TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Own history only" ON public.watch_history TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- These ALTERs fail rather than discard data if concurrent writes added NULLs.
ALTER TABLE public.watchlist ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN media_type SET NOT NULL;
ALTER TABLE public.watch_history ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN media_type SET NOT NULL;

-- Public download URLs keep working; listing/metadata is limited to the owner.
ALTER POLICY "Avatar read" ON storage.objects TO authenticated
USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Avatar upload" ON storage.objects TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text)
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
ALTER POLICY "Avatar update" ON storage.objects TO authenticated
USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text))
WITH CHECK (
  bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text)
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
ALTER POLICY "Avatar delete" ON storage.objects TO authenticated
USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid()::text));

UPDATE storage.buckets SET file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

-- Inspect these results during rehearsal. They do not replace two-user API tests.
SELECT policyname, schemaname, tablename, roles, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage');
SELECT p.proname, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('check_email_whitelist','handle_new_user','rls_auto_enable');

ROLLBACK;
-- Before COMMIT: verify signup whitelisted/blocked, existing login, own CRUD,
-- cross-user read/write denial, avatar insert/replacement/cleanup, public URL,
-- listing denial, non-image/oversized rejection and unchanged existing counts.
