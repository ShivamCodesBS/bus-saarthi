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
exports.SosAliasController = exports.SosController = void 0;
const common_1 = require("@nestjs/common");
const sos_service_1 = require("./sos.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let SosController = class SosController {
    sosService;
    constructor(sosService) {
        this.sosService = sosService;
    }
    trigger(req) {
        return this.sosService.trigger(req.user.loginId);
    }
    cancel(req) {
        return this.sosService.cancel(req.user.loginId);
    }
};
exports.SosController = SosController;
__decorate([
    (0, common_1.Post)('trigger'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SosController.prototype, "trigger", null);
__decorate([
    (0, common_1.Post)('cancel'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SosController.prototype, "cancel", null);
exports.SosController = SosController = __decorate([
    (0, common_1.Controller)('api/sos'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [sos_service_1.SosService])
], SosController);
const common_2 = require("@nestjs/common");
let SosAliasController = class SosAliasController {
    sosService;
    constructor(sosService) {
        this.sosService = sosService;
    }
    triggerAlias(req) {
        return this.sosService.trigger(req.user.loginId);
    }
};
exports.SosAliasController = SosAliasController;
__decorate([
    (0, common_1.Post)('sos'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SosAliasController.prototype, "triggerAlias", null);
exports.SosAliasController = SosAliasController = __decorate([
    (0, common_2.Controller)('api'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [sos_service_1.SosService])
], SosAliasController);
//# sourceMappingURL=sos.controller.js.map