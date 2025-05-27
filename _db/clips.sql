-- clips.sql

-- 1. Ensure UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create clips table
CREATE TABLE IF NOT EXISTS public.clips (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id          UUID          NOT NULL
                                   REFERENCES public.tracks(id)
                                   ON DELETE CASCADE,
  asset_id          UUID          NULL
                                   REFERENCES public.assets(id),
  type              TEXT          NOT NULL
                                   CHECK (type IN ('video','image','audio','text')),
  source_start_ms   INTEGER       NOT NULL,  -- trim start in source (ms)
  source_end_ms     INTEGER       NOT NULL,  -- trim end in source (ms)
  timeline_start_ms INTEGER       NOT NULL,  -- placement start on timeline (ms)
  timeline_end_ms   INTEGER       NOT NULL,  -- placement end on timeline (ms)
  asset_duration_ms INTEGER       NOT NULL,  -- duration of the asset in ms
  volume            NUMERIC(5,2)  NOT NULL DEFAULT 1.00, -- 0.00–1.00 (audio/video)
  speed             NUMERIC(5,2)  NOT NULL DEFAULT 1.00, -- playback rate override
  properties        JSONB         NULL,      -- for video/image clips: crop/scale/etc.
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 3. Trigger: update assets.last_used when a new clip is inserted
CREATE OR REPLACE FUNCTION public.asset_mark_last_used()
  RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.asset_id IS NOT NULL THEN
    UPDATE public.assets
      SET last_used = now()
    WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assets_last_used ON public.clips;
CREATE TRIGGER trg_assets_last_used
  AFTER INSERT ON public.clips
  FOR EACH ROW
  EXECUTE FUNCTION public.asset_mark_last_used();

-- 4. Enable Row-Level Security
ALTER TABLE public.clips
  ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies: only allow users to see/edit clips within their own projects

-- SELECT
DROP POLICY IF EXISTS clips_select_own ON public.clips;
CREATE POLICY clips_select_own
  ON public.clips
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = public.clips.track_id
        AND p.user_id = auth.uid()
    )
  );

-- INSERT
DROP POLICY IF EXISTS clips_insert_own ON public.clips;
CREATE POLICY clips_insert_own
  ON public.clips
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = public.clips.track_id
        AND p.user_id = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS clips_update_own ON public.clips;
CREATE POLICY clips_update_own
  ON public.clips
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = public.clips.track_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = public.clips.track_id
        AND p.user_id = auth.uid()
    )
  );

-- DELETE
DROP POLICY IF EXISTS clips_delete_own ON public.clips;
CREATE POLICY clips_delete_own
  ON public.clips
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tracks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = public.clips.track_id
        AND p.user_id = auth.uid()
    )
  );
