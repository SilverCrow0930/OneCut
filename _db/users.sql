-- users.sql
-- Purpose: Recreate public.users table cleanly, remove old triggers/functions,
--          enable RLS, and define row-level policies. No triggers for seeding.

-- 1) Drop any old trigger functions & triggers
DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TRIGGER IF EXISTS trg_users_updated ON public.users;
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;

-- 2) Drop the users table entirely (start fresh)
DROP TABLE IF EXISTS public.users CASCADE;

-- 3) Ensure pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4) Recreate the users table
CREATE TABLE public.users (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       uuid         NOT NULL UNIQUE REFERENCES auth.users(id),
  email         text         NOT NULL UNIQUE,
  full_name     text,
  avatar_url    text,
  last_login_at timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- 5) Enable Row-Level Security
ALTER TABLE public.users
  ENABLE ROW LEVEL SECURITY;

-- 6) Drop any old policies (cleanup)
DROP POLICY IF EXISTS users_select_own  ON public.users;
DROP POLICY IF EXISTS users_insert_own  ON public.users;
DROP POLICY IF EXISTS users_update_own  ON public.users;
DROP POLICY IF EXISTS users_delete_own  ON public.users;

-- 7) Create RLS policies so each user can only touch their own row

-- 7.1 SELECT: only your own profile
CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  USING (auth_id = auth.uid());

-- 7.2 INSERT: only rows with your auth_id (for manual inserts)
CREATE POLICY users_insert_own
  ON public.users
  FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- 7.3 UPDATE: only your own profile
CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- 7.4 DELETE: only your own profile
CREATE POLICY users_delete_own
  ON public.users
  FOR DELETE
  USING (auth_id = auth.uid());
