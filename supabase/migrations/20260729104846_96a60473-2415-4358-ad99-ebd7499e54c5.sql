CREATE TABLE public.captures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled Capture',
  category text NOT NULL DEFAULT 'Uncategorized',
  subfolder text,
  tags text[] NOT NULL DEFAULT '{}',
  ocr_text text NOT NULL DEFAULT '',
  entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'organized',
  storage_path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  phash text,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.captures TO authenticated;
GRANT ALL ON public.captures TO service_role;

ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own captures" ON public.captures FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own captures" ON public.captures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own captures" ON public.captures FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own captures" ON public.captures FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX captures_user_created_idx ON public.captures (user_id, created_at DESC);
CREATE INDEX captures_phash_idx ON public.captures (user_id, phash);
CREATE INDEX captures_search_idx ON public.captures USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(ocr_text,'')));
CREATE INDEX captures_tags_idx ON public.captures USING gin (tags);

CREATE TRIGGER update_captures_updated_at BEFORE UPDATE ON public.captures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.capture_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  keyword text NOT NULL,
  category text NOT NULL,
  subfolder text,
  weight integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, keyword, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_rules TO authenticated;
GRANT ALL ON public.capture_rules TO service_role;

ALTER TABLE public.capture_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own capture rules" ON public.capture_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own capture rules" ON public.capture_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own capture rules" ON public.capture_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own capture rules" ON public.capture_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_capture_rules_updated_at BEFORE UPDATE ON public.capture_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();