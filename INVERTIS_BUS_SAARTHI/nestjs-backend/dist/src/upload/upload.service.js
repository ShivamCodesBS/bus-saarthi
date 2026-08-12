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
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cloudinary_1 = require("cloudinary");
const config_1 = require("@nestjs/config");
const user_entity_1 = require("../users/entities/user.entity");
let UploadService = class UploadService {
    configService;
    usersRepository;
    constructor(configService, usersRepository) {
        this.configService = configService;
        this.usersRepository = usersRepository;
        cloudinary_1.v2.config({
            cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
        });
    }
    async uploadFile(file, folder = 'bus_saarthi_media') {
        if (!file)
            throw new common_1.BadRequestException('No file provided');
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({ folder }, (error, result) => {
                if (error)
                    return reject(error);
                if (!result)
                    return reject(new Error('Upload failed'));
                resolve({ status: 'success', url: result.secure_url });
            });
            uploadStream.end(file.buffer);
        });
    }
    async uploadProfilePic(file, loginId) {
        if (!file)
            throw new common_1.BadRequestException('No file provided');
        const result = await this.uploadFile(file, 'bus_saarthi_avatars');
        const profilePicUrl = result.url;
        const user = await this.usersRepository.findOne({ where: { loginId } });
        if (user) {
            user.profilePic = profilePicUrl;
            await this.usersRepository.save(user);
        }
        return {
            status: 'success',
            url: profilePicUrl,
            profile_pic: profilePicUrl,
        };
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], UploadService);
//# sourceMappingURL=upload.service.js.map