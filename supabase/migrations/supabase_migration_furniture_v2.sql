-- Migration Phase 1: Add design_state JSONB column to ai_jobs (backward-compatible)
ALTER TABLE public.ai_jobs 
ADD COLUMN IF NOT EXISTS design_state JSONB DEFAULT NULL;
