import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '5000', 10),
  webhookSecret: process.env.WEBHOOK_SECRET || 'invertis_hardware_secret_2026',
}));
