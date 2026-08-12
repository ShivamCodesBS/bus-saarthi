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
const mongodb_1 = require("mongodb");
const bcrypt = __importStar(require("bcrypt"));
const dotenv = __importStar(require("dotenv"));
const user_entity_1 = require("../src/users/entities/user.entity");
const route_entity_1 = require("../src/routes/entities/route.entity");
const attendance_entity_1 = require("../src/attendance/entities/attendance.entity");
const leave_entity_1 = require("../src/leaves/entities/leave.entity");
const grievance_entity_1 = require("../src/grievances/entities/grievance.entity");
const telemetry_entity_1 = require("../src/telemetry/entities/telemetry.entity");
const sos_alert_entity_1 = require("../src/sos/entities/sos-alert.entity");
const push_subscription_entity_1 = require("../src/notifications/entities/push-subscription.entity");
const broadcast_entity_1 = require("../src/notifications/entities/broadcast.entity");
dotenv.config();
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_saarthi_db';
const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bus_saarthi';
const pgDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: pgUrl,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
    synchronize: true,
});
async function runMigration() {
    console.log('Starting Migration from MongoDB to PostgreSQL...');
    await pgDataSource.initialize();
    console.log('Connected to PostgreSQL');
    const userRepository = pgDataSource.getRepository(user_entity_1.User);
    const routeRepository = pgDataSource.getRepository(route_entity_1.Route);
    const attendanceRepository = pgDataSource.getRepository(attendance_entity_1.Attendance);
    const leaveRepository = pgDataSource.getRepository(leave_entity_1.Leave);
    const grievanceRepository = pgDataSource.getRepository(grievance_entity_1.Grievance);
    const telemetryRepository = pgDataSource.getRepository(telemetry_entity_1.Telemetry);
    const sosAlertRepository = pgDataSource.getRepository(sos_alert_entity_1.SosAlert);
    const pushSubRepository = pgDataSource.getRepository(push_subscription_entity_1.PushSubscription);
    const broadcastRepository = pgDataSource.getRepository(broadcast_entity_1.Broadcast);
    const mongoClient = new mongodb_1.MongoClient(mongoUrl);
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    const db = mongoClient.db('bus_management_db');
    try {
        console.log('Migrating Routes...');
        const routesCollection = db.collection('routes');
        const oldRoutes = await routesCollection.find({}).toArray();
        for (const oldRoute of oldRoutes) {
            const routeIdentifier = oldRoute.routeId || oldRoute._id.toString();
            let route = await routeRepository.findOne({ where: { routeId: routeIdentifier } });
            if (!route) {
                route = routeRepository.create({
                    routeId: routeIdentifier,
                    routeName: oldRoute.routeName || 'Unknown Route',
                    busNumber: oldRoute.busNumber || 'Unknown Bus',
                    stops: oldRoute.stops ? JSON.stringify(oldRoute.stops) : '[]',
                });
                await routeRepository.save(route);
            }
        }
        console.log(`Migrated ${oldRoutes.length} Routes`);
        console.log('Migrating Users...');
        const usersCollection = db.collection('users');
        const oldUsers = await usersCollection.find({}).toArray();
        let migratedUsersCount = 0;
        for (const oldUser of oldUsers) {
            const userIdentifier = oldUser.loginId || oldUser.studentId || oldUser._id.toString();
            const exists = await userRepository.findOne({ where: { loginId: userIdentifier } });
            if (exists)
                continue;
            let finalPassword = oldUser.password || 'defaultPassword123';
            if (!finalPassword.startsWith('$2b$') && !finalPassword.startsWith('$2a$')) {
                finalPassword = await bcrypt.hash(finalPassword, 10);
            }
            let role = user_entity_1.UserRole.PASSENGER;
            if (oldUser.role === 'admin')
                role = user_entity_1.UserRole.ADMIN;
            if (oldUser.role === 'driver')
                role = user_entity_1.UserRole.DRIVER;
            if (oldUser.role === 'transport_incharge')
                role = user_entity_1.UserRole.TRANSPORT_INCHARGE;
            let feeStatus = user_entity_1.FeeStatus.UNPAID;
            if (oldUser.feeStatus === 'paid')
                feeStatus = user_entity_1.FeeStatus.PAID;
            if (oldUser.feeStatus === 'partial')
                feeStatus = user_entity_1.FeeStatus.PARTIAL;
            const newUser = userRepository.create({
                loginId: userIdentifier,
                name: oldUser.name || 'Unknown',
                password: finalPassword,
                role: role,
                routeId: oldUser.routeId || null,
                feeStatus: feeStatus,
                phone: oldUser.phone || null,
                email: oldUser.email || null,
                profilePic: oldUser.profilePic || null,
                designation: oldUser.designation || null,
                locationLat: oldUser.locationLat || null,
                locationLng: oldUser.locationLng || null,
                wakeAlarm: oldUser.wakeAlarm || false,
                awsFaceId: oldUser.awsFaceId || null,
            });
            await userRepository.save(newUser);
            migratedUsersCount++;
        }
        console.log(`Successfully migrated ${migratedUsersCount} Users and hashed passwords.`);
        console.log('Migrating Attendance...');
        const attCol = db.collection('attendance');
        const atts1 = await attCol.find({}).toArray();
        const attsCol2 = db.collection('attendances');
        const atts2 = await attsCol2.find({}).toArray();
        const allAtts = [...atts1, ...atts2];
        let attCount = 0;
        for (const oldAtt of allAtts) {
            if (!oldAtt.studentId)
                continue;
            const att = attendanceRepository.create({
                passengerId: oldAtt.studentId,
                routeId: oldAtt.routeId || 'Unknown',
                name: oldAtt.name || null,
                feeStatus: oldAtt.feeStatus === 'paid' ? user_entity_1.FeeStatus.PAID : oldAtt.feeStatus === 'partial' ? user_entity_1.FeeStatus.PARTIAL : user_entity_1.FeeStatus.UNPAID,
                confidence: oldAtt.confidence || null,
                timestamp: oldAtt.timestamp || oldAtt.createdAt || new Date()
            });
            await attendanceRepository.save(att);
            attCount++;
        }
        console.log(`Migrated ${attCount} Attendance records`);
        console.log('Migrating Leaves...');
        const leavesCol = db.collection('leaves');
        const oldLeaves = await leavesCol.find({}).toArray();
        let leaveCount = 0;
        for (const old of oldLeaves) {
            if (!old.loginId || !old.date)
                continue;
            const exists = await leaveRepository.findOne({ where: { loginId: old.loginId, date: old.date } });
            if (!exists) {
                const leave = leaveRepository.create({
                    loginId: old.loginId,
                    date: old.date
                });
                await leaveRepository.save(leave);
                leaveCount++;
            }
        }
        console.log(`Migrated ${leaveCount} Leaves`);
        console.log('Migrating Grievances...');
        const grCol = db.collection('grievances');
        const oldGr = await grCol.find({}).toArray();
        let grCount = 0;
        for (const old of oldGr) {
            if (!old.loginId)
                continue;
            const gr = grievanceRepository.create({
                loginId: old.loginId,
                route: old.route || 'Unknown',
                text: old.text || '',
                realName: old.realName || null,
                type: old.type || null,
                mediaUrl: old.mediaUrl || null,
                status: old.status === 'resolved' ? grievance_entity_1.GrievanceStatus.RESOLVED : grievance_entity_1.GrievanceStatus.PENDING,
                upvotes: old.upvotes || 0,
                createdAt: old.createdAt || old.timestamp || new Date()
            });
            await grievanceRepository.save(gr);
            grCount++;
        }
        console.log(`Migrated ${grCount} Grievances`);
        console.log('Migrating Telemetry...');
        const telCol = db.collection('telemetries');
        const oldTel = await telCol.find({}).toArray();
        console.log(`Found ${oldTel.length} Telemetry records`);
        let telCount = 0;
        const chunkSize = 500;
        for (let i = 0; i < oldTel.length; i += chunkSize) {
            const chunk = oldTel.slice(i, i + chunkSize);
            const telEntities = chunk.map(old => telemetryRepository.create({
                routeId: old.routeId || '4',
                latitude: old.latitude || null,
                longitude: old.longitude || null,
                gpsSpeedKnots: old.gpsSpeedKnots || null,
                mpuSpeedKmh: old.mpuSpeedKmh || null,
                headingDeg: old.headingDeg || null,
                timestamp: old.timestamp || old.createdAt || new Date()
            }));
            await telemetryRepository.insert(telEntities);
            telCount += telEntities.length;
            console.log(`Inserted ${telCount} / ${oldTel.length} Telemetry records`);
        }
        console.log(`Migrated ${telCount} Telemetry records`);
        console.log('Migrating SOS Alerts...');
        const sosCol = db.collection('sosalerts');
        const oldSos = await sosCol.find({}).toArray();
        let sosCount = 0;
        for (const old of oldSos) {
            if (!old.loginId)
                continue;
            const sos = sosAlertRepository.create({
                loginId: old.loginId,
                passenger: old.student || null,
                route: old.route || 'Unknown',
                time: old.time || old.createdAt || new Date()
            });
            await sosAlertRepository.save(sos);
            sosCount++;
        }
        console.log(`Migrated ${sosCount} SOS Alerts`);
        console.log('Migrating Push Subscriptions...');
        const pushCol = db.collection('pushsubscriptions');
        const oldPush = await pushCol.find({}).toArray();
        let pushCount = 0;
        for (const old of oldPush) {
            if (!old.loginId || !old.subscription)
                continue;
            const push = pushSubRepository.create({
                loginId: old.loginId,
                subscription: old.subscription,
                deviceType: old.deviceType || 'web'
            });
            await pushSubRepository.save(push);
            pushCount++;
        }
        console.log(`Migrated ${pushCount} Push Subscriptions`);
        console.log('Migrating Broadcasts...');
        const brCol = db.collection('broadcasts');
        const oldBr = await brCol.find({}).toArray();
        let brCount = 0;
        for (const old of oldBr) {
            if (!old.message)
                continue;
            const br = broadcastRepository.create({
                message: old.message,
                title: old.title || null,
                timestamp: old.timestamp || old.createdAt || new Date()
            });
            await broadcastRepository.save(br);
            brCount++;
        }
        console.log(`Migrated ${brCount} Broadcasts`);
        console.log('Full Extended Migration Complete!');
    }
    catch (err) {
        console.error('Migration failed:', err);
    }
    finally {
        await mongoClient.close();
        await pgDataSource.destroy();
    }
}
runMigration();
//# sourceMappingURL=migrate.js.map