"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_module_1 = require("./config/config.module");
const database_module_1 = require("./database/database.module");
const queue_module_1 = require("./queue/queue.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const routes_module_1 = require("./routes/routes.module");
const attendance_module_1 = require("./attendance/attendance.module");
const face_recognition_module_1 = require("./face-recognition/face-recognition.module");
const grievances_module_1 = require("./grievances/grievances.module");
const telemetry_module_1 = require("./telemetry/telemetry.module");
const notifications_module_1 = require("./notifications/notifications.module");
const sos_module_1 = require("./sos/sos.module");
const leaves_module_1 = require("./leaves/leaves.module");
const gateway_module_1 = require("./gateway/gateway.module");
const upload_module_1 = require("./upload/upload.module");
const health_module_1 = require("./health/health.module");
const streams_module_1 = require("./streams/streams.module");
const throttler_1 = require("@nestjs/throttler");
const event_emitter_1 = require("@nestjs/event-emitter");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.AppConfigModule,
            database_module_1.DatabaseModule,
            queue_module_1.QueueModule,
            event_emitter_1.EventEmitterModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 100,
                }]),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            routes_module_1.RoutesModule,
            attendance_module_1.AttendanceModule,
            face_recognition_module_1.FaceRecognitionModule,
            grievances_module_1.GrievancesModule,
            telemetry_module_1.TelemetryModule,
            notifications_module_1.NotificationsModule,
            sos_module_1.SosModule,
            leaves_module_1.LeavesModule,
            gateway_module_1.GatewayModule,
            upload_module_1.UploadModule,
            health_module_1.HealthModule,
            streams_module_1.StreamsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map