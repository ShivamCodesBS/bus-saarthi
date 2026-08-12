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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushSubscription = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
let PushSubscription = class PushSubscription {
    id;
    loginId;
    user;
    subscription;
    deviceType;
};
exports.PushSubscription = PushSubscription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PushSubscription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], PushSubscription.prototype, "loginId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'login_id', referencedColumnName: 'loginId' }),
    __metadata("design:type", user_entity_1.User)
], PushSubscription.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], PushSubscription.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, default: 'web' }),
    __metadata("design:type", String)
], PushSubscription.prototype, "deviceType", void 0);
exports.PushSubscription = PushSubscription = __decorate([
    (0, typeorm_1.Entity)('push_subscriptions')
], PushSubscription);
//# sourceMappingURL=push-subscription.entity.js.map