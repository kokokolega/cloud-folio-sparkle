
-- Groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL,
  invite_code TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Group members
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Whiteboards (personal or group)
CREATE TABLE public.whiteboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
  data JSONB NOT NULL DEFAULT '{}',
  user_id UUID NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;

-- Group messages (chat)
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Add group_id to notes for shared notes
ALTER TABLE public.notes ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Add group_id to files for shared files
ALTER TABLE public.files ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Add group_id to folders for shared folders
ALTER TABLE public.folders ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Security definer function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- RLS for groups: members can view, creator can update/delete
CREATE POLICY "Members can view groups" ON public.groups
  FOR SELECT USING (public.is_group_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update group" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete group" ON public.groups
  FOR DELETE USING (auth.uid() = created_by);

-- RLS for group_members
CREATE POLICY "Members can view group members" ON public.group_members
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" ON public.group_members
  FOR DELETE USING (auth.uid() = user_id);

-- RLS for whiteboards
CREATE POLICY "Users can view own whiteboards" ON public.whiteboards
  FOR SELECT USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id)));

CREATE POLICY "Users can create whiteboards" ON public.whiteboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or group whiteboards" ON public.whiteboards
  FOR UPDATE USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id)));

CREATE POLICY "Users can delete own whiteboards" ON public.whiteboards
  FOR DELETE USING (auth.uid() = user_id);

-- RLS for group_messages
CREATE POLICY "Members can view messages" ON public.group_messages
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Members can send messages" ON public.group_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_group_member(auth.uid(), group_id));

-- Update notes RLS to allow group access
CREATE POLICY "Group members can view group notes" ON public.notes
  FOR SELECT USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can create group notes" ON public.notes
  FOR INSERT WITH CHECK (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id) AND auth.uid() = user_id);

CREATE POLICY "Group members can update group notes" ON public.notes
  FOR UPDATE USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can delete group notes" ON public.notes
  FOR DELETE USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

-- Update files RLS for group access
CREATE POLICY "Group members can view group files" ON public.files
  FOR SELECT USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can upload group files" ON public.files
  FOR INSERT WITH CHECK (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id) AND auth.uid() = user_id);

CREATE POLICY "Group members can update group files" ON public.files
  FOR UPDATE USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can delete group files" ON public.files
  FOR DELETE USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

-- Update folders RLS for group access
CREATE POLICY "Group members can view group folders" ON public.folders
  FOR SELECT USING (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can create group folders" ON public.folders
  FOR INSERT WITH CHECK (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id) AND auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whiteboards_updated_at BEFORE UPDATE ON public.whiteboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Allow anyone to read groups by invite_code for join flow (no auth needed for lookup)
CREATE POLICY "Anyone can lookup group by invite code" ON public.groups
  FOR SELECT USING (true);
