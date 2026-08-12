"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SosService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sos_alert_entity_1 = require("./entities/sos-alert.entity");
const user_entity_1 = require("../users/entities/user.entity");
const config_1 = require("@nestjs/config");
const redis_1 = require("redis");
const event_emitter_1 = require("@nestjs/event-emitter");
let SosService = SosService_1 = class SosService {
    sosRepository;
    usersRepository;
    configService;
    eventEmitter;
    redisClient;
    inMemoryCooldown = new Map();
    logger = new common_1.Logger(SosService_1.name);
    useRedis = false;
    constructor(sosRepository, usersRepository, configService, eventEmitter) {
        this.sosRepository = sosRepository;
        this.usersRepository = usersRepository;
        this.configService = configService;
        this.eventEmitter = eventEmitter;
        this.initRedis();
    }
    async initRedis() {
        try {
            this.redisClient = (0, redis_1.createClient)({ url: this.configService.get('redis.url') || 'redis://localhost:6379' });
            this.redisClient.on('error', (err) => {
                this.logger.debug(`Redis SOS client error: ${err.message}`);
            });
            await this.redisClient.connect();
            this.useRedis = true;
            this.logger.log('Redis connected for SOS cooldowns');
        }
        catch (err) {
            this.logger.warn(`Redis not available for SOS cooldowns. Falling back to in-memory map.`);
            this.useRedis = false;
        }
    }
    async trigger(loginId) {
        if (this.useRedis) {
            const cooldownKey = `sos:cooldown:${loginId}`;
            const inCooldown = await this.redisClient.get(cooldownKey);
            if (inCooldown) {
                throw new common_1.BadRequestException('SOS alert already triggered recently. Please wait.');
            }
            await this.redisClient.setEx(cooldownKey, 60, 'true');
        }
        else {
            const now = Date.now();
            const lastTrigger = this.inMemoryCooldown.get(loginId);
            if (lastTrigger && now - lastTrigger < 60000) {
                throw new common_1.BadRequestException('SOS alert already triggered recently. Please wait.');
            }
            this.inMemoryCooldown.set(loginId, now);
        }
        const user = await this.usersRepository.findOne({ where: { loginId } });
        const routeId = user?.routeId || '4';
        const alert = this.sosRepository.create({
            loginId,
            passenger: user?.name,
            route: routeId,
        });
        await this.sosRepository.save(alert);
        this.eventEmitter.emit('sos.triggered', {
            login_id: loginId,
            passenger: user?.name,
            route: routeId,
        });
        return { status: 'success', message: 'SOS alert broadcasted to route ' + routeId };
    }
    async cancel(loginId) {
        if (this.useRedis) {
            const cooldownKey = `sos:cooldown:${loginId}`;
            await this.redisClient.del(cooldownKey);
        }
        else {
            this.inMemoryCooldown.delete(loginId);
        }
        this.eventEmitter.emit('sos.cancelled', { login_id: loginId });
        return { status: 'success', message: 'SOS alert cancelled' };
    }
};
exports.SosService = SosService;
exports.SosService = SosService = SosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sos_alert_entity_1.SosAlert)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        event_emitter_1.EventEmitter2])
], SosService);
//# sourceMappingURL=sos.service.js.map