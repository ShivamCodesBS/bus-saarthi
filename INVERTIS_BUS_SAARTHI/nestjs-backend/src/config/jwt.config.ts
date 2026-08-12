import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'supersecret_jwt_key_bus_saarthi_2025',
  expiresIn: '24h',
}));
