-- EMERGENCY FIX: Remove problematic CHECK constraints from projects table
-- Run this immediately in your Supabase SQL editor to fix the editor access issue

-- Drop the problematic CHECK constraints
DO $$
BEGIN
  -- Remove type constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'projects_type_check' 
             AND table_name = 'projects') THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_type_check;
    RAISE NOTICE 'Dropped projects_type_check constraint';
  END IF;
  
  -- Remove processing_status constraint if it exists  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'projects_processing_status_check' 
             AND table_name = 'projects') THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_processing_status_check;
    RAISE NOTICE 'Dropped projects_processing_status_check constraint';
  END IF;
  
  -- Also check for any other similar constraints
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE table_name = 'projects' 
             AND constraint_type = 'CHECK') THEN
    RAISE NOTICE 'Warning: Other CHECK constraints still exist on projects table';
  ELSE
    RAISE NOTICE 'All CHECK constraints successfully removed from projects table';
  END IF;
END $$; 