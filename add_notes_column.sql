-- Add notes column to projects table
-- This fixes the error: "Could not find the 'notes' column of 'projects' in the schema cache"

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Create index for notes column if needed for search performance
CREATE INDEX IF NOT EXISTS idx_projects_notes 
ON public.projects USING gin(to_tsvector('english', notes)); 