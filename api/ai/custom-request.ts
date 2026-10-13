// api/ai/custom-request.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServerKey =
  process.env.SUPABASE_WORKER_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseServerKey) ? createClient(supabaseUrl, supabaseServerKey) : null;

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const generateReferenceNumber = () => {
  const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
  return `AGM-CUSTOM-${randomSixDigits}`;
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
    const { conversationId, designState, customerName, customerPhone, customerNotes, attachmentSnapshot } = req.body || {};
    
    // Server-side Authorization Token Extraction
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ') && supabase) {
      try {
        const token = authHeader.substring(7);
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user?.id) {
          authenticatedUserId = userData.user.id;
        }
      } catch (authErr) {
        console.warn('Supabase JWT verification failed:', authErr);
      }
    }

    // Fallback: If unauthenticated anonymous request, sanitize user ID or assign null
    const finalUserId = authenticatedUserId || null;

    if (!conversationId || !designState || !designState.category) {
      return res.status(400).json({ success: false, message: 'Data spesifikasi desain tidak lengkap atau kategori belum ditentukan.' });
    }

    const normalizedCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
    const normalizedCustomerPhone = typeof customerPhone === 'string' ? customerPhone.trim().replace(/\s+/g, '') : '';
    const normalizedCustomerNotes = typeof customerNotes === 'string' ? customerNotes.trim() : null;

    if (!normalizedCustomerName) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi untuk mengajukan custom request.' });
    }

    if (!normalizedCustomerPhone) {
      return res.status(400).json({ success: false, message: 'Nomor HP pelanggan wajib diisi untuk mengajukan custom request.' });
    }

    if (!/^[+0-9][0-9-]{7,18}$/.test(normalizedCustomerPhone)) {
      return res.status(400).json({ success: false, message: 'Nomor HP pelanggan tidak valid.' });
    }

    const versionNum = designState.version || 1;
    const visualizationUrl = designState.visualization?.imageUrl || null;
    const immutableSnapshot = JSON.parse(JSON.stringify(designState));

    // Duplicate Submission Guard: Check existing request for same conversation + version
    if (supabase) {
      try {
        const { data: existingRows } = await supabase
          .from('custom_design_requests')
          .select('id, reference_number, status, design_snapshot, created_at')
          .eq('conversation_id', conversationId);

        const existing = (existingRows || []).find((r: any) => {
          const snapshotVersion = r.design_snapshot?.version ?? 1;
          return String(snapshotVersion) === String(versionNum);
        });

        if (existing) {
          const refNum = existing.reference_number || `AGM-CUSTOM-${existing.id.substring(0, 6).toUpperCase()}`;
          return res.status(200).json({
            success: true,
            duplicate: true,
            request_id: existing.id,
            reference_number: refNum,
            status: existing.status || 'submitted',
            visualization_url: existing.design_snapshot?.visualization?.imageUrl || null,
            message: 'Spesifikasi versi ini sudah pernah diajukan sebelumnya.'
          });
        }
      } catch (err) {
        console.warn('Duplicate check lookup warning:', err);
      }
    }

    const requestId = generateUuid();
    const designId = designState.id || generateUuid();
    const refNumber = generateReferenceNumber();

    // Insert immutable design request into Supabase inbox.
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Konfigurasi Supabase server belum tersedia. Custom request tidak dapat disimpan ke inbox admin.'
      });
    }

    try {
      const { error: designErr } = await supabase.from('ai_furniture_designs').upsert({
        id: designId,
        conversation_id: conversationId,
        user_id: finalUserId,
        category: designState.category || 'furniture',
        style: designState.style || null,
        width: designState.dimensions?.width ?? designState.width ?? null,
        depth: designState.dimensions?.depth ?? designState.depth ?? null,
        height: designState.dimensions?.height ?? designState.height ?? null,
        material: designState.material || null,
        color: designState.color || null,
        finish: designState.finish || null,
        quantity: designState.quantity || 1,
        notes: designState.notes || null,
        status: 'submitted',
        updated_at: new Date().toISOString()
      });

      if (designErr) {
        console.error('Supabase ai_furniture_designs upsert error:', designErr.message);
        return res.status(500).json({
          success: false,
          message: 'Gagal menyimpan data desain custom ke Supabase.',
          error: designErr.message
        });
      }

      const { error: insertErr } = await supabase.from('custom_design_requests').insert({
        id: requestId,
        design_id: designId,
        conversation_id: conversationId,
        user_id: finalUserId,
        customer_name: normalizedCustomerName,
        customer_phone: normalizedCustomerPhone,
        customer_notes: normalizedCustomerNotes,
        design_snapshot: immutableSnapshot,
        reference_number: refNumber,
        visualization_url: visualizationUrl,
        reference_attachments: attachmentSnapshot || [],
        status: 'submitted',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (insertErr) {
        console.error('Supabase custom_design_requests insert error:', insertErr.message);
        return res.status(500).json({
          success: false,
          message: 'Gagal menyimpan pengajuan ke inbox admin custom request.',
          error: insertErr.message
        });
      }
    } catch (dbErr: any) {
      console.error('Supabase storage exception for custom request:', dbErr.message);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat menyimpan custom request ke Supabase.',
        error: dbErr.message
      });
    }

    return res.status(200).json({
      success: true,
      request_id: requestId,
      reference_number: refNumber,
      status: 'submitted',
      visualization_url: visualizationUrl,
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
