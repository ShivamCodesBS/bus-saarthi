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
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const attendance_entity_1 = require("./entities/attendance.entity");
const user_entity_1 = require("../users/entities/user.entity");
const ist_date_util_1 = require("../common/utils/ist-date.util");
const event_emitter_1 = require("@nestjs/event-emitter");
let AttendanceService = class AttendanceService {
    attendanceRepository;
    usersRepository;
    eventEmitter;
    constructor(attendanceRepository, usersRepository, eventEmitter) {
        this.attendanceRepository = attendanceRepository;
        this.usersRepository = usersRepository;
        this.eventEmitter = eventEmitter;
    }
    async syncAttendance(syncDto) {
        const { route_id, records } = syncDto;
        if (!records || records.length === 0) {
            throw new common_1.BadRequestException('No records to sync');
        }
        const todayStart = (0, ist_date_util_1.getISTMidnightUTC)();
        const results = { synced: 0, skipped: 0, errors: 0 };
        for (const record of records) {
            try {
                const existing = await this.attendanceRepository.createQueryBuilder('att')
                    .where('att.passengerId = :passengerId', { passengerId: record.passenger_id })
                    .andWhere('att.timestamp >= :todayStart', { todayStart })
                    .getOne();
                if (existing) {
                    results.skipped++;
                    continue;
                }
                const passenger = await this.usersRepository.findOne({ where: { loginId: record.passenger_id } });
                if (!passenger) {
                    results.errors++;
                    continue;
                }
                const newAttendance = this.attendanceRepository.create({
                    passengerId: passenger.loginId,
                    routeId: route_id,
                    name: passenger.name,
                    feeStatus: passenger.feeStatus,
                    confidence: record.confidence || undefined,
                    timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
                });
                await this.attendanceRepository.save(newAttendance);
                results.synced++;
                this.eventEmitter.emit('attendance.marked', {
                    passenger_id: passenger.loginId,
                    name: passenger.name,
                    route_id: route_id,
                    fee_status: passenger.feeStatus,
                });
            }
            catch (err) {
                console.error(`Error syncing attendance for ${record.passenger_id}:`, err);
                results.errors++;
            }
        }
        return {
            status: 'success',
            ...results,
        };
    }
    async getAllAttendanceToday() {
        const todayStart = (0, ist_date_util_1.getISTMidnightUTC)();
        return this.attendanceRepository.createQueryBuilder('att')
            .where('att.timestamp >= :todayStart', { todayStart })
            .orderBy('att.timestamp', 'DESC')
            .getMany();
    }
    async getAttendanceForRoute(routeId) {
        const todayStart = (0, ist_date_util_1.getISTMidnightUTC)();
        return this.attendanceRepository.createQueryBuilder('att')
            .where('att.routeId = :routeId', { routeId })
            .andWhere('att.timestamp >= :todayStart', { todayStart })
            .orderBy('att.timestamp', 'DESC')
            .getMany();
    }
    async getAttendanceForUser(loginId) {
        return this.attendanceRepository.createQueryBuilder('att')
            .where('att.passengerId = :loginId', { loginId })
            .orderBy('att.timestamp', 'DESC')
            .limit(30)
            .getMany();
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(attendance_entity_1.Attendance)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map