CREATE TABLE public.alarms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Alarm',
  alarm_time TEXT NOT NULL,
  repeat_days INTEGER[] NOT NULL DEFAULT '{}',
  ringtone TEXT NOT NULL DEFAULT 'classic',
  sound_mode TEXT NOT NULL DEFAULT 'sound_vibration',
  vibration_pattern TEXT NOT NULL DEFAULT 'strong',
  volume NUMERIC NOT NULL DEFAULT 0.8,
  snooze_minutes INTEGER NOT NULL DEFAULT 5,
  repeat_attempts INTEGER NOT NULL DEFAULT 3,
  notif_title TEXT NOT NULL DEFAULT 'Oltrid Alarm',
  notif_message TEXT NOT NULL DEFAULT '',
  fullscreen BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarms TO authenticated;
GRANT ALL ON public.alarms TO service_role;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own alarms" ON public.alarms FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.update_alarms_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_alarms_updated_at BEFORE UPDATE ON public.alarms FOR EACH ROW EXECUTE FUNCTION public.update_alarms_updated_at();