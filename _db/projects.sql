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
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  -- QuickClips fields
  type           text         DEFAULT 'project',
  processing_status text      DEFAULT 'idle',
  processing_message text,
  quickclips_data jsonb
);

-- Add new columns to existing table if they don't exist (NO CHECK CONSTRAINTS)
DO $$ 
BEGIN
  -- Add type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'type') THEN
    ALTER TABLE public.projects ADD COLUMN type text DEFAULT 'project';
  END IF;

  -- Add processing_status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'processing_status') THEN
    ALTER TABLE public.projects ADD COLUMN processing_status text DEFAULT 'idle';
  END IF;

  -- Add processing_message column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'processing_message') THEN
    ALTER TABLE public.projects ADD COLUMN processing_message text;
  END IF;

  -- Add quickclips_data column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'quickclips_data') THEN
    ALTER TABLE public.projects ADD COLUMN quickclips_data jsonb;
  END IF;
END $$;

-- Drop any existing CHECK constraints that might be causing issues
DO $$
BEGIN
  -- Remove type constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_type_check') THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_type_check;
  END IF;
  
  -- Remove processing_status constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_processing_status_check') THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_processing_status_check;
  END IF;
END $$;

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
  ON public.projects(processing_status) WHERE processing_status IS NOT NULL;
