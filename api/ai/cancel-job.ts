import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed'
    });
  }

  const { job_id: jobId, access_token: accessToken } = req.body || {};

  if (
    typeof jobId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId) ||
    typeof accessToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(accessToken)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid job credentials.'
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';

  const supabaseKey =
    process.env.SUPABASE_WORKER_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Cancel job API: server Supabase configuration missing.');
    return res.status(500).json({
      success: false,
      message: 'Cancellation service unavailable.'
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('ai_jobs')
      .select('status, error, created_at, access_token_hash')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error('Cancel job lookup failed:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to check job status for cancellation.'
      });
    }

    if (!job || typeof job.access_token_hash !== 'string') {
      return res.status(404).json({
        success: false,
        message: 'Job not found or access expired.'
      });
    }

    const createdAt = new Date(job.created_at).getTime();

    if (
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > TOKEN_TTL_MS ||
      createdAt > Date.now() + 60_000
    ) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or access expired.'
      });
    }

    const suppliedHash = createHash('sha256')
      .update(accessToken)
      .digest();

    let storedHash: Buffer;

    try {
      storedHash = Buffer.from(job.access_token_hash, 'hex');
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Job not found or access expired.'
      });
    }

    if (
      storedHash.length !== suppliedHash.length ||
      !timingSafeEqual(storedHash, suppliedHash)
    ) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or access expired.'
      });
    }

    // Already completed: cannot cancel
    if (job.status === 'completed') {
      return res.status(200).json({
        success: false,
        status: 'completed',
        message: 'Job sudah selesai diproses.'
      });
    }

    // Already cancelled
    if (
      job.status === 'cancelled' ||
      (job.status === 'failed' && (job as any).error === 'job_cancelled_by_user')
    ) {
      return res.status(200).json({
        success: true,
        status: 'cancelled',
        message: 'Job sudah dibatalkan sebelumnya.'
      });
    }

    // Only cancel pending or processing jobs
    // Attempt updating to 'cancelled'; fallback to 'failed' + error if DB constraint restricts status values
    let updateResult = await supabase
      .from('ai_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .in('status', ['pending', 'processing'])
      .select('status, error');

    if (updateResult.error && updateResult.error.code === '23514') {
      // Check constraint ai_jobs_status_check active on DB, use 'failed' with error 'job_cancelled_by_user'
      updateResult = await supabase
        .from('ai_jobs')
        .update({
          status: 'failed',
          error: 'job_cancelled_by_user',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .in('status', ['pending', 'processing'])
        .select('status, error');
    }

    if (updateResult.error) {
      console.error('Cancel job update error:', updateResult.error.message);
      return res.status(500).json({
        success: false,
        message: 'Gagal membatalkan job.'
      });
    }

    // Pastikan database benar-benar mengupdate baris (mencegah race condition jika job selesai mendahului cancel)
    if (!updateResult.data || updateResult.data.length === 0) {
      const { data: latestJob } = await supabase
        .from('ai_jobs')
        .select('status, error')
        .eq('id', jobId)
        .maybeSingle();

      if (latestJob?.status === 'completed') {
        return res.status(200).json({
          success: false,
          status: 'completed',
          message: 'Job sudah selesai diproses.'
        });
      }

      if (
        latestJob?.status === 'cancelled' ||
        (latestJob?.status === 'failed' && (latestJob as any)?.error === 'job_cancelled_by_user')
      ) {
        return res.status(200).json({
          success: true,
          status: 'cancelled',
          message: 'Job sudah dibatalkan sebelumnya.'
        });
      }

      return res.status(200).json({
        success: false,
        status: latestJob?.status || 'unknown',
        message: 'Job tidak dapat dibatalkan karena statusnya sudah berubah.'
      });
    }

    return res.status(200).json({
      success: true,
      status: 'cancelled',
      message: 'Job berhasil dibatalkan.'
    });
  } catch (err) {
    console.error('Cancel job API exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
}
