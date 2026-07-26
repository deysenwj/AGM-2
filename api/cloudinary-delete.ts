// src/api/cloudinary-delete.ts
import { v2 as cloudinary } from 'cloudinary';
import type { VercelRequest, VercelResponse } from '@vercel/node';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { // DELETE method is also common, but POST is simpler for form submissions
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { public_id } = req.body;

  if (!public_id) {
    return res.status(400).json({ message: 'Missing public_id in request body' });
  }

  try {
    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result === 'ok') {
      return res.status(200).json({ message: 'Image deleted successfully', result });
    } else {
      console.error('Cloudinary delete error:', result);
      return res.status(500).json({ message: 'Image deletion failed', result });
    }
  } catch (error: any) {
    console.error('Cloudinary delete exception:', error);
    return res.status(500).json({ message: 'Image deletion failed due to exception', error: error.message });
  }
}
