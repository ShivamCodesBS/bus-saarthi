"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrievancesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const grievances_service_1 = require("./grievances.service");
const grievances_controller_1 = require("./grievances.controller");
const grievance_entity_1 = require("./entities/grievance.entity");
const grievance_upvote_entity_1 = require("./entities/grievance-upvote.entity");
let GrievancesModule = class GrievancesModule {
};
exports.GrievancesModule = GrievancesModule;
exports.GrievancesModule = GrievancesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([grievance_entity_1.Grievance, grievance_upvote_entity_1.GrievanceUpvote])],
        controllers: [grievances_controller_1.GrievancesController],
        providers: [grievances_service_1.GrievancesService],
        exports: [grievances_service_1.GrievancesService],
    })
], GrievancesModule);
//# sourceMappingURL=grievances.module.js.map