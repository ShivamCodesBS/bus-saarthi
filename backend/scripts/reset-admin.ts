import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User, UserRole, FeeStatus } from '../src/users/entities/user.entity';

dotenv.config();

const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pgDataSource = new DataSource({
  type: 'postgres',
  url: pgUrl,
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function resetAdmin() {
  await pgDataSource.initialize();
  const userRepository = pgDataSource.getRepository(User);
  
  const admin = await userRepository.findOne({ where: { role: UserRole.ADMIN } });
  
  if (admin) {
    admin.loginId = 'admin';
    admin.password = await bcrypt.hash('admin123', 10);
    await userRepository.save(admin);
    console.log('Admin user successfully reset!');
    console.log('Login ID: admin');
    console.log('Password: admin123');
  } else {
    console.log('No admin found. Creating one...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const defaultAdmin = userRepository.create({
      loginId: 'admin',
      name: 'System Admin',
      password: hashedPassword,
      role: UserRole.ADMIN,
      feeStatus: FeeStatus.PAID,
    });
    await userRepository.save(defaultAdmin);
    console.log('Default admin created!');
    console.log('Login ID: admin');
    console.log('Password: admin123');
  }

  // Also create a passenger for testing
  const passenger = await userRepository.findOne({ where: { role: UserRole.PASSENGER } });
  if (passenger) {
    passenger.loginId = 'passenger';
    passenger.password = await bcrypt.hash('passenger123', 10);
    await userRepository.save(passenger);
    console.log('\nPassenger user successfully reset!');
    console.log('Login ID: passenger');
    console.log('Password: passenger123');
  } else {
    console.log('\nNo passenger found. Creating one...');
    const hashedPassword = await bcrypt.hash('passenger123', 10);
    const defaultPassenger = userRepository.create({
      loginId: 'passenger',
      name: 'Test Passenger',
      password: hashedPassword,
      role: UserRole.PASSENGER,
      routeId: '4',
      feeStatus: FeeStatus.PAID,
    });
    await userRepository.save(defaultPassenger);
    console.log('Default passenger created!');
    console.log('Login ID: passenger');
    console.log('Password: passenger123');
  }

  await pgDataSource.destroy();
}

resetAdmin().catch(console.error);
