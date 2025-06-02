-- captions.sql
-- Purpose: Define the public.captions table for AI-generated captions with timing
-- Usage: Run this once in your Supabase SQL editor to set up captions.

-- 1. Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the captions table
CREATE TABLE IF NOT EXISTS public.captions (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid         NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_ms       integer      NOT NULL,  -- Start time in milliseconds
  end_ms         integer      NOT NULL,  -- End time in milliseconds  
  text           text         NOT NULL,  -- Caption text
  confidence     float        NULL,      -- AI confidence score (0-1)
  speaker        text         NULL,      -- Speaker identification (future feature)
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  
  -- Ensure valid timing
  CONSTRAINT valid_timing CHECK (end_ms > start_ms),
  CONSTRAINT positive_timing CHECK (start_ms >= 0)
);

-- 3. Create trigger function to auto-stamp updated_at
CREATE OR REPLACE FUNCTION public.update_captions_timestamp()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_captions_updated ON public.captions;
CREATE TRIGGER trg_captions_updated
  BEFORE UPDATE ON public.captions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_captions_timestamp();

-- 5. Enable Row-Level Security
ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS captions_select_own ON public.captions;
DROP POLICY IF EXISTS captions_insert_own ON public.captions;
DROP POLICY IF EXISTS captions_update_own ON public.captions;
DROP POLICY IF EXISTS captions_delete_own ON public.captions;

-- 7. Create RLS policies through project ownership
-- Users can only access captions for their own projects

-- 7.1 SELECT: only captions for your own projects
CREATE POLICY captions_select_own
  ON public.captions
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- 7.2 INSERT: only create captions for your own projects
CREATE POLICY captions_insert_own
  ON public.captions
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- 7.3 UPDATE: only update captions for your own projects
CREATE POLICY captions_update_own
  ON public.captions
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

-- 7.4 DELETE: only delete captions for your own projects
CREATE POLICY captions_delete_own
  ON public.captions
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_captions_project_id 
  ON public.captions(project_id);

CREATE INDEX IF NOT EXISTS idx_captions_timing 
  ON public.captions(project_id, start_ms, end_ms);

-- 9. Add some helpful comments
COMMENT ON TABLE public.captions IS 'AI-generated captions with precise timing for video projects';
COMMENT ON COLUMN public.captions.start_ms IS 'Caption start time in milliseconds from project beginning';
COMMENT ON COLUMN public.captions.end_ms IS 'Caption end time in milliseconds from project beginning';
COMMENT ON COLUMN public.captions.confidence IS 'AI transcription confidence score between 0 and 1';
COMMENT ON COLUMN public.captions.speaker IS 'Speaker identification for future multi-speaker support'; 