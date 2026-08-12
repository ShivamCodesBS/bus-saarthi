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
exports.TelemetryProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const telemetry_entity_1 = require("./entities/telemetry.entity");
let TelemetryProcessor = class TelemetryProcessor {
    telemetryRepository;
    constructor(telemetryRepository) {
        this.telemetryRepository = telemetryRepository;
    }
    async handleBatch(job) {
        const { route_id, data } = job.data;
        const entities = data.map(item => this.telemetryRepository.create({
            routeId: route_id,
            latitude: item.lat,
            longitude: item.lng,
            gpsSpeedKnots: item.gps_speed_knots,
            mpuSpeedKmh: item.mpu_speed_kmh,
            headingDeg: item.heading_deg,
            timestamp: new Date(item.timestamp),
        }));
        await this.telemetryRepository.save(entities);
    }
};
exports.TelemetryProcessor = TelemetryProcessor;
__decorate([
    (0, bull_1.Process)('processBatch'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelemetryProcessor.prototype, "handleBatch", null);
exports.TelemetryProcessor = TelemetryProcessor = __decorate([
    (0, bull_1.Processor)('telemetry'),
    __param(0, (0, typeorm_1.InjectRepository)(telemetry_entity_1.Telemetry)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TelemetryProcessor);
//# sourceMappingURL=telemetry.processor.js.map