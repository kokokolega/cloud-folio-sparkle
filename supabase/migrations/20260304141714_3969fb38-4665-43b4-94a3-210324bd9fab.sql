
-- Add unique constraint on profiles.user_id so PostgREST can resolve FK joins
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Add FK from group_members.user_id to profiles.user_id
ALTER TABLE public.group_members 
  ADD CONSTRAINT group_members_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add FK from group_messages.user_id to profiles.user_id
ALTER TABLE public.group_messages 
  ADD CONSTRAINT group_messages_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
