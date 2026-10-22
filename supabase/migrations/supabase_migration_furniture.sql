-- Migration: Phase A & B - Furniture Design State & Custom Design Requests
-- Table: public.ai_furniture_designs
CREATE TABLE IF NOT EXISTS public.ai_furniture_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID,
    category TEXT NOT NULL DEFAULT 'meja',
    style TEXT,
    width INTEGER,
    depth INTEGER,
    height INTEGER,
    material TEXT,
    color TEXT,
    finish TEXT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'quoted')),
    estimated_price INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_furniture_designs_conv ON public.ai_furniture_designs (conversation_id);

-- Table: public.custom_design_requests (Admin Handoff)
CREATE TABLE IF NOT EXISTS public.custom_design_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id UUID REFERENCES public.ai_furniture_designs(id) ON DELETE SET NULL,
    conversation_id UUID NOT NULL,
    user_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    customer_notes TEXT,
    design_snapshot JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'revision_requested', 'quoted')),
    admin_response TEXT,
    quoted_price INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_custom_design_req_status ON public.custom_design_requests (status);

-- RLS Policies
ALTER TABLE public.ai_furniture_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_design_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own designs" ON public.ai_furniture_designs FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users insert own designs" ON public.ai_furniture_designs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own designs" ON public.ai_furniture_designs FOR UPDATE USING (true);

CREATE POLICY "Users view own custom requests" ON public.custom_design_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users insert custom requests" ON public.custom_design_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Worker/Admin update custom requests" ON public.custom_design_requests FOR UPDATE USING (true);
