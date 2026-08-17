import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v2 as cloudinary } from 'cloudinary';
import { buildFurnitureVisualizationPrompt } from '../../src/utils/furnitureVisualization';
import type { FurnitureDesignState } from '../../src/types/furniture';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, status: 'failed', error: 'Method Not Allowed' });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const { designState } = (req.body || {}) as { designState?: FurnitureDesignState };

  // 1. Check Provider Token Availability
  if (!replicateToken || replicateToken.trim() === '' || replicateToken.includes('your_replicate_token')) {
    return res.status(200).json({
      success: false,
      status: 'not_configured',
      error: 'Replicate API token is not configured on server.'
    });
  }

  // 2. Validate Design State & Category Contract
  if (!designState || !designState.category) {
    return res.status(400).json({
      success: false,
      status: 'failed',
      error: 'Missing or invalid furniture design state or category.'
    });
  }

  try {
    // 3. Build Deterministic Prompt using Phase 6 Function
    const prompt = buildFurnitureVisualizationPrompt(designState);
    if (!prompt) {
      return res.status(400).json({
        success: false,
        status: 'failed',
        error: 'Unable to build visualization prompt from state.'
      });
    }

    // 4. Call Replicate API Server-Side (black-forest-labs/flux-1.1-pro)
    const replicateResp = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait' // Request synchronous waiting if supported
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: '1:1',
          output_format: 'webp',
          output_quality: 90,
          safety_tolerance: 2
        }
      })
    });

    if (!replicateResp.ok) {
      const errText = await replicateResp.text();
      console.error('[Replicate API Error]', replicateResp.status, errText);
      return res.status(500).json({
        success: false,
        status: 'failed',
        error: 'Gagal menghubungi Replicate API server.'
      });
    }

    let repData = await replicateResp.json();

    // Polling if prediction is still processing asynchronously
    let retries = 0;
    while ((repData.status === 'starting' || repData.status === 'processing') && retries < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollUrl = repData.urls?.get || `https://api.replicate.com/v1/predictions/${repData.id}`;
      const pollResp = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${replicateToken}` }
      });
      if (pollResp.ok) {
        repData = await pollResp.json();
      }
      retries++;
    }

    if (repData.status !== 'succeeded' || !repData.output) {
      return res.status(500).json({
        success: false,
        status: 'failed',
        error: repData.error || 'Visualisasi gagal diproses oleh model Replicate.'
      });
    }

    // Handle output (array string URL or single string URL)
    const tempImageUrl = Array.isArray(repData.output) ? repData.output[0] : repData.output;

    // 5. Save generated image to Cloudinary Storage CDN
    let permanentImageUrl = tempImageUrl;
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      try {
        const uploadResult = await cloudinary.uploader.upload(tempImageUrl, {
          folder: 'agm-assistant/furniture-visualizations',
          context: {
            category: designState.category,
            version: String(designState.version || 1)
          }
        });
        permanentImageUrl = uploadResult.secure_url;
      } catch (cloudErr) {
        console.warn('[Cloudinary Warning] Upload failed, falling back to temp Replicate URL:', cloudErr);
      }
    }

    // 6. Return Clean Success Contract
    return res.status(200).json({
      success: true,
      status: 'ready',
      imageUrl: permanentImageUrl,
      designVersion: designState.version || 1,
      generatedAt: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[Visualize Endpoint Exception]', err);
    return res.status(500).json({
      success: false,
      status: 'failed',
      error: 'Terjadi kesalahan server saat memproses visualisasi.'
    });
  }
}
