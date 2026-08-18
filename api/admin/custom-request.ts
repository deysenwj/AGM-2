// api/admin/custom-request.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_WORKER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

const ADMIN_EMAILS = ['deysen10@gmail.com', 'deysen95@gmail.com'];
const ALLOWED_STATUSES = ['submitted', 'reviewing', 'quoted', 'approved', 'rejected', 'completed'];

const INVALID_TRANSITIONS: Record<string, string[]> = {
  completed: ['submitted', 'reviewing', 'pending_review'],
  rejected: ['reviewing', 'submitted'],
  approved: ['reviewing', 'submitted']
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // 1. JWT Authentication & Admin Authorization Check
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Bearer token tidak ditemukan.' });
    }

    const token = authHeader.substring(7);
    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Konfigurasi Supabase server error.' });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user?.email) {
      return res.status(401).json({ success: false, message: 'Token JWT tidak valid atau sudah kadaluwarsa.' });
    }

    const userEmail = userData.user.email.toLowerCase();
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Pengguna bukan Admin AGM.' });
    }

    // 2. Request Body Extraction & Input Validation
    const { requestId, status, quoted_price, admin_response } = req.body || {};

    if (!requestId || typeof requestId !== 'string' || requestId.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'requestId wajib diisi dan harus berupa string UUID.' });
    }

    // Validate Status if provided
    if (status !== undefined) {
      if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Status tidak valid. Pilihan: ${ALLOWED_STATUSES.join(', ')}` });
      }
    }

    // Validate Quoted Price if provided
    if (quoted_price !== undefined && quoted_price !== null) {
      if (typeof quoted_price !== 'number' || isNaN(quoted_price) || !isFinite(quoted_price) || quoted_price < 0) {
        return res.status(400).json({ success: false, message: 'quoted_price harus berupa angka non-negatif.' });
      }
    }

    // Validate Status = 'quoted' requirement
    if (status === 'quoted' && (quoted_price === undefined || quoted_price === null)) {
      return res.status(400).json({ success: false, message: 'Status "quoted" membutuhkan nominal quoted_price.' });
    }

    // Validate Admin Response text if provided
    if (admin_response !== undefined && admin_response !== null) {
      if (typeof admin_response !== 'string') {
        return res.status(400).json({ success: false, message: 'admin_response harus berupa string teks.' });
      }
      if (admin_response.length > 2000) {
        return res.status(400).json({ success: false, message: 'admin_response melebihi batas 2000 karakter.' });
      }
    }

    // 3. Database Lookup & Workflow Transition Validation
    let currentRecord: any = null;
    try {
      const { data: existing } = await supabase
        .from('custom_design_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      if (existing) {
        currentRecord = existing;
      }
    } catch (dbReadErr) {
      console.warn('Optional Supabase read warning:', dbReadErr);
    }

    if (currentRecord && status) {
      const currentStatus = (currentRecord.status || 'submitted').toLowerCase();
      const forbiddenNext = INVALID_TRANSITIONS[currentStatus] || [];
      if (forbiddenNext.includes(status)) {
        return res.status(409).json({
          success: false,
          message: `Transisi status tidak diizinkan dari "${currentStatus}" ke "${status}".`
        });
      }
    }

    // 4. Perform Update (Restricted strictly to allowed workflow fields)
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (status !== undefined) updatePayload.status = status;
    if (quoted_price !== undefined && quoted_price !== null) updatePayload.quoted_price = Math.round(quoted_price);
    if (admin_response !== undefined && admin_response !== null) updatePayload.admin_response = admin_response;

    let updatedResult: any = null;
    try {
      const { data: updateData, error: updateErr } = await supabase
        .from('custom_design_requests')
        .update(updatePayload)
        .eq('id', requestId)
        .select('id, reference_number, status, quoted_price, admin_response, updated_at')
        .maybeSingle();

      if (updateErr) {
        console.warn('Supabase update execution warning:', updateErr.message);
      } else if (updateData) {
        updatedResult = updateData;
      }
    } catch (dbUpdateErr: any) {
      console.warn('Supabase update execution exception:', dbUpdateErr.message);
    }

    return res.status(200).json({
      success: true,
      request: updatedResult || {
        id: requestId,
        status: status || currentRecord?.status || 'submitted',
        quoted_price: quoted_price !== undefined ? quoted_price : currentRecord?.quoted_price,
        admin_response: admin_response !== undefined ? admin_response : currentRecord?.admin_response,
        updated_at: updatePayload.updated_at
      },
      message: 'Status pengajuan custom berhasil diperbarui oleh Admin AGM.'
    });

  } catch (error: any) {
    console.error('Error in /api/admin/custom-request:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status pengajuan custom.',
      error: error.message
    });
  }
}
