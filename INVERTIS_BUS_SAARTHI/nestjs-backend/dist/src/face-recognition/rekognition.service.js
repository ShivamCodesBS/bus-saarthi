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
var RekognitionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RekognitionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_rekognition_1 = require("@aws-sdk/client-rekognition");
let RekognitionService = RekognitionService_1 = class RekognitionService {
    configService;
    client;
    logger = new common_1.Logger(RekognitionService_1.name);
    constructor(configService) {
        this.configService = configService;
        this.client = new client_rekognition_1.RekognitionClient({
            region: this.configService.get('aws.region'),
            credentials: {
                accessKeyId: this.configService.get('aws.accessKeyId'),
                secretAccessKey: this.configService.get('aws.secretAccessKey'),
            },
        });
    }
    async validateFaceImage(imageBuffer) {
        const result = await this.client.send(new client_rekognition_1.DetectFacesCommand({
            Image: { Bytes: imageBuffer },
            Attributes: ['ALL'],
        }));
        const faces = result.FaceDetails || [];
        if (faces.length === 0)
            throw new common_1.BadRequestException('No face detected in the image.');
        if (faces.length > 1)
            throw new common_1.BadRequestException(`${faces.length} faces detected. Please upload an image with exactly one face.`);
        const face = faces[0];
        const minConfidence = this.configService.get('aws.minFaceConfidence');
        const minSharpness = this.configService.get('aws.minSharpness');
        const minBrightness = this.configService.get('aws.minBrightness');
        if (face.Confidence < minConfidence)
            throw new common_1.BadRequestException(`Detection confidence ${face.Confidence.toFixed(1)}% is below ${minConfidence}%`);
        if (face.Quality) {
            if (face.Quality.Sharpness < minSharpness)
                throw new common_1.BadRequestException(`Image is too blurry (sharpness: ${face.Quality.Sharpness.toFixed(1)})`);
            if (face.Quality.Brightness < minBrightness)
                throw new common_1.BadRequestException(`Image is too dark (brightness: ${face.Quality.Brightness.toFixed(1)})`);
        }
        return face;
    }
    async indexFace(imageBuffer, externalImageId) {
        await this.validateFaceImage(imageBuffer);
        const result = await this.client.send(new client_rekognition_1.IndexFacesCommand({
            CollectionId: this.configService.get('aws.rekognitionCollection'),
            Image: { Bytes: imageBuffer },
            ExternalImageId: externalImageId,
            DetectionAttributes: ['ALL'],
            MaxFaces: 1,
            QualityFilter: 'HIGH',
        }));
        const records = result.FaceRecords || [];
        if (records.length === 0)
            throw new common_1.BadRequestException('Rekognition rejected the face (quality filter: HIGH).');
        return records[0].Face.FaceId;
    }
    async searchFacesByImage(imageBuffer) {
        try {
            const result = await this.client.send(new client_rekognition_1.SearchFacesByImageCommand({
                CollectionId: this.configService.get('aws.rekognitionCollection'),
                Image: { Bytes: imageBuffer },
                MaxFaces: 1,
                FaceMatchThreshold: this.configService.get('aws.confidenceThreshold'),
                QualityFilter: 'AUTO',
            }));
            const matches = result.FaceMatches || [];
            if (matches.length === 0)
                return null;
            const best = matches[0];
            return {
                faceId: best.Face.FaceId,
                externalImageId: best.Face.ExternalImageId,
                confidence: best.Similarity,
            };
        }
        catch (err) {
            if (err.name === 'InvalidParameterException')
                return null;
            throw err;
        }
    }
    async deleteFace(faceId) {
        if (!faceId)
            return;
        await this.client.send(new client_rekognition_1.DeleteFacesCommand({
            CollectionId: this.configService.get('aws.rekognitionCollection'),
            FaceIds: [faceId],
        }));
    }
};
exports.RekognitionService = RekognitionService;
exports.RekognitionService = RekognitionService = RekognitionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RekognitionService);
//# sourceMappingURL=rekognition.service.js.map