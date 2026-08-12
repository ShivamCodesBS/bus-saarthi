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
exports.Grievance = exports.GrievanceStatus = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
const grievance_upvote_entity_1 = require("./grievance-upvote.entity");
var GrievanceStatus;
(function (GrievanceStatus) {
    GrievanceStatus["PENDING"] = "pending";
    GrievanceStatus["RESOLVED"] = "resolved";
})(GrievanceStatus || (exports.GrievanceStatus = GrievanceStatus = {}));
let Grievance = class Grievance {
    id;
    loginId;
    user;
    route;
    text;
    realName;
    type;
    mediaUrl;
    status;
    upvotes;
    createdAt;
    upvoteRecords;
};
exports.Grievance = Grievance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Grievance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], Grievance.prototype, "loginId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'login_id', referencedColumnName: 'loginId' }),
    __metadata("design:type", user_entity_1.User)
], Grievance.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], Grievance.prototype, "route", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Grievance.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Grievance.prototype, "realName", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    __metadata("design:type", String)
], Grievance.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Grievance.prototype, "mediaUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: GrievanceStatus, default: GrievanceStatus.PENDING }),
    __metadata("design:type", String)
], Grievance.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Grievance.prototype, "upvotes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Grievance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => grievance_upvote_entity_1.GrievanceUpvote, (upvote) => upvote.grievance),
    __metadata("design:type", Array)
], Grievance.prototype, "upvoteRecords", void 0);
exports.Grievance = Grievance = __decorate([
    (0, typeorm_1.Entity)('grievances')
], Grievance);
//# sourceMappingURL=grievance.entity.js.map