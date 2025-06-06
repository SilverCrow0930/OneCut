-- projects.sql
-- Purpose: Define the public.projects table, auto-stamp updated_at, and RLS policies
-- Usage: Run this once in your Supabase SQL editor to set up projects.

-- 1. Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the projects table (if it doesn't already exist)
CREATE TABLE IF NOT EXISTS public.projects (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text         NOT NULL,
  thumbnail_url  text,
  duration       integer,
  is_public      boolean      NOT NULL DEFAULT false,
  
  -- Async processing fields
  processing_status text       DEFAULT 'idle', -- 'idle', 'queued', 'processing', 'completed', 'failed'
  processing_type   text,                      -- 'quickclips', 'autocut', etc.
  processing_job_id text,                      -- Background job ID for tracking
  processing_progress integer  DEFAULT 0,      -- 0-100 progress percentage
  processing_message text,                     -- Current processing message
  processing_error  text,                      -- Error message if failed
  processing_data   jsonb,                     -- Metadata: content type, format, etc.
  processing_result jsonb,                     -- Final results: clips, analysis, etc.
  processing_started_at timestamptz,           -- When processing began
  processing_completed_at timestamptz,         -- When processing finished
  
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- 3. Create or replace trigger function to auto-stamp updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp()
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
DROP TRIGGER IF EXISTS trg_projects_updated ON public.projects;
CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- 5. Enable Row-Level Security on projects
ALTER TABLE public.projects
  ENABLE ROW LEVEL SECURITY;

-- 6. Drop any existing policies to avoid duplicates
DROP POLICY IF EXISTS projects_select_own  ON public.projects;
DROP POLICY IF EXISTS projects_insert_own  ON public.projects;
DROP POLICY IF EXISTS projects_update_own  ON public.projects;
DROP POLICY IF EXISTS projects_delete_own  ON public.projects;

-- 7. Create RLS policies so users can only access their own projects

-- 7.1 SELECT: only your own projects
CREATE POLICY projects_select_own
  ON public.projects
  FOR SELECT
  USING (user_id = auth.uid());

-- 7.2 INSERT: only create projects under your own user_id
CREATE POLICY projects_insert_own
  ON public.projects
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 7.3 UPDATE: only update your own projects
CREATE POLICY projects_update_own
  ON public.projects
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7.4 DELETE: only delete your own projects
CREATE POLICY projects_delete_own
  ON public.projects
  FOR DELETE
  USING (user_id = auth.uid());

-- 8. Index to speed up lookups by user
CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON public.projects(user_id);

-- 9. Index for processing status queries
CREATE INDEX IF NOT EXISTS idx_projects_processing_status
  ON public.projects(processing_status, processing_type);

-- 10. Index for job ID lookups
CREATE INDEX IF NOT EXISTS idx_projects_job_id
  ON public.projects(processing_job_id);
