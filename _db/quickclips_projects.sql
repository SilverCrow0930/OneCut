-- quickclips_projects.sql
-- Purpose: Extend projects table to support QuickClips processing status and results
-- Usage: Run this in your Supabase SQL editor to add QuickClips support

-- 1. Add new columns to projects table for QuickClips
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'timeline' CHECK (project_type IN ('timeline', 'quickclips')),
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed' CHECK (processing_status IN ('processing', 'completed', 'error', 'pending')),
ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 100 CHECK (processing_progress >= 0 AND processing_progress <= 100),
ADD COLUMN IF NOT EXISTS processing_message TEXT,
ADD COLUMN IF NOT EXISTS original_file_uri TEXT,
ADD COLUMN IF NOT EXISTS content_type TEXT,
ADD COLUMN IF NOT EXISTS target_duration INTEGER,
ADD COLUMN IF NOT EXISTS video_format TEXT CHECK (video_format IN ('short_vertical', 'long_horizontal')),
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS quickclips_data JSONB; -- Store generated clips data

-- 2. Create index for faster queries on processing status
CREATE INDEX IF NOT EXISTS idx_projects_processing_status 
ON public.projects(processing_status, project_type);

-- 3. Create index for faster queries by project type
CREATE INDEX IF NOT EXISTS idx_projects_type 
ON public.projects(project_type, user_id);

-- 4. Create a function to update processing status
CREATE OR REPLACE FUNCTION public.update_project_processing_status(
    project_id_param UUID,
    status_param TEXT,
    progress_param INTEGER DEFAULT NULL,
    message_param TEXT DEFAULT NULL,
    error_param TEXT DEFAULT NULL,
    clips_data_param JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.projects 
    SET 
        processing_status = status_param,
        processing_progress = COALESCE(progress_param, processing_progress),
        processing_message = COALESCE(message_param, processing_message),
        error_message = CASE 
            WHEN status_param = 'error' THEN COALESCE(error_param, error_message)
            ELSE NULL 
        END,
        quickclips_data = COALESCE(clips_data_param, quickclips_data),
        updated_at = now()
    WHERE id = project_id_param;
END;
$$;

-- 5. Create a function to get user's email for notifications
CREATE OR REPLACE FUNCTION public.get_user_email_by_project(project_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT u.email INTO user_email
    FROM public.projects p
    JOIN public.users pu ON p.user_id = pu.id
    JOIN auth.users u ON pu.auth_id = u.id
    WHERE p.id = project_id_param;
    
    RETURN user_email;
END;
$$;

-- 6. Create a view for active processing projects (for monitoring)
CREATE OR REPLACE VIEW public.active_processing_projects AS
SELECT 
    p.id,
    p.name,
    p.processing_status,
    p.processing_progress,
    p.processing_message,
    p.created_at,
    p.updated_at,
    p.user_id,
    u.email as user_email
FROM public.projects p
JOIN public.users pu ON p.user_id = pu.id
JOIN auth.users u ON pu.auth_id = u.id
WHERE p.project_type = 'quickclips' 
AND p.processing_status IN ('processing', 'pending');

-- 7. Add RLS policy for the new function (allow users to update their own projects)
CREATE OR REPLACE FUNCTION public.user_can_update_project(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    project_user_id UUID;
BEGIN
    SELECT user_id INTO project_user_id
    FROM public.projects 
    WHERE id = project_id_param;
    
    RETURN project_user_id IN (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
    );
END;
$$; 