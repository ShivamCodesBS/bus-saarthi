import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  // Cloudinary credentials (used for image uploads)
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
}));
