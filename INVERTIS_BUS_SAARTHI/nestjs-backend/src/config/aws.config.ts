import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
  s3Bucket: process.env.AWS_S3_BUCKET_NAME,
  rekognitionCollection: process.env.AWS_REKOGNITION_COLLECTION_ID,
  confidenceThreshold: parseFloat(process.env.REKOGNITION_CONFIDENCE_THRESHOLD || '95'),
  minSharpness: parseFloat(process.env.FACE_MIN_SHARPNESS || '5'),
  minBrightness: parseFloat(process.env.FACE_MIN_BRIGHTNESS || '5'),
  minFaceConfidence: parseFloat(process.env.FACE_MIN_CONFIDENCE || '80'),
}));
