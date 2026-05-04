
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS folder_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.tasks ALTER COLUMN date DROP NOT NULL;
CREATE INDEX IF NOT EXISTS notes_folder_id_idx ON public.notes(folder_id);
CREATE INDEX IF NOT EXISTS tasks_folder_id_idx ON public.tasks(folder_id);
CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON public.tasks(parent_id);
