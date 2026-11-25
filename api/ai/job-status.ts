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
    console.error('Job status API: server Supabase configuration missing.');
    return res.status(500).json({
      success: false,
      message: 'Job status service unavailable.'
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('ai_jobs')
      .select('status, response, error, created_at, access_token_hash')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error('Job status lookup failed:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to check job status.'
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

    const isCancelled =
      job.status === 'cancelled' ||
      (job.status === 'failed' &&
        (job.error === 'job_cancelled_by_user' || job.error === 'cancelled'));

    return res.status(200).json({
      success: true,
      status: isCancelled ? 'cancelled' : job.status,
      response: isCancelled ? null : job.response,
      error: isCancelled ? 'Job dibatalkan oleh pengguna.' : job.error
    });
  } catch (err) {
    console.error('Job status API exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
}
