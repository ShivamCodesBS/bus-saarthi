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
exports.FaceRecognitionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const face_recognition_service_1 = require("./face-recognition.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
let FaceRecognitionController = class FaceRecognitionController {
    faceRecognitionService;
    constructor(faceRecognitionService) {
        this.faceRecognitionService = faceRecognitionService;
    }
    async enrollFace(passengerId, file) {
        if (!file)
            throw new common_1.BadRequestException('No image file provided');
        return this.faceRecognitionService.enrollFace(passengerId, file.buffer, file.mimetype);
    }
    async recognizeFace(file) {
        if (!file)
            throw new common_1.BadRequestException('No image file provided');
        return this.faceRecognitionService.recognizeFace(file.buffer);
    }
    async deleteFace(passengerId) {
        return this.faceRecognitionService.deleteFace(passengerId);
    }
};
exports.FaceRecognitionController = FaceRecognitionController;
__decorate([
    (0, common_1.Post)('faces/:passengerId/enroll'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('passengerId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FaceRecognitionController.prototype, "enrollFace", null);
__decorate([
    (0, common_1.Post)('attendance/recognize'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE, user_entity_1.UserRole.DRIVER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FaceRecognitionController.prototype, "recognizeFace", null);
__decorate([
    (0, common_1.Delete)('faces/:passengerId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TRANSPORT_INCHARGE),
    __param(0, (0, common_1.Param)('passengerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FaceRecognitionController.prototype, "deleteFace", null);
exports.FaceRecognitionController = FaceRecognitionController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [face_recognition_service_1.FaceRecognitionService])
], FaceRecognitionController);
//# sourceMappingURL=face-recognition.controller.js.map