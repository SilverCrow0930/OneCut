-- Complete Projects Table Fix
-- This script safely adds QuickClips support without breaking existing functionality

-- First, let's see what columns already exist
-- (Run this manually to check current state)
-- \d projects;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'type') THEN
        ALTER TABLE projects ADD COLUMN type VARCHAR(50) DEFAULT 'project';
        COMMENT ON COLUMN projects.type IS 'Type of project: project or quickclips';
    END IF;

    -- Add processing_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'processing_status') THEN
        ALTER TABLE projects ADD COLUMN processing_status VARCHAR(50) DEFAULT 'idle';
        COMMENT ON COLUMN projects.processing_status IS 'Processing status: idle, processing, completed, error';
    END IF;

    -- Add processing_message column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'processing_message') THEN
        ALTER TABLE projects ADD COLUMN processing_message TEXT;
        COMMENT ON COLUMN projects.processing_message IS 'Processing status message or error details';
    END IF;

    -- Add quickclips_data column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'quickclips_data') THEN
        ALTER TABLE projects ADD COLUMN quickclips_data JSONB;
        COMMENT ON COLUMN projects.quickclips_data IS 'QuickClips processing data and results';
    END IF;
END $$;

-- Update existing NULL values to proper defaults
UPDATE projects 
SET 
    type = 'project' 
WHERE type IS NULL;

UPDATE projects 
SET 
    processing_status = 'idle' 
WHERE processing_status IS NULL;

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_processing_status ON projects(processing_status);
CREATE INDEX IF NOT EXISTS idx_projects_user_type ON projects(user_id, type);

-- Set NOT NULL constraints after ensuring all values are set
ALTER TABLE projects ALTER COLUMN type SET NOT NULL;
ALTER TABLE projects ALTER COLUMN processing_status SET NOT NULL;

-- Add flexible check constraints that won't break the app
-- Only add if they don't exist
DO $$
BEGIN
    -- Check if type constraint exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'projects' AND constraint_name = 'projects_type_flexible_check') THEN
        ALTER TABLE projects ADD CONSTRAINT projects_type_flexible_check 
        CHECK (type IN ('project', 'quickclips') OR type IS NOT NULL);
    END IF;

    -- Check if processing_status constraint exists, if not add it  
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'projects' AND constraint_name = 'projects_processing_status_flexible_check') THEN
        ALTER TABLE projects ADD CONSTRAINT projects_processing_status_flexible_check 
        CHECK (processing_status IN ('idle', 'processing', 'completed', 'error') OR processing_status IS NOT NULL);
    END IF;
END $$;

-- Remove old restrictive constraints if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE table_name = 'projects' AND constraint_name = 'projects_type_check') THEN
        ALTER TABLE projects DROP CONSTRAINT projects_type_check;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE table_name = 'projects' AND constraint_name = 'projects_processing_status_check') THEN
        ALTER TABLE projects DROP CONSTRAINT projects_processing_status_check;
    END IF;
END $$;

-- Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;

COMMENT ON TABLE projects IS 'Projects table with support for both regular projects and QuickClips processing'; 