// api/admin/create-transaction-from-custom.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_WORKER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;
const ADMIN_EMAILS = ['deysen10@gmail.com', 'deysen95@gmail.com'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // 1. Bearer JWT Authentication
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing Authorization header.' });
    }

    const token = authHeader.substring(7);
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Server configuration error.' });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user?.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired access token.' });
    }

    // 2. Admin Whitelist Authorization Check
    const userEmail = userData.user.email.toLowerCase();
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
    }

    // 3. Extract & Validate requestId
    const { requestId } = req.body || {};
    if (!requestId || typeof requestId !== 'string' || requestId.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Bad Request: Valid string requestId is required.' });
    }

    const trimmedRequestId = requestId.trim();

    // 4. Fetch Custom Request Record from Database ONLY
    const { data: customReq, error: fetchErr } = await supabase
      .from('custom_design_requests')
      .select('id, reference_number, status, customer_response, quoted_price, customer_name, customer_phone')
      .eq('id', trimmedRequestId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Error fetching custom request for cashier handoff:', fetchErr.message);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }

    if (!customReq) {
      return res.status(404).json({ success: false, error: 'Custom request not found.' });
    }

    // 5. Approved & Accepted Status Guard
    const currentStatus = (customReq.status || '').toLowerCase();
    const currentResponse = (customReq.customer_response || '').toLowerCase();

    if (currentStatus !== 'approved' || currentResponse !== 'accepted') {
      return res.status(409).json({
        success: false,
        error: 'Conflict: Custom request belum siap untuk handoff ke kasir. Status harus approved dan accepted.'
      });
    }

    // 6. Final Price Protection
    const price = Number(customReq.quoted_price);
    if (customReq.quoted_price === null || customReq.quoted_price === undefined || isNaN(price) || price <= 0) {
      return res.status(422).json({
        success: false,
        error: 'Unprocessable Entity: Quoted price custom request tidak valid.'
      });
    }

    const refNum = customReq.reference_number || `AGM-CUSTOM-${customReq.id.substring(0, 6).toUpperCase()}`;
    const customProductId = `CUSTOM:${customReq.id}`;

    // 7. Idempotency Check (Lookup existing transaction using CUSTOM:<requestId>)
    const { data: existingTxList, error: txLookupErr } = await supabase
      .from('transactions')
      .select('id, customer_name, customer_phone, total_price, items, created_at')
      .limit(300);

    if (txLookupErr) {
      console.warn('Error fetching transactions for idempotency check:', txLookupErr.message);
    }

    let existingTx: any = null;
    if (existingTxList && Array.isArray(existingTxList)) {
      existingTx = existingTxList.find((tx: any) => {
        const itemsObj = tx.items;
        if (!itemsObj) return false;
        const list = Array.isArray(itemsObj.list) ? itemsObj.list : (Array.isArray(itemsObj) ? itemsObj : []);
        return list.some((item: any) => item.productId === customProductId);
      });
    }

    if (existingTx) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        transaction: existingTx,
        message: 'Transaksi kasir untuk pengajuan custom ini sudah pernah dibuat sebelumnya.'
      });
    }

    // 8. Generate Transaction Payload (POS Compatible)
    const transactionId = `NOTA-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const itemsPayload = {
      meta: {
        payAmount: 0,
        remainingAmount: price,
        changeAmount: 0,
        notes: `Custom Furniture Order (${refNum})`
      },
      list: [
        {
          productId: customProductId,
          productName: `CUSTOM: ${refNum}`,
          quantity: 1,
          price: price
        }
      ]
    };

    const newTransactionRecord = {
      id: transactionId,
      created_at: nowIso,
      customer_name: customReq.customer_name || 'Customer AGM Custom',
      customer_phone: customReq.customer_phone || null,
      customer_address: null,
      total_price: price,
      items: itemsPayload,
      delivery_fee: 0
    };

    // 9. Atomic Server-side Insert
    const { error: insertErr } = await supabase
      .from('transactions')
      .insert([newTransactionRecord]);

    if (insertErr) {
      console.error('Error inserting cashier transaction:', insertErr.message);
      return res.status(500).json({
        success: false,
        error: 'Gagal membuat transaksi kasir: ' + insertErr.message
      });
    }

    return res.status(200).json({
      success: true,
      alreadyExists: false,
      transaction: newTransactionRecord,
      message: 'Transaksi kasir untuk pengajuan custom furniture berhasil dibuat.'
    });

  } catch (error: any) {
    console.error('Error in /api/admin/create-transaction-from-custom:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
}
