import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'grateful-seal-235287.upstash.io',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || process.env.UPSTASH_REDIS_REST_TOKEN,
  url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
  // For Upstash REST API
  restUrl: process.env.UPSTASH_REDIS_REST_URL,
  restToken: process.env.UPSTASH_REDIS_REST_TOKEN,
}));
