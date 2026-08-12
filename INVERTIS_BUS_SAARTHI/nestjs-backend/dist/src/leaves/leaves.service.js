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
exports.LeavesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const leave_entity_1 = require("./entities/leave.entity");
const user_entity_1 = require("../users/entities/user.entity");
let LeavesService = class LeavesService {
    leaveRepository;
    usersRepository;
    constructor(leaveRepository, usersRepository) {
        this.leaveRepository = leaveRepository;
        this.usersRepository = usersRepository;
    }
    async markLeave(loginId, dateStr) {
        const user = await this.usersRepository.findOne({ where: { loginId } });
        if (!user || user.role !== user_entity_1.UserRole.PASSENGER) {
            throw new common_1.BadRequestException('Only passengers can mark leaves');
        }
        try {
            const leave = this.leaveRepository.create({ loginId, date: dateStr });
            await this.leaveRepository.save(leave);
            return { status: 'success', message: 'Leave marked' };
        }
        catch (error) {
            if (error.code === '23505') {
                return { status: 'success', message: 'Leave already marked for this date' };
            }
            throw error;
        }
    }
    async cancelLeave(loginId, dateStr) {
        await this.leaveRepository.delete({ loginId, date: dateStr });
        return { status: 'success', message: 'Leave cancelled' };
    }
};
exports.LeavesService = LeavesService;
exports.LeavesService = LeavesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(leave_entity_1.Leave)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], LeavesService);
//# sourceMappingURL=leaves.service.js.map