import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import awsConfig from './aws.config';
import redisConfig from './redis.config';
import Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, awsConfig, redisConfig],
      validationSchema: Joi.object({
        // Server
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(5000),

        // Database (required — no sensible default)
        DATABASE_URL: Joi.string().required().messages({
          'any.required': 'DATABASE_URL is required. Set it in your .env file (e.g. postgresql://user:pass@localhost:5432/bus_saarthi)',
        }),

        // Auth
        JWT_SECRET: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),

        // Redis (optional — falls back gracefully)
        REDIS_URL: Joi.string().optional(),

        // CORS
        CORS_ORIGINS: Joi.string().optional(),

        // Webhooks
        WEBHOOK_SECRET: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),

        // Cloudinary (optional)
        CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
        CLOUDINARY_API_KEY: Joi.string().optional(),
        CLOUDINARY_API_SECRET: Joi.string().optional(),
      }),
      validationOptions: {
        allowUnknown: true, // Don't fail on unrecognized env vars
        abortEarly: false,  // Report all validation errors at once
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}

