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
exports.FaceRecognitionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/entities/user.entity");
const rekognition_service_1 = require("./rekognition.service");
const s3_service_1 = require("./s3.service");
let FaceRecognitionService = class FaceRecognitionService {
    usersRepository;
    rekognitionService;
    s3Service;
    constructor(usersRepository, rekognitionService, s3Service) {
        this.usersRepository = usersRepository;
        this.rekognitionService = rekognitionService;
        this.s3Service = s3Service;
    }
    async enrollFace(loginId, imageBuffer, mimeType) {
        const user = await this.usersRepository.findOne({ where: { loginId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.role !== user_entity_1.UserRole.PASSENGER)
            throw new common_1.ConflictException('Only passengers can enroll faces');
        if (user.awsFaceId)
            throw new common_1.ConflictException('A face is already enrolled for this passenger');
        const s3Key = this.s3Service.generateKey(loginId, 'enroll');
        await this.s3Service.uploadImage(imageBuffer, s3Key, mimeType);
        try {
            const faceId = await this.rekognitionService.indexFace(imageBuffer, loginId);
            user.awsFaceId = faceId || null;
            user.externalImageId = loginId;
            user.s3ObjectKey = s3Key;
            user.faceEnrolledAt = new Date();
            await this.usersRepository.save(user);
            return { status: 'success', faceId, s3Key };
        }
        catch (error) {
            await this.s3Service.deleteImage(s3Key);
            throw error;
        }
    }
    async recognizeFace(imageBuffer) {
        const match = await this.rekognitionService.searchFacesByImage(imageBuffer);
        if (!match)
            return { status: 'no_match', detail: 'No matching face found above threshold' };
        const passenger = await this.usersRepository.findOne({ where: { loginId: match.externalImageId } });
        if (!passenger)
            return { status: 'no_match', detail: 'Face recognized but passenger record not found in database' };
        return {
            status: 'matched',
            passenger: {
                login_id: passenger.loginId,
                name: passenger.name,
                fee_status: passenger.feeStatus,
                route_id: passenger.routeId,
            },
            confidence: match.confidence,
        };
    }
    async deleteFace(loginId) {
        const user = await this.usersRepository.findOne({ where: { loginId } });
        if (!user || !user.awsFaceId)
            throw new common_1.NotFoundException('No face enrolled for this passenger');
        await this.rekognitionService.deleteFace(user.awsFaceId);
        if (user.s3ObjectKey) {
            await this.s3Service.deleteImage(user.s3ObjectKey);
        }
        user.awsFaceId = null;
        user.externalImageId = null;
        user.s3ObjectKey = null;
        user.faceEnrolledAt = null;
        await this.usersRepository.save(user);
        return { status: 'success', message: 'Face deleted' };
    }
};
exports.FaceRecognitionService = FaceRecognitionService;
exports.FaceRecognitionService = FaceRecognitionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        rekognition_service_1.RekognitionService,
        s3_service_1.S3Service])
], FaceRecognitionService);
//# sourceMappingURL=face-recognition.service.js.map