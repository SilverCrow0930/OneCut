-- Add 'sfx' as a valid track type
ALTER TABLE public.tracks
  DROP CONSTRAINT tracks_type_check;

ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_type_check
  CHECK (type IN ('video', 'audio', 'text', 'caption', 'sfx')); 