-- Migration: Custom Design Requests from AGM Assistant
-- Safe to run multiple times in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_furniture_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'furniture',
    style TEXT,
    width INTEGER,
    depth INTEGER,
    height INTEGER,
    material TEXT,
    color TEXT,
    finish TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    estimated_price INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.ai_furniture_designs
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'furniture',
    ADD COLUMN IF NOT EXISTS style TEXT,
    ADD COLUMN IF NOT EXISTS width INTEGER,
    ADD COLUMN IF NOT EXISTS depth INTEGER,
    ADD COLUMN IF NOT EXISTS height INTEGER,
    ADD COLUMN IF NOT EXISTS material TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS finish TEXT,
    ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS estimated_price INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_furniture_designs_status_check'
          AND conrelid = 'public.ai_furniture_designs'::regclass
    ) THEN
        ALTER TABLE public.ai_furniture_designs
        ADD CONSTRAINT ai_furniture_designs_status_check
        CHECK (status IN ('draft', 'submitted', 'pending_review', 'reviewing', 'quoted', 'approved', 'rejected', 'completed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_furniture_designs_conversation_id ON public.ai_furniture_designs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_furniture_designs_user_id ON public.ai_furniture_designs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_furniture_designs_status ON public.ai_furniture_designs (status);

CREATE TABLE IF NOT EXISTS public.custom_design_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id UUID REFERENCES public.ai_furniture_designs(id) ON DELETE SET NULL,
    conversation_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_notes TEXT,
    design_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    reference_number TEXT UNIQUE,
    visualization_url TEXT,
    reference_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'submitted',
    quoted_price INTEGER,
    admin_response TEXT,
    customer_response TEXT,
    customer_response_note TEXT,
    customer_responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.custom_design_requests
    ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES public.ai_furniture_designs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS customer_notes TEXT,
    ADD COLUMN IF NOT EXISTS design_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS reference_number TEXT,
    ADD COLUMN IF NOT EXISTS visualization_url TEXT,
    ADD COLUMN IF NOT EXISTS reference_attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted',
    ADD COLUMN IF NOT EXISTS quoted_price INTEGER,
    ADD COLUMN IF NOT EXISTS admin_response TEXT,
    ADD COLUMN IF NOT EXISTS customer_response TEXT,
    ADD COLUMN IF NOT EXISTS customer_response_note TEXT,
    ADD COLUMN IF NOT EXISTS customer_responded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

UPDATE public.custom_design_requests
SET status = 'submitted'
WHERE status = 'pending_review';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_design_requests_status_check'
          AND conrelid = 'public.custom_design_requests'::regclass
    ) THEN
        ALTER TABLE public.custom_design_requests
        ADD CONSTRAINT custom_design_requests_status_check
        CHECK (status IN ('submitted', 'pending_review', 'reviewing', 'quoted', 'approved', 'rejected', 'revision_requested', 'completed'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_design_requests_customer_response_check'
          AND conrelid = 'public.custom_design_requests'::regclass
    ) THEN
        ALTER TABLE public.custom_design_requests
        ADD CONSTRAINT custom_design_requests_customer_response_check
        CHECK (customer_response IS NULL OR customer_response IN ('accepted', 'rejected'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_design_requests_quoted_price_check'
          AND conrelid = 'public.custom_design_requests'::regclass
    ) THEN
        ALTER TABLE public.custom_design_requests
        ADD CONSTRAINT custom_design_requests_quoted_price_check
        CHECK (quoted_price IS NULL OR quoted_price >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_design_requests_reference_number_key'
          AND conrelid = 'public.custom_design_requests'::regclass
    ) THEN
        ALTER TABLE public.custom_design_requests
        ADD CONSTRAINT custom_design_requests_reference_number_key UNIQUE (reference_number);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_design_requests_customer_name_required'
          AND conrelid = 'public.custom_design_requests'::regclass
    ) THEN
        ALTER TABLE public.custom_design_requests
        ADD CONSTRAINT custom_design_requests_customer_name_required
        CHECK (length(trim(coalesce(customer_name, ''))) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_design_requests_customer_phone_required'
          AND conrelid = 'public.custom_design_requests'::regclass
    ) THEN
        ALTER TABLE public.custom_design_requests
        ADD CONSTRAINT custom_design_requests_customer_phone_required
        CHECK (customer_phone ~ '^[+0-9][0-9-]{7,18}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custom_design_requests_conversation_id ON public.custom_design_requests (conversation_id);
CREATE INDEX IF NOT EXISTS idx_custom_design_requests_user_id ON public.custom_design_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_custom_design_requests_status ON public.custom_design_requests (status);
CREATE INDEX IF NOT EXISTS idx_custom_design_requests_reference_number ON public.custom_design_requests (reference_number);
CREATE INDEX IF NOT EXISTS idx_custom_design_requests_created_at ON public.custom_design_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_design_requests_design_snapshot_gin ON public.custom_design_requests USING GIN (design_snapshot);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_furniture_designs_updated_at ON public.ai_furniture_designs;
CREATE TRIGGER trg_ai_furniture_designs_updated_at
BEFORE UPDATE ON public.ai_furniture_designs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_custom_design_requests_updated_at ON public.custom_design_requests;
CREATE TRIGGER trg_custom_design_requests_updated_at
BEFORE UPDATE ON public.custom_design_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_furniture_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_design_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Users insert own designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Users update own designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Public insert ai furniture designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Authenticated view own ai furniture designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Authenticated update own ai furniture designs" ON public.ai_furniture_designs;
DROP POLICY IF EXISTS "Users view own custom requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Users insert custom requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Worker/Admin update custom requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Public insert custom design requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Authenticated view own custom design requests" ON public.custom_design_requests;
DROP POLICY IF EXISTS "Authenticated update own customer response" ON public.custom_design_requests;

CREATE POLICY "Public insert ai furniture designs"
ON public.ai_furniture_designs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated view own ai furniture designs"
ON public.ai_furniture_designs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Authenticated update own ai furniture designs"
ON public.ai_furniture_designs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Public insert custom design requests"
ON public.custom_design_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin inbox can read custom design requests" ON public.custom_design_requests;

CREATE POLICY "Admin inbox can read custom design requests"
ON public.custom_design_requests
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated update own customer response"
ON public.custom_design_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_design_requests;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_furniture_designs;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;
