
CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_memory_user_key ON public.ai_memory (user_id, key);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory" ON public.ai_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own memory" ON public.ai_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON public.ai_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memory" ON public.ai_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);
