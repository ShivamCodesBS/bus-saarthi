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
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Parse cookies for HttpOnly token storage
  app.use(cookieParser());

  // Request body size limits (SEC-04) - prevent DoS via large payloads
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // Build allowed origins from env var (comma-separated) + sensible defaults
  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5199',
    ...extraOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server (no origin) and explicitly listed origins
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      try {
        const host = new URL(origin).hostname;
        // Allow all project Vercel and Render frontend deployments
        if (
          host.endsWith('.vercel.app') ||
          host.endsWith('.onrender.com') ||
          host === 'localhost' ||
          host === '127.0.0.1'
        ) {
          return callback(null, true);
        }
      } catch {
        /* unparseable origin — rejected below */
      }
      // Allow local network during dev
      if (
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.')
      ) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    credentials: true,
  });

  // CSRF protection is NOT applied globally because:
  // - Most API endpoints use Bearer token authentication (not cookies)
  // - Cookie-based auth is only for login/refresh/logout endpoints
  // - Clients (Flutter, React) don't currently send CSRF tokens
  // If cookie-based CSRF protection is needed later, it should be applied
  // selectively via a guard on specific routes, not globally.

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

  // SIGTERM (deploys, restarts) must close Prisma/Redis pools cleanly —
  // without this every deploy logged pool-timeout noise on the way down.
  app.enableShutdownHooks();
}

bootstrap();
