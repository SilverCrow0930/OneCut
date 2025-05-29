-- 1. Ensure UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create tracks table
CREATE TABLE IF NOT EXISTS public.tracks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL
                             REFERENCES public.projects(id)
                             ON DELETE CASCADE,
  "index"      INTEGER     NOT NULL,  -- layer order (0 = bottom)
  type         TEXT        NOT NULL
                             CHECK (type IN ('video','audio','text')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row-Level Security
ALTER TABLE public.tracks
  ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies: only allow users to see/edit their own tracks

-- SELECT
DROP POLICY IF EXISTS tracks_select_own ON public.tracks;
CREATE POLICY tracks_select_own
  ON public.tracks
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- INSERT
DROP POLICY IF EXISTS tracks_insert_own ON public.tracks;
CREATE POLICY tracks_insert_own
  ON public.tracks
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS tracks_update_own ON public.tracks;
CREATE POLICY tracks_update_own
  ON public.tracks
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- DELETE
DROP POLICY IF EXISTS tracks_delete_own ON public.tracks;
CREATE POLICY tracks_delete_own
  ON public.tracks
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );
