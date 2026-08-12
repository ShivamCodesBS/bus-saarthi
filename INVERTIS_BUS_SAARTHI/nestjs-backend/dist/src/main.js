"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
const db_logger_service_1 = require("./health/db-logger.service");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
const timeout_interceptor_1 = require("./common/interceptors/timeout.interceptor");
const swagger_1 = require("@nestjs/swagger");
const redis_io_adapter_1 = require("./gateway/redis-io.adapter");
const config_1 = require("@nestjs/config");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.enableCors({
        origin: (origin, callback) => {
            const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost:5174',
                'https://bus-sarthi.onrender.com',
            ];
            if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://192.168.')) {
                callback(null, true);
            }
            else {
                callback(null, true);
            }
        },
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    const dbLogger = app.get(db_logger_service_1.DbLoggerService);
    app.useLogger(dbLogger);
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter(dbLogger));
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor(), new timeout_interceptor_1.TimeoutInterceptor());
    const redisIoAdapter = new redis_io_adapter_1.RedisIoAdapter(app, configService);
    try {
        await redisIoAdapter.connectToRedis();
    }
    catch (e) {
    }
    app.useWebSocketAdapter(redisIoAdapter);
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Bus Saarthi API')
        .setDescription('NestJS + PostgreSQL Backend for Bus Saarthi')
        .setVersion('2.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.PORT || 5000;
    await app.listen(port, '0.0.0.0');
    console.log(`Worker ${process.pid} is listening on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map