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
exports.StreamsController = void 0;
const common_1 = require("@nestjs/common");
const streams_service_1 = require("./streams.service");
let StreamsController = class StreamsController {
    streamsService;
    constructor(streamsService) {
        this.streamsService = streamsService;
    }
    async authenticateStream(body) {
        const { path, action } = body;
        const streamId = path.replace('live/', '');
        if (action === 'publish') {
            const isValid = await this.streamsService.validateBus(streamId);
            if (!isValid) {
                throw new common_1.HttpException('Unauthorized Bus', common_1.HttpStatus.UNAUTHORIZED);
            }
            await this.streamsService.setStreamActive(streamId, true);
        }
        else if (action === 'unpublish') {
            await this.streamsService.setStreamActive(streamId, false);
        }
        return { status: 'ok' };
    }
};
exports.StreamsController = StreamsController;
__decorate([
    (0, common_1.Post)('auth'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StreamsController.prototype, "authenticateStream", null);
exports.StreamsController = StreamsController = __decorate([
    (0, common_1.Controller)('api/streams'),
    __metadata("design:paramtypes", [streams_service_1.StreamsService])
], StreamsController);
//# sourceMappingURL=streams.controller.js.map