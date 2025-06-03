-- Apply Caption Support to Lemona Database
-- This script updates the database constraints to allow 'caption' type for tracks and clips

-- Step 1: Update tracks table to support caption type
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tracks_type_check' 
        AND table_name = 'tracks'
    ) THEN
        ALTER TABLE public.tracks DROP CONSTRAINT tracks_type_check;
    END IF;
    
    -- Add new constraint with caption support
    ALTER TABLE public.tracks 
    ADD CONSTRAINT tracks_type_check 
    CHECK (type IN ('video','audio','text','caption'));
    
    RAISE NOTICE 'Tracks table updated to support caption type';
END $$;

-- Step 2: Update clips table to support caption type  
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'clips_type_check' 
        AND table_name = 'clips'
    ) THEN
        ALTER TABLE public.clips DROP CONSTRAINT clips_type_check;
    END IF;
    
    -- Add new constraint with caption support
    ALTER TABLE public.clips 
    ADD CONSTRAINT clips_type_check 
    CHECK (type IN ('video','image','audio','text','caption'));
    
    RAISE NOTICE 'Clips table updated to support caption type';
END $$;

-- Verification queries
SELECT 'Caption support successfully applied!' as result;
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name IN ('tracks_type_check', 'clips_type_check'); 