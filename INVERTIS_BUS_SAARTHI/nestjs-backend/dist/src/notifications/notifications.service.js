"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const push_subscription_entity_1 = require("./entities/push-subscription.entity");
const broadcast_entity_1 = require("./entities/broadcast.entity");
const webpush = __importStar(require("web-push"));
const config_1 = require("@nestjs/config");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    pushSubRepository;
    broadcastRepository;
    configService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(pushSubRepository, broadcastRepository, configService) {
        this.pushSubRepository = pushSubRepository;
        this.broadcastRepository = broadcastRepository;
        this.configService = configService;
        const vapidPublicKey = this.configService.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = this.configService.get('VAPID_PRIVATE_KEY');
        if (vapidPublicKey && vapidPrivateKey) {
            webpush.setVapidDetails('mailto:admin@invertisbus.com', vapidPublicKey, vapidPrivateKey);
        }
        else {
            this.logger.warn('VAPID keys missing. Push notifications disabled.');
        }
    }
    async subscribe(loginId, subscription, deviceType = 'web') {
        let sub = await this.pushSubRepository.findOne({ where: { loginId, deviceType } });
        if (sub) {
            sub.subscription = subscription;
        }
        else {
            sub = this.pushSubRepository.create({ loginId, subscription, deviceType });
        }
        await this.pushSubRepository.save(sub);
        return { status: 'success' };
    }
    async sendPushNotification(loginId, payload) {
        const subs = await this.pushSubRepository.find({ where: { loginId } });
        for (const sub of subs) {
            try {
                await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
            }
            catch (err) {
                if (err.statusCode === 410) {
                    await this.pushSubRepository.remove(sub);
                }
                else {
                    this.logger.error(`Failed to send push to ${loginId}:`, err);
                }
            }
        }
    }
    async broadcastMessage(message, title) {
        const broadcast = this.broadcastRepository.create({ message, title });
        await this.broadcastRepository.save(broadcast);
        const payload = {
            title: title || 'Bus Saarthi Broadcast',
            body: message,
            icon: '/icons/bus-192x192.png',
        };
        const allSubs = await this.pushSubRepository.find();
        for (const sub of allSubs) {
            try {
                await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
            }
            catch (err) {
                if (err.statusCode === 410) {
                    await this.pushSubRepository.remove(sub);
                }
            }
        }
        return { status: 'success', message: 'Broadcast sent' };
    }
    async getRecentBroadcasts() {
        const broadcasts = await this.broadcastRepository.find({
            order: { timestamp: 'DESC' },
            take: 20,
        });
        return broadcasts;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(push_subscription_entity_1.PushSubscription)),
    __param(1, (0, typeorm_1.InjectRepository)(broadcast_entity_1.Broadcast)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map