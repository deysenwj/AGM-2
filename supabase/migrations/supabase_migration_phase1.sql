-- Migration: Phase 1 File Upload Attachments
-- Table: public.ai_attachments

CREATE TABLE IF NOT EXISTS public.ai_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.ai_jobs(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,
    user_id UUID,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_attachments_job_id ON public.ai_attachments (job_id);
CREATE INDEX IF NOT EXISTS idx_ai_attachments_conversation_id ON public.ai_attachments (conversation_id);

-- RLS Policies
ALTER TABLE public.ai_attachments ENABLE ROW LEVEL SECURITY;

-- 1. Users can view their own attachments
CREATE POLICY "Users can view their own attachments" ON public.ai_attachments
FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- 2. Anyone/authenticated can insert attachments
CREATE POLICY "Users can insert attachments" ON public.ai_attachments
FOR INSERT WITH CHECK (true);

-- 3. Worker can update attachments
CREATE POLICY "Worker can update attachments" ON public.ai_attachments
FOR UPDATE USING (true);
