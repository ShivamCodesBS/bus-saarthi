import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET env var is required in production');
  }
  return {
    secret: secret || 'dev_only_jwt_secret_DO_NOT_USE_IN_PROD',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  };
});
