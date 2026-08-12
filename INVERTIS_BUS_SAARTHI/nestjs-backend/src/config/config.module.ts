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
      // validationSchema: Joi.object({
      //   PORT: Joi.number().default(5000),
      //   DB_HOST: Joi.string().required(),
      //   DB_PORT: Joi.number().default(5432),
      //   DB_USERNAME: Joi.string().required(),
      //   DB_PASSWORD: Joi.string().required(),
      //   DB_DATABASE: Joi.string().required(),
      //   JWT_SECRET: Joi.string().required(),
      //   AWS_ACCESS_KEY_ID: Joi.string().required(),
      //   AWS_SECRET_ACCESS_KEY: Joi.string().required(),
      //   AWS_REGION: Joi.string().required(),
      //   AWS_S3_BUCKET_NAME: Joi.string().required(),
      //   AWS_REKOGNITION_COLLECTION_ID: Joi.string().required(),
      // }),
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
