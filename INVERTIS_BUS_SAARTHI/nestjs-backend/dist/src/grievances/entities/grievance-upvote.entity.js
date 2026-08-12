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
exports.GrievanceUpvote = void 0;
const typeorm_1 = require("typeorm");
const grievance_entity_1 = require("./grievance.entity");
const user_entity_1 = require("../../users/entities/user.entity");
let GrievanceUpvote = class GrievanceUpvote {
    grievanceId;
    loginId;
    grievance;
    user;
};
exports.GrievanceUpvote = GrievanceUpvote;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'uuid' }),
    __metadata("design:type", String)
], GrievanceUpvote.prototype, "grievanceId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ length: 50 }),
    __metadata("design:type", String)
], GrievanceUpvote.prototype, "loginId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => grievance_entity_1.Grievance, (grievance) => grievance.upvoteRecords, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'grievance_id' }),
    __metadata("design:type", grievance_entity_1.Grievance)
], GrievanceUpvote.prototype, "grievance", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'login_id', referencedColumnName: 'loginId' }),
    __metadata("design:type", user_entity_1.User)
], GrievanceUpvote.prototype, "user", void 0);
exports.GrievanceUpvote = GrievanceUpvote = __decorate([
    (0, typeorm_1.Entity)('grievance_upvotes')
], GrievanceUpvote);
//# sourceMappingURL=grievance-upvote.entity.js.map