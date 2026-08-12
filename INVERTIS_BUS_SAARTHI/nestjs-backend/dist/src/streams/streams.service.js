"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var StreamsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamsService = void 0;
const common_1 = require("@nestjs/common");
let StreamsService = StreamsService_1 = class StreamsService {
    logger = new common_1.Logger(StreamsService_1.name);
    activeStreams = new Map();
    async validateBus(busId) {
        this.logger.log(`Validating bus stream connection: ${busId}`);
        return true;
    }
    async setStreamActive(busId, isActive) {
        if (isActive) {
            this.activeStreams.set(busId, true);
            this.logger.log(`Stream activated for bus: ${busId}`);
        }
        else {
            this.activeStreams.delete(busId);
            this.logger.log(`Stream deactivated for bus: ${busId}`);
        }
    }
    getActiveStreams() {
        return Array.from(this.activeStreams.keys());
    }
};
exports.StreamsService = StreamsService;
exports.StreamsService = StreamsService = StreamsService_1 = __decorate([
    (0, common_1.Injectable)()
], StreamsService);
//# sourceMappingURL=streams.service.js.map