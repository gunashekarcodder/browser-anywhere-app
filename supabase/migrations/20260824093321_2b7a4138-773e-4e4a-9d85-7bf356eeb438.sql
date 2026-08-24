ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS incidents_deleted_at_idx ON public.incidents (deleted_at);