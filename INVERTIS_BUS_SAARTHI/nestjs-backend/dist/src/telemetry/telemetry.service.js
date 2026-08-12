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
exports.TelemetryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const telemetry_entity_1 = require("./entities/telemetry.entity");
const attendance_entity_1 = require("../attendance/entities/attendance.entity");
const route_entity_1 = require("../routes/entities/route.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
const ist_date_util_1 = require("../common/utils/ist-date.util");
const typeorm_3 = require("typeorm");
let TelemetryService = class TelemetryService {
    telemetryRepository;
    attendanceRepository;
    routeRepository;
    eventEmitter;
    constructor(telemetryRepository, attendanceRepository, routeRepository, eventEmitter) {
        this.telemetryRepository = telemetryRepository;
        this.attendanceRepository = attendanceRepository;
        this.routeRepository = routeRepository;
        this.eventEmitter = eventEmitter;
    }
    async addBatchToQueue(batchDto) {
        const { route_id, data } = batchDto;
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
        if (data.length > 0) {
            const latest = data[data.length - 1];
            this.eventEmitter.emit('telemetry.live', {
                route_id,
                ...latest,
            });
        }
        return { status: 'success', received: data.length };
    }
    async getLatestStatus(routeId) {
        const todayStart = (0, ist_date_util_1.getISTMidnightUTC)();
        const filled = await this.attendanceRepository.count({
            where: {
                routeId,
                timestamp: (0, typeorm_3.MoreThanOrEqual)(todayStart),
            }
        });
        const total = 50;
        let status = 'Low';
        if (filled >= 50)
            status = 'Over Crowd';
        else if (filled > 25)
            status = 'Medium';
        return {
            status: 'success',
            data: {
                filled,
                total,
                status,
            }
        };
    }
    async getTelemetryHistory(routeId, dateStr) {
        const start = new Date(`${dateStr}T00:00:00+05:30`);
        const end = new Date(`${dateStr}T23:59:59+05:30`);
        const route = await this.routeRepository.findOne({ where: { routeId } });
        const speedLimit = route?.speedLimit || 60;
        const allData = await this.telemetryRepository.createQueryBuilder('t')
            .where('t.routeId = :routeId', { routeId })
            .andWhere('t.timestamp >= :start', { start })
            .andWhere('t.timestamp <= :end', { end })
            .orderBy('t.timestamp', 'ASC')
            .getMany();
        if (allData.length === 0) {
            return { routeId, date: dateStr, speedLimit, data: [], stats: { maxSpeed: 0, avgSpeed: 0, violations: 0 }, violationsData: [] };
        }
        let maxSpeed = 0;
        let sumSpeed = 0;
        const violationsData = [];
        const downsampledData = [];
        const DOWNSAMPLE_MS = 30 * 1000;
        let lastPushedTime = 0;
        for (const point of allData) {
            const speed = point.mpuSpeedKmh || (point.gpsSpeedKnots * 1.852) || 0;
            if (speed > maxSpeed)
                maxSpeed = speed;
            sumSpeed += speed;
            const isViolation = speed > speedLimit;
            if (isViolation) {
                violationsData.push({ ...point, speed: Math.round(speed) });
            }
            const pointTime = point.timestamp.getTime();
            if (isViolation || pointTime - lastPushedTime >= DOWNSAMPLE_MS) {
                downsampledData.push({
                    timestamp: point.timestamp,
                    speed: Math.round(speed),
                    lat: point.latitude,
                    lng: point.longitude,
                });
                lastPushedTime = pointTime;
            }
        }
        return {
            routeId,
            date: dateStr,
            speedLimit,
            stats: {
                maxSpeed: Math.round(maxSpeed),
                avgSpeed: Math.round(sumSpeed / allData.length),
                violations: violationsData.length,
            },
            violationsData,
            data: downsampledData
        };
    }
};
exports.TelemetryService = TelemetryService;
exports.TelemetryService = TelemetryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(telemetry_entity_1.Telemetry)),
    __param(1, (0, typeorm_1.InjectRepository)(attendance_entity_1.Attendance)),
    __param(2, (0, typeorm_1.InjectRepository)(route_entity_1.Route)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], TelemetryService);
//# sourceMappingURL=telemetry.service.js.map