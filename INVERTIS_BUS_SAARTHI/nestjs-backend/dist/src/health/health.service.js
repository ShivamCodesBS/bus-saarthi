"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const system_log_entity_1 = require("./entities/system-log.entity");
const os = __importStar(require("os"));
let HealthService = class HealthService {
    systemLogRepository;
    eventEmitter;
    metricsInterval;
    constructor(systemLogRepository, eventEmitter) {
        this.systemLogRepository = systemLogRepository;
        this.eventEmitter = eventEmitter;
    }
    onModuleInit() {
        this.metricsInterval = setInterval(() => {
            this.eventEmitter.emit('system.metrics', this.getMetrics());
        }, 5000);
    }
    onModuleDestroy() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
    }
    getMetrics() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const uptime = process.uptime();
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        return {
            memory: {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                usagePercentage: ((usedMem / totalMem) * 100).toFixed(2),
            },
            cpu: {
                cores: cpus.length,
                model: cpus[0].model,
                loadAverage: loadAvg,
            },
            process: {
                uptime,
                memoryUsage: process.memoryUsage(),
            },
            os: {
                platform: os.platform(),
                release: os.release(),
                uptime: os.uptime(),
            }
        };
    }
    async getLogs(page = 1, limit = 50, level) {
        const query = this.systemLogRepository.createQueryBuilder('log');
        if (level) {
            query.where('log.level = :level', { level });
        }
        query.orderBy('log.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        const [logs, total] = await query.getManyAndCount();
        return {
            data: logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(system_log_entity_1.SystemLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], HealthService);
//# sourceMappingURL=health.service.js.map