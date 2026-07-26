// src/api/cloudinary-upload.ts
import { v2 as cloudinary } from 'cloudinary';
import type { VercelRequest, VercelResponse } from '@vercel/node';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// A helper function to parse multipart form data (for image upload)
// In a real project, you'd use a library like 'formidable' or 'multer' for this.
// For Vercel Edge functions, this might need different handling (e.g., using busboy directly)

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Ensure req.body is parsed as JSON by Vercel's handler
  const { image: base64Image } = req.body;

  if (!base64Image || typeof base64Image !== 'string') {
    return res.status(400).json({ message: 'Invalid or missing image data in request body.' });
  }

  try {
    // Upload the image
    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: 'product_images',
      quality: 'auto:low', // Optimize quality
      width: 800, // Resize width
      height: 800, // Resize height
      crop: 'limit' // Ensure image fits within dimensions
    });

    return res.status(200).json({
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    return res.status(500).json({ message: 'Image upload failed', error: error.message });
  }
}
