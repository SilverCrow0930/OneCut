-- Fix RLS Policies Migration
-- This script fixes the RLS policies to properly work with the public.users table relationship
-- The issue was that policies used auth.uid() directly instead of looking up through public.users.auth_id

-- ===========================
-- 1. Fix Projects RLS Policies  
-- ===========================

DROP POLICY IF EXISTS projects_select_own  ON public.projects;
DROP POLICY IF EXISTS projects_insert_own  ON public.projects;
DROP POLICY IF EXISTS projects_update_own  ON public.projects;
DROP POLICY IF EXISTS projects_delete_own  ON public.projects;

-- SELECT: only your own projects
CREATE POLICY projects_select_own
  ON public.projects
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- INSERT: only create projects under your own user_id
CREATE POLICY projects_insert_own
  ON public.projects
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- UPDATE: only update your own projects
CREATE POLICY projects_update_own
  ON public.projects
  FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- DELETE: only delete your own projects
CREATE POLICY projects_delete_own
  ON public.projects
  FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- ===========================
-- 2. Fix Tracks RLS Policies  
-- ===========================

DROP POLICY IF EXISTS tracks_select_own ON public.tracks;
DROP POLICY IF EXISTS tracks_insert_own ON public.tracks;
DROP POLICY IF EXISTS tracks_update_own ON public.tracks;
DROP POLICY IF EXISTS tracks_delete_own ON public.tracks;

-- SELECT
CREATE POLICY tracks_select_own
  ON public.tracks
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY tracks_insert_own
  ON public.tracks
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY tracks_update_own
  ON public.tracks
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

-- DELETE
CREATE POLICY tracks_delete_own
  ON public.tracks
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ===========================
-- 3. Fix Commands RLS Policies  
-- ===========================

DROP POLICY IF EXISTS commands_select_own ON public.commands;
DROP POLICY IF EXISTS commands_insert_own ON public.commands;
DROP POLICY IF EXISTS commands_update_own ON public.commands;
DROP POLICY IF EXISTS commands_delete_own ON public.commands;

-- SELECT
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

-- UPDATE
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

-- DELETE
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

-- ===========================
-- 4. Fix Clips RLS Policies  
-- ===========================

DROP POLICY IF EXISTS clips_select_own ON public.clips;
DROP POLICY IF EXISTS clips_insert_own ON public.clips;
DROP POLICY IF EXISTS clips_update_own ON public.clips;
DROP POLICY IF EXISTS clips_delete_own ON public.clips;

-- SELECT
CREATE POLICY clips_select_own
  ON public.clips
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.users u ON p.user_id = u.id
      WHERE t.id = public.clips.track_id
        AND u.auth_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY clips_insert_own
  ON public.clips
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.users u ON p.user_id = u.id
      WHERE t.id = public.clips.track_id
        AND u.auth_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY clips_update_own
  ON public.clips
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.users u ON p.user_id = u.id
      WHERE t.id = public.clips.track_id
        AND u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.users u ON p.user_id = u.id
      WHERE t.id = public.clips.track_id
        AND u.auth_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY clips_delete_own
  ON public.clips
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.users u ON p.user_id = u.id
      WHERE t.id = public.clips.track_id
        AND u.auth_id = auth.uid()
    )
  );

-- ===========================
-- 5. Add Performance Indexes  
-- ===========================

-- Index to optimize the new RLS policies
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- Compound index for project lookups through users
CREATE INDEX IF NOT EXISTS idx_projects_user_auth_lookup 
  ON public.projects(user_id) 
  INCLUDE (id);

-- Compound index for tracks through projects
CREATE INDEX IF NOT EXISTS idx_tracks_project_lookup 
  ON public.tracks(project_id) 
  INCLUDE (id);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'RLS policies have been successfully updated to work with public.users table relationship!';
END $$; 