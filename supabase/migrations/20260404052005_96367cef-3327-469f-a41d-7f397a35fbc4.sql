
-- Add reply_to, attachment columns to group_messages
ALTER TABLE public.group_messages 
ADD COLUMN reply_to uuid REFERENCES public.group_messages(id) ON DELETE SET NULL,
ADD COLUMN attachment_url text,
ADD COLUMN attachment_type text;

-- Allow members to delete their own messages
CREATE POLICY "Members can delete own messages"
ON public.group_messages
FOR DELETE
USING (auth.uid() = user_id AND is_group_member(auth.uid(), group_id));

-- Create reactions table
CREATE TABLE public.group_message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactions"
ON public.group_message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = message_id AND is_group_member(auth.uid(), gm.group_id)
  )
);

CREATE POLICY "Members can add reactions"
ON public.group_message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = message_id AND is_group_member(auth.uid(), gm.group_id)
  )
);

CREATE POLICY "Users can remove own reactions"
ON public.group_message_reactions
FOR DELETE
USING (auth.uid() = user_id);
