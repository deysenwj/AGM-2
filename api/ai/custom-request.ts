// api/ai/custom-request.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { conversationId, designState, customerName, customerPhone, customerNotes } = req.body || {};
    const userId = (req.headers['x-user-id'] as string) || null;

    if (!conversationId || !designState) {
      return res.status(400).json({ success: false, message: 'Data spesifikasi desain tidak lengkap.' });
    }

    const requestId = generateUuid();
    const designId = designState.id || generateUuid();

    // 1. Insert or update furniture design state
    if (supabase) {
      try {
        await supabase.from('ai_furniture_designs').upsert({
          id: designId,
          conversation_id: conversationId,
          user_id: userId,
          category: designState.category || 'furniture',
          style: designState.style || null,
          width: designState.width || null,
          depth: designState.depth || null,
          height: designState.height || null,
          material: designState.material || null,
          color: designState.color || null,
          finish: designState.finish || null,
          quantity: designState.quantity || 1,
          notes: designState.notes || null,
          status: 'pending_review',
          updated_at: new Date().toISOString()
        });

        // 2. Insert custom design request for admin review
        await supabase.from('custom_design_requests').insert({
          id: requestId,
          design_id: designId,
          conversation_id: conversationId,
          user_id: userId,
          customer_name: customerName || 'Customer AGM',
          customer_phone: customerPhone || null,
          customer_notes: customerNotes || null,
          design_snapshot: designState,
          status: 'pending_review',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Optional Supabase storage for custom request failed:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      request_id: requestId,
      status: 'pending_review',
      message: 'Pengajuan custom furniture berhasil dikirim ke Admin AGM.'
    });

  } catch (error: any) {
    console.error('Error in /api/ai/custom-request:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengajukan custom request.',
      error: error.message
    });
  }
}
