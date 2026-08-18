// api/customer/custom-request.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_WORKER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // 1. JWT Authentication
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing Authorization header.' });
    }

    const token = authHeader.substring(7);
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Server configuration error.' });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired access token.' });
    }

    const authenticatedUserId = userData.user.id;

    // 2. Input Payload Extraction & Validation
    const { requestId, action, note } = req.body || {};

    if (!requestId || typeof requestId !== 'string' || requestId.trim().length === 0) {
      return res.status(422).json({ success: false, error: 'Unprocessable Entity: Valid string requestId is required.' });
    }

    if (!action || (action !== 'accept' && action !== 'reject')) {
      return res.status(422).json({ success: false, error: 'Unprocessable Entity: Action must be either "accept" or "reject".' });
    }

    let sanitizedNote: string | null = null;
    if (note !== undefined && note !== null) {
      if (typeof note !== 'string') {
        return res.status(422).json({ success: false, error: 'Unprocessable Entity: Note must be a text string.' });
      }
      sanitizedNote = note.trim().substring(0, 1000);
    }

    // 3. Request Ownership & Current Status Lookup
    const { data: existingRecord, error: fetchErr } = await supabase
      .from('custom_design_requests')
      .select('id, user_id, reference_number, status, quoted_price, admin_response, customer_response, responded_at')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Database lookup error in customer quotation endpoint:', fetchErr.message);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }

    if (!existingRecord) {
      return res.status(404).json({ success: false, error: 'Custom request not found.' });
    }

    // 4. Ownership Verification Guard
    if (existingRecord.user_id !== authenticatedUserId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Request does not belong to the authenticated user.' });
    }

    const currentStatus = (existingRecord.status || '').toLowerCase();
    const currentResponse = (existingRecord.customer_response || '').toLowerCase();

    // 5. Idempotency Check
    if (action === 'accept' && currentStatus === 'approved' && currentResponse === 'accepted') {
      return res.status(200).json({
        success: true,
        request: {
          id: existingRecord.id,
          reference_number: existingRecord.reference_number,
          status: 'approved',
          customer_response: 'accepted',
          responded_at: existingRecord.responded_at,
          quoted_price: existingRecord.quoted_price,
          admin_response: existingRecord.admin_response
        },
        message: 'Penawaran harga resmi telah Anda setujui.'
      });
    }

    if (action === 'reject' && currentStatus === 'rejected' && currentResponse === 'rejected') {
      return res.status(200).json({
        success: true,
        request: {
          id: existingRecord.id,
          reference_number: existingRecord.reference_number,
          status: 'rejected',
          customer_response: 'rejected',
          responded_at: existingRecord.responded_at,
          quoted_price: existingRecord.quoted_price,
          admin_response: existingRecord.admin_response
        },
        message: 'Penawaran harga resmi telah ditolak.'
      });
    }

    // 6. Quotation Status Guard
    if (currentStatus !== 'quoted') {
      return res.status(409).json({
        success: false,
        error: 'Conflict: Pengajuan tidak berada pada status penawaran.'
      });
    }

    // 7. Atomic Database Update
    const newStatus = action === 'accept' ? 'approved' : 'rejected';
    const newCustomerResponse = action === 'accept' ? 'accepted' : 'rejected';
    const serverTimestamp = new Date().toISOString();

    const { data: updatedRecord, error: updateErr } = await supabase
      .from('custom_design_requests')
      .update({
        status: newStatus,
        customer_response: newCustomerResponse,
        responded_at: serverTimestamp,
        customer_response_note: sanitizedNote,
        updated_at: serverTimestamp
      })
      .eq('id', requestId)
      .eq('user_id', authenticatedUserId)
      .eq('status', 'quoted')
      .select('id, reference_number, status, quoted_price, admin_response, customer_response, responded_at')
      .maybeSingle();

    if (updateErr || !updatedRecord) {
      return res.status(409).json({
        success: false,
        error: 'Conflict: Status pengajuan telah berubah atau diproses oleh pihak lain.'
      });
    }

    const isAccept = action === 'accept';
    return res.status(200).json({
      success: true,
      request: {
        id: updatedRecord.id,
        reference_number: updatedRecord.reference_number,
        status: updatedRecord.status,
        customer_response: updatedRecord.customer_response,
        responded_at: updatedRecord.responded_at,
        quoted_price: updatedRecord.quoted_price,
        admin_response: updatedRecord.admin_response
      },
      message: isAccept ? 'Penawaran harga resmi telah Anda setujui.' : 'Penawaran harga resmi telah ditolak.'
    });

  } catch (error: any) {
    console.error('Error in /api/customer/custom-request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
}
