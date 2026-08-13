import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  postgres: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    synchronize: process.env.NODE_ENV !== 'production', // Disable in production
  },
}));
