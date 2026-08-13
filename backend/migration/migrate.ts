import { DataSource } from 'typeorm';
import { MongoClient } from 'mongodb';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User, UserRole, FeeStatus } from '../src/users/entities/user.entity';
import { Route } from '../src/routes/entities/route.entity';
import { Attendance } from '../src/attendance/entities/attendance.entity';
import { Leave } from '../src/leaves/entities/leave.entity';
import { Grievance, GrievanceStatus } from '../src/grievances/entities/grievance.entity';
import { Telemetry } from '../src/telemetry/entities/telemetry.entity';
import { SosAlert } from '../src/sos/entities/sos-alert.entity';
import { PushSubscription } from '../src/notifications/entities/push-subscription.entity';
import { Broadcast } from '../src/notifications/entities/broadcast.entity';

dotenv.config();

const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_saarthi_db';
const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bus_saarthi';

const pgDataSource = new DataSource({
  type: 'postgres',
  url: pgUrl,
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  synchronize: true, // Auto-create tables for the first time
});

async function runMigration() {
  console.log('Starting Migration from MongoDB to PostgreSQL...');

  // Connect Postgres
  await pgDataSource.initialize();
  console.log('Connected to PostgreSQL');
  const userRepository = pgDataSource.getRepository(User);
  const routeRepository = pgDataSource.getRepository(Route);
  const attendanceRepository = pgDataSource.getRepository(Attendance);
  const leaveRepository = pgDataSource.getRepository(Leave);
  const grievanceRepository = pgDataSource.getRepository(Grievance);
  const telemetryRepository = pgDataSource.getRepository(Telemetry);
  const sosAlertRepository = pgDataSource.getRepository(SosAlert);
  const pushSubRepository = pgDataSource.getRepository(PushSubscription);
  const broadcastRepository = pgDataSource.getRepository(Broadcast);

  // Connect MongoDB
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  console.log('Connected to MongoDB');
  const db = mongoClient.db('bus_management_db');

  try {
    // 1. Migrate Routes
    console.log('Migrating Routes...');
    const routesCollection = db.collection('routes'); // Assuming collection name 'routes'
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

    // 2. Migrate Users
    console.log('Migrating Users...');
    const usersCollection = db.collection('users'); // Assuming collection name 'users'
    const oldUsers = await usersCollection.find({}).toArray();

    let migratedUsersCount = 0;
    for (const oldUser of oldUsers) {
      // Check if exists
      const userIdentifier = oldUser.loginId || oldUser.studentId || oldUser._id.toString();
      const exists = await userRepository.findOne({ where: { loginId: userIdentifier } });
      if (exists) continue;

      // Ensure proper password hashing
      let finalPassword = oldUser.password || 'defaultPassword123';
      if (!finalPassword.startsWith('$2b$') && !finalPassword.startsWith('$2a$')) {
        // Not a bcrypt hash, needs hashing
        finalPassword = await bcrypt.hash(finalPassword, 10);
      }

      // Map roles
      let role = UserRole.PASSENGER;
      if (oldUser.role === 'admin') role = UserRole.ADMIN;
      if (oldUser.role === 'driver') role = UserRole.DRIVER;
      if (oldUser.role === 'transport_incharge') role = UserRole.TRANSPORT_INCHARGE;

      // Map Fee Status
      let feeStatus = FeeStatus.UNPAID;
      if (oldUser.feeStatus === 'paid') feeStatus = FeeStatus.PAID;
      if (oldUser.feeStatus === 'partial') feeStatus = FeeStatus.PARTIAL;

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

    // 3. Migrate Attendance
    console.log('Migrating Attendance...');
    const attCol = db.collection('attendance');
    const atts1 = await attCol.find({}).toArray();
    const attsCol2 = db.collection('attendances'); // Support both collection names
    const atts2 = await attsCol2.find({}).toArray();
    const allAtts = [...atts1, ...atts2];
    
    let attCount = 0;
    for (const oldAtt of allAtts) {
      if (!oldAtt.studentId) continue;
      const att = attendanceRepository.create({
        passengerId: oldAtt.studentId,
        routeId: oldAtt.routeId || 'Unknown',
        name: oldAtt.name || null,
        feeStatus: oldAtt.feeStatus === 'paid' ? FeeStatus.PAID : oldAtt.feeStatus === 'partial' ? FeeStatus.PARTIAL : FeeStatus.UNPAID,
        confidence: oldAtt.confidence || null,
        timestamp: oldAtt.timestamp || oldAtt.createdAt || new Date()
      });
      await attendanceRepository.save(att);
      attCount++;
    }
    console.log(`Migrated ${attCount} Attendance records`);

    // 4. Migrate Leaves
    console.log('Migrating Leaves...');
    const leavesCol = db.collection('leaves');
    const oldLeaves = await leavesCol.find({}).toArray();
    let leaveCount = 0;
    for (const old of oldLeaves) {
      if (!old.loginId || !old.date) continue;
      // Skip if exists (loginId + date unique)
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

    // 5. Migrate Grievances
    console.log('Migrating Grievances...');
    const grCol = db.collection('grievances');
    const oldGr = await grCol.find({}).toArray();
    let grCount = 0;
    for (const old of oldGr) {
      if (!old.loginId) continue;
      const gr = grievanceRepository.create({
        loginId: old.loginId,
        route: old.route || 'Unknown',
        text: old.text || '',
        realName: old.realName || null,
        type: old.type || null,
        mediaUrl: old.mediaUrl || null,
        status: old.status === 'resolved' ? GrievanceStatus.RESOLVED : GrievanceStatus.PENDING,
        upvotes: old.upvotes || 0,
        createdAt: old.createdAt || old.timestamp || new Date()
      });
      await grievanceRepository.save(gr);
      grCount++;
    }
    console.log(`Migrated ${grCount} Grievances`);

    // 6. Migrate Telemetries
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

    // 7. Migrate SosAlerts
    console.log('Migrating SOS Alerts...');
    const sosCol = db.collection('sosalerts');
    const oldSos = await sosCol.find({}).toArray();
    let sosCount = 0;
    for (const old of oldSos) {
      if (!old.loginId) continue;
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

    // 8. Migrate PushSubscriptions
    console.log('Migrating Push Subscriptions...');
    const pushCol = db.collection('pushsubscriptions');
    const oldPush = await pushCol.find({}).toArray();
    let pushCount = 0;
    for (const old of oldPush) {
      if (!old.loginId || !old.subscription) continue;
      const push = pushSubRepository.create({
        loginId: old.loginId,
        subscription: old.subscription,
        deviceType: old.deviceType || 'web'
      });
      await pushSubRepository.save(push);
      pushCount++;
    }
    console.log(`Migrated ${pushCount} Push Subscriptions`);

    // 9. Migrate Broadcasts
    console.log('Migrating Broadcasts...');
    const brCol = db.collection('broadcasts');
    const oldBr = await brCol.find({}).toArray();
    let brCount = 0;
    for (const old of oldBr) {
      if (!old.message) continue;
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

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoClient.close();
    await pgDataSource.destroy();
  }
}

runMigration();
