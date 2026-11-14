-- Phase 3: Account identity creation. Requires Phase 2 migration.
-- Forward-only; do not rewrite Phase 2 after it has been merged.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
GRANT UPDATE(onboarding_completed) ON public.profiles TO authenticated;

-- PostgreSQL's gen_random_uuid() uses a cryptographically secure RNG. Read
-- random UUID bytes, rejecting values >= 248 for unbiased 31-way selection.
-- No email, display name or other personal information enters the code.
CREATE FUNCTION app_private.random_friend_code()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text := '';
  sample bytea;
  value integer;
  byte_index integer;
BEGIN
  WHILE pg_catalog.length(candidate) < 5 LOOP
    sample := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    FOR byte_index IN 0..15 LOOP
      value := pg_catalog.get_byte(sample, byte_index);
      IF value < 248 THEN
        candidate := candidate || pg_catalog.substr(alphabet, (value % 31) + 1, 1);
      END IF;
      EXIT WHEN pg_catalog.length(candidate) = 5;
    END LOOP;
  END LOOP;

  RETURN candidate;
END;
$$;

-- No preliminary SELECT: unique index + atomic insert handles concurrent
-- registration races. Failure to allocate a code aborts the registration,
-- ensuring an auth identity cannot silently lack a profile/friend code.
CREATE FUNCTION app_private.allocate_friend_code(account_id uuid)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate text;
  attempt integer;
BEGIN
  FOR attempt IN 1..32 LOOP
    candidate := app_private.random_friend_code();

    INSERT INTO public.friend_codes (user_id, code)
    VALUES (account_id, candidate)
    ON CONFLICT (code) DO NOTHING;

    IF FOUND THEN
      RETURN candidate;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Unable to allocate an available friend code'
    USING ERRCODE = 'unique_violation';
END;
$$;

CREATE FUNCTION app_private.on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate_name text;
  valid_name boolean;
BEGIN
  candidate_name := COALESCE(
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'name'), '')
  );

  valid_name := candidate_name IS NOT NULL;
  IF NOT valid_name THEN
    candidate_name := 'Player';
  END IF;

  INSERT INTO public.profiles(id, display_name, onboarding_completed)
  VALUES (NEW.id, pg_catalog.left(candidate_name, 80), valid_name);

  PERFORM app_private.allocate_friend_code(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER daydle_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.on_auth_user_created();

-- SECURITY DEFINER functions are never directly callable by browser roles,
-- including through function RPC endpoints. The trigger executes as its owner.
REVOKE ALL ON FUNCTION app_private.random_friend_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.allocate_friend_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.on_auth_user_created() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.random_friend_code() TO service_role;
GRANT EXECUTE ON FUNCTION app_private.allocate_friend_code(uuid) TO service_role;

COMMIT;
