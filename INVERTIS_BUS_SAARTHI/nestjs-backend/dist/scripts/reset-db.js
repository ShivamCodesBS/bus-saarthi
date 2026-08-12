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
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
const user_entity_1 = require("../src/users/entities/user.entity");
const route_entity_1 = require("../src/routes/entities/route.entity");
const attendance_entity_1 = require("../src/attendance/entities/attendance.entity");
const leave_entity_1 = require("../src/leaves/entities/leave.entity");
const grievance_entity_1 = require("../src/grievances/entities/grievance.entity");
const grievance_upvote_entity_1 = require("../src/grievances/entities/grievance-upvote.entity");
const telemetry_entity_1 = require("../src/telemetry/entities/telemetry.entity");
const sos_alert_entity_1 = require("../src/sos/entities/sos-alert.entity");
const push_subscription_entity_1 = require("../src/notifications/entities/push-subscription.entity");
const broadcast_entity_1 = require("../src/notifications/entities/broadcast.entity");
dotenv.config();
const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pgDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: pgUrl,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
    synchronize: false,
});
async function resetData() {
    await pgDataSource.initialize();
    console.log('Connected to DB. Starting reset...');
    console.log('Deleting Attendance records...');
    await pgDataSource.createQueryBuilder().delete().from(attendance_entity_1.Attendance).execute();
    console.log('Deleting Leave records...');
    await pgDataSource.createQueryBuilder().delete().from(leave_entity_1.Leave).execute();
    console.log('Deleting Grievance Upvotes...');
    await pgDataSource.createQueryBuilder().delete().from(grievance_upvote_entity_1.GrievanceUpvote).execute();
    console.log('Deleting Grievance records...');
    await pgDataSource.createQueryBuilder().delete().from(grievance_entity_1.Grievance).execute();
    console.log('Deleting Telemetry records...');
    await pgDataSource.createQueryBuilder().delete().from(telemetry_entity_1.Telemetry).execute();
    console.log('Deleting SOS Alerts...');
    await pgDataSource.createQueryBuilder().delete().from(sos_alert_entity_1.SosAlert).execute();
    console.log('Deleting Push Subscriptions...');
    await pgDataSource.createQueryBuilder().delete().from(push_subscription_entity_1.PushSubscription).execute();
    console.log('Deleting Broadcasts...');
    await pgDataSource.createQueryBuilder().delete().from(broadcast_entity_1.Broadcast).execute();
    console.log('Deleting all non-admin users...');
    const userRepository = pgDataSource.getRepository(user_entity_1.User);
    await pgDataSource.createQueryBuilder().delete().from(user_entity_1.User).where("role != :role", { role: user_entity_1.UserRole.ADMIN }).execute();
    console.log('Deleting all routes...');
    await pgDataSource.createQueryBuilder().delete().from(route_entity_1.Route).execute();
    console.log('✅ All data has been reset successfully!');
    const admins = await userRepository.find({ where: { role: user_entity_1.UserRole.ADMIN } });
    console.log('Remaining Admins:', admins.map(a => a.loginId));
    await pgDataSource.destroy();
}
resetData().catch(console.error);
//# sourceMappingURL=reset-db.js.map