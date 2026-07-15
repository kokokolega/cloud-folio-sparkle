
-- 1. Private schema for security-definer helpers
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated;

-- 2. Move is_group_member into internal (drop policies first, recreate after)
DROP POLICY IF EXISTS "Group members can view group files" ON public.files;
DROP POLICY IF EXISTS "Group members can update group files" ON public.files;
DROP POLICY IF EXISTS "Group members can delete group files" ON public.files;
DROP POLICY IF EXISTS "Group members can upload group files" ON public.files;
DROP POLICY IF EXISTS "Members can view groups" ON public.groups;

-- Also drop any other policies that reference is_group_member across schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (qual LIKE '%is_group_member%' OR with_check LIKE '%is_group_member%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION internal.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;
REVOKE ALL ON FUNCTION internal.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.is_group_member(uuid, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);

-- Recreate group_members / groups / files / etc. policies using internal.is_group_member
-- groups: members can view
CREATE POLICY "Members can view groups" ON public.groups
FOR SELECT TO authenticated
USING (internal.is_group_member(auth.uid(), id));

-- files: group access
CREATE POLICY "Group members can view group files" ON public.files
FOR SELECT TO authenticated
USING (group_id IS NOT NULL AND internal.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can update group files" ON public.files
FOR UPDATE TO authenticated
USING (group_id IS NOT NULL AND internal.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can delete group files" ON public.files
FOR DELETE TO authenticated
USING (group_id IS NOT NULL AND internal.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can upload group files" ON public.files
FOR INSERT TO authenticated
WITH CHECK (group_id IS NOT NULL AND internal.is_group_member(auth.uid(), group_id) AND auth.uid() = user_id);

-- Recreate any group_members policies referencing the old function
-- (they were dropped by the DO block; recreate common ones)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_members' AND policyname='Members can view group memberships') THEN
    CREATE POLICY "Members can view group memberships" ON public.group_members
    FOR SELECT TO authenticated
    USING (internal.is_group_member(auth.uid(), group_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_members' AND policyname='Users can insert themselves as members') THEN
    CREATE POLICY "Users can insert themselves as members" ON public.group_members
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_members' AND policyname='Users can leave groups') THEN
    CREATE POLICY "Users can leave groups" ON public.group_members
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='Group members can view messages') THEN
    CREATE POLICY "Group members can view messages" ON public.group_messages
    FOR SELECT TO authenticated
    USING (internal.is_group_member(auth.uid(), group_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='Group members can send messages') THEN
    CREATE POLICY "Group members can send messages" ON public.group_messages
    FOR INSERT TO authenticated
    WITH CHECK (internal.is_group_member(auth.uid(), group_id) AND auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='Users can delete own messages') THEN
    CREATE POLICY "Users can delete own messages" ON public.group_messages
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_message_reactions' AND policyname='Group members can view reactions') THEN
    CREATE POLICY "Group members can view reactions" ON public.group_message_reactions
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.group_messages gm WHERE gm.id = message_id AND internal.is_group_member(auth.uid(), gm.group_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_message_reactions' AND policyname='Group members can add reactions') THEN
    CREATE POLICY "Group members can add reactions" ON public.group_message_reactions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.group_messages gm WHERE gm.id = message_id AND internal.is_group_member(auth.uid(), gm.group_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_message_reactions' AND policyname='Users can remove own reactions') THEN
    CREATE POLICY "Users can remove own reactions" ON public.group_message_reactions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whiteboards' AND policyname='Group members can view group whiteboards') THEN
    -- best-effort: skip if not applicable
    NULL;
  END IF;
END $$;

-- 3. Move handle_new_user to internal and rewire auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION internal.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'email');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION internal.handle_new_user();

DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. files: drop public-anyone policy; add RPC
DROP POLICY IF EXISTS "Anyone can view files by public_id" ON public.files;

CREATE OR REPLACE FUNCTION public.get_file_by_public_id(_public_id text)
RETURNS TABLE(id uuid, name text, type text, size bigint, storage_path text, public_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id, f.name, f.type, f.size, f.storage_path, f.public_id
  FROM public.files f
  WHERE f.public_id = _public_id AND f.deleted_at IS NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_file_by_public_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_file_by_public_id(text) TO anon, authenticated;
-- Note: this function is intentionally callable by anon for public share links.

-- 5. groups: drop broad invite lookup; add RPC for signed-in users
DROP POLICY IF EXISTS "Anyone can lookup group by invite code" ON public.groups;

CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(_invite_code text)
RETURNS TABLE(group_id uuid, group_name text, already_member boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _gid uuid;
  _gname text;
  _uid uuid := auth.uid();
  _existing boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT g.id, g.name INTO _gid, _gname FROM public.groups g WHERE g.invite_code = _invite_code;
  IF _gid IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = 'P0002';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _gid AND user_id = _uid) INTO _existing;
  IF NOT _existing THEN
    INSERT INTO public.group_members(group_id, user_id, role) VALUES (_gid, _uid, 'member');
  END IF;
  RETURN QUERY SELECT _gid, _gname, _existing;
END;
$$;
REVOKE ALL ON FUNCTION public.join_group_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_by_invite_code(text) TO authenticated;

-- 6. profiles: replace group-member email exposure with owner-only + RPC for co-member basics
DROP POLICY IF EXISTS "Group members can view member profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_group_member_profiles(_group_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.user_id = p.user_id
  )
  AND EXISTS (
    SELECT 1 FROM public.group_members me
    WHERE me.group_id = _group_id AND me.user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.get_group_member_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_member_profiles(uuid) TO authenticated;

-- 7. Storage: tighten user-files SELECT policy to owner-only
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'user-files' AND (auth.uid())::text = (storage.foldername(name))[1]);
