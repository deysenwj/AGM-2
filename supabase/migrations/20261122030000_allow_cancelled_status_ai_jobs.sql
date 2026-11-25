-- Proposal: Expand ai_jobs_status_check to explicitly include 'cancelled'
-- Created: 2026-11-22
-- IMPORTANT: DO NOT execute automatically on production database without manual approval.
-- The application code handles both existing constraint ('failed' with error='job_cancelled_by_user')
-- and this expanded constraint ('cancelled').

ALTER TABLE public.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_status_check;

ALTER TABLE public.ai_jobs
  ADD CONSTRAINT ai_jobs_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

COMMENT ON CONSTRAINT ai_jobs_status_check ON public.ai_jobs IS
  'Allowed lifecycle statuses for AI processing jobs, including user-initiated cancellation.';
