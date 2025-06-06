-- commands.sql

-- 1. Ensure pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create commands table
CREATE TABLE IF NOT EXISTS public.commands (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID         NOT NULL
                             REFERENCES public.projects(id)
                             ON DELETE CASCADE,
  seq          BIGINT       NOT NULL,         -- monotonic sequence per project
  type         TEXT         NOT NULL,         -- e.g. 'ADD_CLIP','REMOVE_TRACK', etc.
  payload      JSONB        NOT NULL,         -- command arguments
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (project_id, seq)
);

-- 3. Enable Row-Level Security
ALTER TABLE public.commands
  ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies: only allow users to see/append their own commands

-- SELECT
DROP POLICY IF EXISTS commands_select_own ON public.commands;
CREATE POLICY commands_select_own
  ON public.commands
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- INSERT
DROP POLICY IF EXISTS commands_insert_own ON public.commands;
CREATE POLICY commands_insert_own
  ON public.commands
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- UPDATE (optional: only needed if you ever modify commands)
DROP POLICY IF EXISTS commands_update_own ON public.commands;
CREATE POLICY commands_update_own
  ON public.commands
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- DELETE (optional: only needed if you ever delete commands)
DROP POLICY IF EXISTS commands_delete_own ON public.commands;
CREATE POLICY commands_delete_own
  ON public.commands
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );
