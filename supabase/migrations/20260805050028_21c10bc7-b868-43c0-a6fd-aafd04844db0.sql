CREATE OR REPLACE FUNCTION public.create_group(_name text, _description text DEFAULT '')
RETURNS TABLE(id uuid, name text, description text, invite_code text, created_by uuid, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF coalesce(trim(_name), '') = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.groups (name, description, created_by)
  VALUES (trim(_name), coalesce(_description, ''), auth.uid())
  RETURNING groups.id INTO _gid;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (_gid, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT g.id, g.name, g.description, g.invite_code, g.created_by, g.created_at, g.updated_at
  FROM public.groups g WHERE g.id = _gid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group(text, text) TO authenticated;