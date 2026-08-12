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
var S3Service_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const stream_1 = require("stream");
let S3Service = S3Service_1 = class S3Service {
    configService;
    client;
    logger = new common_1.Logger(S3Service_1.name);
    constructor(configService) {
        this.configService = configService;
        this.client = new client_s3_1.S3Client({
            region: this.configService.get('aws.region'),
            credentials: {
                accessKeyId: this.configService.get('aws.accessKeyId'),
                secretAccessKey: this.configService.get('aws.secretAccessKey'),
            },
        });
    }
    generateKey(passengerId, suffix = 'enroll') {
        const safeId = String(passengerId).replace(/[^a-zA-Z0-9_-]/g, '_');
        return `faces/${safeId}-${suffix}-${Date.now()}.jpg`;
    }
    async uploadImage(buffer, key, mimeType) {
        const upload = new lib_storage_1.Upload({
            client: this.client,
            params: {
                Bucket: this.configService.get('aws.s3Bucket'),
                Key: key,
                Body: stream_1.Readable.from(buffer),
                ContentType: mimeType,
                ServerSideEncryption: 'AES256',
                Metadata: { uploadedAt: new Date().toISOString() },
            },
            partSize: 5 * 1024 * 1024,
            queueSize: 1,
        });
        await upload.done();
        return key;
    }
    async deleteImage(key) {
        if (!key)
            return;
        try {
            await this.client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: this.configService.get('aws.s3Bucket'),
                Key: key,
            }));
        }
        catch (err) {
            this.logger.error(`Failed to delete S3 object ${key}`, err);
        }
    }
    async getPresignedUrl(key) {
        if (!key)
            return null;
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.configService.get('aws.s3Bucket'),
            Key: key,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn: 3600 });
    }
};
exports.S3Service = S3Service;
exports.S3Service = S3Service = S3Service_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], S3Service);
//# sourceMappingURL=s3.service.js.map