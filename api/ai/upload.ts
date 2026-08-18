// api/ai/upload.ts
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Centralized backend file validation constants
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DOC_SIZE_BYTES = 20 * 1024 * 1024;   // 20MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.csv', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 100);
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
    const { fileBase64, filename, mimeType, conversationId } = req.body || {};
    const userId = (req.headers['x-user-id'] as string) || null;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ success: false, message: 'Data file tidak valid.' });
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, message: 'Nama file tidak valid.' });
    }

    const cleanFilename = sanitizeFilename(filename);
    const ext = cleanFilename.substring(cleanFilename.lastIndexOf('.')).toLowerCase();

    // 1. Extension Validation
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format file tidak didukung. Gunakan PDF, DOCX, TXT, CSV, atau XLSX.' 
      });
    }

    // 2. MIME Type Validation
    const cleanMimeType = (mimeType || '').toLowerCase();
    if (cleanMimeType && !ALLOWED_MIME_TYPES.includes(cleanMimeType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'MIME type file tidak didukung.' 
      });
    }

    // 3. File Size Validation (Estimate from base64 string length)
    const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const fileSizeBytes = Math.round((base64Data.length * 3) / 4);
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(cleanMimeType) || ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    const maxAllowedBytes = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_DOC_SIZE_BYTES;

    if (fileSizeBytes > maxAllowedBytes) {
      const limitMb = isImage ? 10 : 20;
      return res.status(400).json({ 
        success: false, 
        message: `File terlalu besar. Maksimal ukuran ${isImage ? 'gambar' : 'dokumen'} ${limitMb}MB.` 
      });
    }

    // 4. Cloudinary Upload (Server-Side with Random Unique Public ID)
    const randomPublicId = `attachment_${generateUuid()}`;
    const uploadResult = await cloudinary.uploader.upload(fileBase64, {
      folder: 'assistant_attachments',
      public_id: randomPublicId,
      resource_type: isImage ? 'image' : 'raw',
      overwrite: true
    });

    const attachmentId = generateUuid();
    const sourceCategory = req.body?.source || (isImage ? 'furniture_reference' : 'document');

    // 5. Database Record Insertion in Supabase ai_attachments if table exists
    if (supabase) {
      try {
        await supabase.from('ai_attachments').insert({
          id: attachmentId,
          conversation_id: conversationId || generateUuid(),
          user_id: userId,
          filename: cleanFilename,
          mime_type: cleanMimeType || 'application/octet-stream',
          size: fileSizeBytes,
          storage_path: uploadResult.public_id,
          storage_url: uploadResult.secure_url,
          status: 'uploaded',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Could not insert attachment into Supabase ai_attachments table:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      attachment: {
        id: attachmentId,
        filename: cleanFilename,
        mime_type: cleanMimeType || 'application/octet-stream',
        size: fileSizeBytes,
        storage_url: uploadResult.secure_url,
        storage_path: uploadResult.public_id,
        source: sourceCategory
      }
    });

  } catch (error: any) {
    console.error('Error in /api/ai/upload:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal mengunggah file.', 
      error: error.message 
    });
  }
}
