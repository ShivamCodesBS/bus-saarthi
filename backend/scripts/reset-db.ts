import { DataSource, Not } from 'typeorm';
import * as dotenv from 'dotenv';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Route } from '../src/routes/entities/route.entity';
import { Attendance } from '../src/attendance/entities/attendance.entity';
import { Leave } from '../src/leaves/entities/leave.entity';
import { Grievance } from '../src/grievances/entities/grievance.entity';
import { GrievanceUpvote } from '../src/grievances/entities/grievance-upvote.entity';
import { Telemetry } from '../src/telemetry/entities/telemetry.entity';
import { SosAlert } from '../src/sos/entities/sos-alert.entity';
import { PushSubscription } from '../src/notifications/entities/push-subscription.entity';
import { Broadcast } from '../src/notifications/entities/broadcast.entity';

dotenv.config();

const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pgDataSource = new DataSource({
  type: 'postgres',
  url: pgUrl,
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function resetData() {
  await pgDataSource.initialize();
  console.log('Connected to DB. Starting reset...');

  // Delete everything from dependent/other tables
  console.log('Deleting Attendance records...');
  await pgDataSource.createQueryBuilder().delete().from(Attendance).execute();

  console.log('Deleting Leave records...');
  await pgDataSource.createQueryBuilder().delete().from(Leave).execute();

  console.log('Deleting Grievance Upvotes...');
  await pgDataSource.createQueryBuilder().delete().from(GrievanceUpvote).execute();

  console.log('Deleting Grievance records...');
  await pgDataSource.createQueryBuilder().delete().from(Grievance).execute();

  console.log('Deleting Telemetry records...');
  await pgDataSource.createQueryBuilder().delete().from(Telemetry).execute();

  console.log('Deleting SOS Alerts...');
  await pgDataSource.createQueryBuilder().delete().from(SosAlert).execute();

  console.log('Deleting Push Subscriptions...');
  await pgDataSource.createQueryBuilder().delete().from(PushSubscription).execute();

  console.log('Deleting Broadcasts...');
  await pgDataSource.createQueryBuilder().delete().from(Broadcast).execute();

  // Delete all users EXCEPT admin
  console.log('Deleting all non-admin users...');
  const userRepository = pgDataSource.getRepository(User);
  await pgDataSource.createQueryBuilder().delete().from(User).where("role != :role", { role: UserRole.ADMIN }).execute();

  // Delete all routes
  console.log('Deleting all routes...');
  await pgDataSource.createQueryBuilder().delete().from(Route).execute();

  console.log('✅ All data has been reset successfully!');
  
  // Verify Admin remains
  const admins = await userRepository.find({ where: { role: UserRole.ADMIN } });
  console.log('Remaining Admins:', admins.map(a => a.loginId));

  await pgDataSource.destroy();
}

resetData().catch(console.error);
