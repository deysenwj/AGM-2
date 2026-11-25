-- Phase 1: Add capability-token hash for guest-safe job polling.
-- This migration intentionally does not change grants or RLS.

ALTER TABLE public.ai_jobs
ADD COLUMN IF NOT EXISTS access_token_hash text;

COMMENT ON COLUMN public.ai_jobs.access_token_hash IS
' SHA-256 hash of the temporary capability token used by the job-status API. Raw tokens must never be stored.';
