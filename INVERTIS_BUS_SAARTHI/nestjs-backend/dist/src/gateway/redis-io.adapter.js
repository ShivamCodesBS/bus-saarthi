"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const common_1 = require("@nestjs/common");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    configService;
    adapterConstructor;
    logger = new common_1.Logger('RedisIoAdapter');
    redisAvailable = false;
    constructor(app, configService) {
        super(app);
        this.configService = configService;
    }
    async connectToRedis() {
        const redisUrl = this.configService.get('redis.url') || 'redis://localhost:6379';
        try {
            const { createClient } = await import('redis');
            const { createAdapter } = await import('@socket.io/redis-adapter');
            const pubClient = createClient({ url: redisUrl });
            const subClient = pubClient.duplicate();
            pubClient.on('error', (err) => this.logger.debug(`Redis pubClient error: ${err.message}`));
            subClient.on('error', (err) => this.logger.debug(`Redis subClient error: ${err.message}`));
            await Promise.race([
                Promise.all([pubClient.connect(), subClient.connect()]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 3000)),
            ]);
            this.adapterConstructor = createAdapter(pubClient, subClient);
            this.redisAvailable = true;
            this.logger.log('✅ Redis adapter connected successfully');
        }
        catch (err) {
            this.logger.warn(`⚠️  Redis not available (${err.message}). Falling back to in-memory Socket.IO adapter. This is fine for local development.`);
            this.redisAvailable = false;
        }
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        if (this.redisAvailable && this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map