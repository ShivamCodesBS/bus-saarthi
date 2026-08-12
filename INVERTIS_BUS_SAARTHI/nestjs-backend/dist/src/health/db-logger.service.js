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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbLoggerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const system_log_entity_1 = require("./entities/system-log.entity");
let DbLoggerService = class DbLoggerService {
    systemLogRepository;
    eventEmitter;
    constructor(systemLogRepository, eventEmitter) {
        this.systemLogRepository = systemLogRepository;
        this.eventEmitter = eventEmitter;
    }
    log(message, context) {
        this.saveLog(system_log_entity_1.LogLevel.INFO, message, context);
        console.log(`[INFO] [${context || 'Application'}] ${message}`);
    }
    error(message, trace, context) {
        this.saveLog(system_log_entity_1.LogLevel.ERROR, message, context, { trace });
        console.error(`[ERROR] [${context || 'Application'}] ${message}`, trace);
    }
    warn(message, context) {
        this.saveLog(system_log_entity_1.LogLevel.WARN, message, context);
        console.warn(`[WARN] [${context || 'Application'}] ${message}`);
    }
    debug(message, context) {
        console.debug(`[DEBUG] [${context || 'Application'}] ${message}`);
    }
    verbose(message, context) {
        console.log(`[VERBOSE] [${context || 'Application'}] ${message}`);
    }
    fatal(message, context) {
        this.saveLog(system_log_entity_1.LogLevel.FATAL, message, context);
        console.error(`[FATAL] [${context || 'Application'}] ${message}`);
    }
    async saveLog(level, message, context, meta) {
        const newLog = {
            level,
            message: typeof message === 'string' ? message : JSON.stringify(message),
            context,
            meta,
            createdAt: new Date(),
        };
        this.systemLogRepository.save(newLog).catch(err => {
            console.error('Failed to save log to database', err);
        });
        this.eventEmitter.emit('system.log', newLog);
    }
};
exports.DbLoggerService = DbLoggerService;
exports.DbLoggerService = DbLoggerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(system_log_entity_1.SystemLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], DbLoggerService);
//# sourceMappingURL=db-logger.service.js.map