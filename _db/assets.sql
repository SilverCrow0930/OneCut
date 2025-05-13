-- assets.sql
-- Purpose: Define the public.assets table, auto-stamp last_used, and RLS policies
-- Usage: Run this once in your Supabase SQL editor to set up assets.

-- 1) Enable UUID gen
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         text         NOT NULL,
  mime_type    text         NOT NULL,
  duration     numeric(10,3) NULL,         -- seconds; null for images
  object_key   text         NOT NULL,      -- e.g. "userId/uuid.mp4"
  created_at   timestamptz  NOT NULL DEFAULT now(),
  last_used    timestamptz  NULL
);

-- 3) Trigger to stamp last_used when an asset is placed in timeline_entries
CREATE OR REPLACE FUNCTION public.asset_mark_last_used()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.assets
    SET last_used = now()
  WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$$;

-- 4) Enable Row Level Security
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 5) RLS policies: users only see/manipulate their own assets
DROP POLICY IF EXISTS assets_select_own ON public.assets;
DROP POLICY IF EXISTS assets_insert_own ON public.assets;
DROP POLICY IF EXISTS assets_update_own ON public.assets;
DROP POLICY IF EXISTS assets_delete_own ON public.assets;

CREATE POLICY assets_select_own
  ON public.assets
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY assets_insert_own
  ON public.assets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY assets_update_own
  ON public.assets
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY assets_delete_own
  ON public.assets
  FOR DELETE
  USING (user_id = auth.uid());
