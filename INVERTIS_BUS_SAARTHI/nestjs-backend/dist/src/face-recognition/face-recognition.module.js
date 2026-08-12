"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaceRecognitionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const face_recognition_service_1 = require("./face-recognition.service");
const face_recognition_controller_1 = require("./face-recognition.controller");
const rekognition_service_1 = require("./rekognition.service");
const s3_service_1 = require("./s3.service");
const user_entity_1 = require("../users/entities/user.entity");
let FaceRecognitionModule = class FaceRecognitionModule {
};
exports.FaceRecognitionModule = FaceRecognitionModule;
exports.FaceRecognitionModule = FaceRecognitionModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User])],
        controllers: [face_recognition_controller_1.FaceRecognitionController],
        providers: [face_recognition_service_1.FaceRecognitionService, rekognition_service_1.RekognitionService, s3_service_1.S3Service],
        exports: [face_recognition_service_1.FaceRecognitionService],
    })
], FaceRecognitionModule);
//# sourceMappingURL=face-recognition.module.js.map