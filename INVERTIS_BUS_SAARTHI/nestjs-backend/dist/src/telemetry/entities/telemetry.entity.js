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
exports.Telemetry = void 0;
const typeorm_1 = require("typeorm");
let Telemetry = class Telemetry {
    id;
    routeId;
    latitude;
    longitude;
    gpsSpeedKnots;
    mpuSpeedKmh;
    headingDeg;
    timestamp;
};
exports.Telemetry = Telemetry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Telemetry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, default: '4' }),
    __metadata("design:type", String)
], Telemetry.prototype, "routeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'double precision', nullable: true }),
    __metadata("design:type", Number)
], Telemetry.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'double precision', nullable: true }),
    __metadata("design:type", Number)
], Telemetry.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'real', nullable: true }),
    __metadata("design:type", Number)
], Telemetry.prototype, "gpsSpeedKnots", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'real', nullable: true }),
    __metadata("design:type", Number)
], Telemetry.prototype, "mpuSpeedKmh", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'real', nullable: true }),
    __metadata("design:type", Number)
], Telemetry.prototype, "headingDeg", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Telemetry.prototype, "timestamp", void 0);
exports.Telemetry = Telemetry = __decorate([
    (0, typeorm_1.Entity)('telemetry')
], Telemetry);
//# sourceMappingURL=telemetry.entity.js.map