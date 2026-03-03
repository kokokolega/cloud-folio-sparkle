
-- Add deleted_at column to notes for soft-delete/trash functionality
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient trash queries
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON public.notes (deleted_at);
