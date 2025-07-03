-- add_aspect_ratio_column.sql
-- Purpose: Add aspect_ratio column to projects table
-- Usage: Run this in your Supabase SQL editor

-- 1. Add aspect_ratio column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT 'horizontal';

-- 2. Update existing projects to use horizontal aspect ratio
UPDATE public.projects
SET aspect_ratio = 'horizontal'
WHERE aspect_ratio IS NULL;

-- 3. Add comment to explain the column
COMMENT ON COLUMN public.projects.aspect_ratio IS 'Video aspect ratio: horizontal (16:9) or vertical (9:16)';

-- 4. Add check constraint to ensure valid values
ALTER TABLE public.projects
ADD CONSTRAINT check_aspect_ratio CHECK (aspect_ratio IN ('horizontal', 'vertical')); 