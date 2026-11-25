-- supabase/migrations/supabase_migration_security_hardening.sql
-- Idempotent security hardening for AGM-2.
-- Run via Supabase SQL Editor by database owner. DO NOT run automatically to remote prod.

-- ============================================================================
-- 0. Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ai_jobs table (ensure schema + RLS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT,
  response TEXT,
  design_state JSONB DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT,
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  locked_by UUID,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS response TEXT,
  ADD COLUMN IF NOT EXISTS design_state JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON public.ai_jobs (status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id ON public.ai_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_conversation_id ON public.ai_jobs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_locked_by ON public.ai_jobs (locked_by);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ai_jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Users insert own ai_jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Users update own ai_jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Service role manages ai_jobs" ON public.ai_jobs;

-- Authenticated users see only their own jobs.
CREATE POLICY "Users view own ai_jobs"
ON public.ai_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can insert their own jobs.
CREATE POLICY "Users insert own ai_jobs"
ON public.ai_jobs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update only their own jobs (claim release handled by worker service-role).
CREATE POLICY "Users update own ai_jobs"
ON public.ai_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ai_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_jobs;
  END IF;
END $$;

-- ============================================================================
-- 2. ai_attachments RLS hardening
-- ============================================================================
ALTER TABLE public.ai_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own attachments" ON public.ai_attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON public.ai_attachments;
DROP POLICY IF EXISTS "Worker can update attachments" ON public.ai_attachments;

CREATE POLICY "Users can view their own attachments"
ON public.ai_attachments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert attachments"
ON public.ai_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own attachments"
ON public.ai_attachments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. custom_design_requests RLS hardening (REMOVE public read)
-- ============================================================================
ALTER TABLE public.custom_design_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin inbox can read custom design requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Users view own custom requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Users insert custom requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Worker/Admin update custom requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Authenticated update own customer response" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Public insert custom design requests" ON public.custom_design_requests;

CREATE POLICY "Users insert custom design requests"
ON public.custom_design_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users view own custom requests"
ON public.custom_design_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated update own customer response"
ON public.custom_design_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. ai_furniture_designs RLS hardening
-- ============================================================================
ALTER TABLE public.ai_furniture_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert ai furniture designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Authenticated view own ai furniture designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Authenticated update own ai furniture designs" ON public.ai_furniture_designs;

CREATE POLICY "Users insert ai furniture designs"
ON public.ai_furniture_designs
FOR INSERT
TO anon, authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users view own ai furniture designs"
ON public.ai_furniture_designs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users update own ai furniture designs"
ON public.ai_furniture_designs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- 5. Atomic claim RPC for worker
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_ai_job()
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  user_id UUID,
  message TEXT,
  design_state JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
BEGIN
  UPDATE public.ai_jobs
  SET status = 'processing',
      processing_started_at = timezone('utc'::text, now()),
      attempt_count = attempt_count + 1,
      locked_by = NULL,
      updated_at = timezone('utc'::text, now())
  WHERE id IN (
    SELECT id FROM public.ai_jobs
    WHERE status = 'pending'
      AND attempt_count < max_attempts
      AND (locked_by IS NULL OR processing_started_at IS NULL
           OR processing_started_at < timezone('utc'::text, now()) - interval '10 minutes')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id, conversation_id, user_id, message, design_state INTO rec;

  IF FOUND THEN
    id := rec.id;
    conversation_id := rec.conversation_id;
    user_id := rec.user_id;
    message := rec.message;
    design_state := rec.design_state;
    RETURN NEXT;
  END IF;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ai_job() TO authenticated;

COMMENT ON FUNCTION public.claim_ai_job() IS
  'Atomically claims one pending ai_job for processing. Uses FOR UPDATE SKIP LOCKED and status check to prevent double claim. Sets processing_started_at and increments attempt_count.';
