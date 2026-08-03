CREATE TABLE public.device_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  device_id text NOT NULL,
  device_label text NOT NULL DEFAULT 'Device',
  route text NOT NULL DEFAULT '/',
  title text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_sessions TO authenticated;
GRANT ALL ON public.device_sessions TO service_role;

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own device sessions"
ON public.device_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX device_sessions_user_updated_idx ON public.device_sessions (user_id, updated_at DESC);

CREATE TRIGGER update_device_sessions_updated_at
BEFORE UPDATE ON public.device_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();