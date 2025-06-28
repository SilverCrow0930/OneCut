-- add_last_opened_column.sql
-- Purpose: Add last_opened column to projects table for sorting by recent access
-- Usage: Run this in your Supabase SQL editor

-- Add last_opened column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_opened timestamptz;

-- Create index for sorting by last_opened
CREATE INDEX IF NOT EXISTS idx_projects_last_opened
  ON public.projects(last_opened DESC NULLS LAST, created_at DESC);

-- Create index for user + last_opened sorting (more efficient for user-specific queries)
CREATE INDEX IF NOT EXISTS idx_projects_user_last_opened
  ON public.projects(user_id, last_opened DESC NULLS LAST, created_at DESC); 