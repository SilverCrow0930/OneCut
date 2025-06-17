-- video_analyses.sql
-- Purpose: Define the public.video_analyses table for storing AI video analysis results
-- Usage: Run this once in your Supabase SQL editor to set up video analyses storage.

-- 1. Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the video_analyses table
CREATE TABLE IF NOT EXISTS public.video_analyses (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid         NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  analysis_data  jsonb        NOT NULL,      -- The complete semantic analysis JSON
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- 3. Create or replace trigger function to auto-stamp updated_at
CREATE OR REPLACE FUNCTION public.update_video_analyses_timestamp()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Drop old trigger (if any) and attach the new one
DROP TRIGGER IF EXISTS trg_video_analyses_updated ON public.video_analyses;
CREATE TRIGGER trg_video_analyses_updated
  BEFORE UPDATE ON public.video_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_analyses_timestamp();

-- 5. Enable Row-Level Security
ALTER TABLE public.video_analyses
  ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies: only allow users to see/edit their own video analyses

-- SELECT
DROP POLICY IF EXISTS video_analyses_select_own ON public.video_analyses;
CREATE POLICY video_analyses_select_own
  ON public.video_analyses
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- INSERT
DROP POLICY IF EXISTS video_analyses_insert_own ON public.video_analyses;
CREATE POLICY video_analyses_insert_own
  ON public.video_analyses
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS video_analyses_update_own ON public.video_analyses;
CREATE POLICY video_analyses_update_own
  ON public.video_analyses
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
DROP POLICY IF EXISTS video_analyses_delete_own ON public.video_analyses;
CREATE POLICY video_analyses_delete_own
  ON public.video_analyses
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_analyses_project_id ON public.video_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_created_at ON public.video_analyses(created_at);

-- Verification
SELECT 'Video analyses table created successfully!' as result; 