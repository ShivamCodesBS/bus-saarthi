"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeavesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const leaves_service_1 = require("./leaves.service");
const leaves_controller_1 = require("./leaves.controller");
const leave_entity_1 = require("./entities/leave.entity");
const user_entity_1 = require("../users/entities/user.entity");
let LeavesModule = class LeavesModule {
};
exports.LeavesModule = LeavesModule;
exports.LeavesModule = LeavesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([leave_entity_1.Leave, user_entity_1.User])],
        controllers: [leaves_controller_1.LeavesController],
        providers: [leaves_service_1.LeavesService],
        exports: [leaves_service_1.LeavesService],
    })
], LeavesModule);
//# sourceMappingURL=leaves.module.js.map