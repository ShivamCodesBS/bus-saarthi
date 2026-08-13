import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret && process.env.NODE_ENV === 'production') {
    throw new Error('WEBHOOK_SECRET env var is required in production');
  }
  return {
    port: parseInt(process.env.PORT || '5000', 10),
    webhookSecret: webhookSecret || 'dev_only_webhook_secret_DO_NOT_USE_IN_PROD',
  };
});
