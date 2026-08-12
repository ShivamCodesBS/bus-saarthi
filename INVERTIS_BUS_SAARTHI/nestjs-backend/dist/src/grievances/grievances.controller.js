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
exports.GrievancesController = void 0;
const common_1 = require("@nestjs/common");
const grievances_service_1 = require("./grievances.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
let GrievancesController = class GrievancesController {
    grievancesService;
    constructor(grievancesService) {
        this.grievancesService = grievancesService;
    }
    create(req, body) {
        return this.grievancesService.create(req.user.loginId, body.text, body.type, body.mediaUrl);
    }
    findAll() {
        return this.grievancesService.findAll();
    }
    findAllAdmin() {
        return this.grievancesService.findAll();
    }
    upvotePost(id, req) {
        return this.grievancesService.upvote(id, req.user.loginId);
    }
    upvotePut(id, req) {
        return this.grievancesService.upvote(id, req.user.loginId);
    }
    resolveAdmin(id) {
        return this.grievancesService.resolve(id);
    }
    resolvePut(id) {
        return this.grievancesService.resolve(id);
    }
    remove(id) {
        return this.grievancesService.remove(id);
    }
};
exports.GrievancesController = GrievancesController;
__decorate([
    (0, common_1.Post)('grievance'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('grievances'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('admin/grievances'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "findAllAdmin", null);
__decorate([
    (0, common_1.Post)('grievance/:id/upvote'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "upvotePost", null);
__decorate([
    (0, common_1.Put)('grievance/:id/upvote'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "upvotePut", null);
__decorate([
    (0, common_1.Patch)('grievance/:id/resolve'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "resolveAdmin", null);
__decorate([
    (0, common_1.Put)('grievance/:id/resolve'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "resolvePut", null);
__decorate([
    (0, common_1.Delete)('grievance/:id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GrievancesController.prototype, "remove", null);
exports.GrievancesController = GrievancesController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [grievances_service_1.GrievancesService])
], GrievancesController);
//# sourceMappingURL=grievances.controller.js.map