import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { DbLoggerService } from './health/db-logger.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { RedisIoAdapter } from './gateway/redis-io.adapter';
import { ConfigService } from '@nestjs/config';
import cluster from 'node:cluster';
import * as os from 'node:os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://bus-sarthi.onrender.com',
      ];
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://192.168.')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const dbLogger = app.get(DbLoggerService);
  app.useLogger(dbLogger);
  app.useGlobalFilters(new GlobalExceptionFilter(dbLogger));
  app.useGlobalInterceptors(new LoggingInterceptor(), new TimeoutInterceptor());

  const redisIoAdapter = new RedisIoAdapter(app, configService);
  // Try to connect to Redis — it's optional for local development
  try {
    await redisIoAdapter.connectToRedis();
  } catch (e) {
    // connectToRedis handles its own error logging with graceful fallback
  }
  app.useWebSocketAdapter(redisIoAdapter);

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Bus Saarthi API')
    .setDescription('NestJS + PostgreSQL Backend for Bus Saarthi')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`Worker ${process.pid} is listening on port ${port}`);
}

bootstrap();
