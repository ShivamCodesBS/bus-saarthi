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

async function checkAndCreateAdmin() {
  await pgDataSource.initialize();
  const userRepository = pgDataSource.getRepository(User);
  
  const users = await userRepository.find({ take: 5 });
  console.log('Existing users in DB:');
  for (const u of users) {
    console.log(`- Login ID: ${u.loginId}, Role: ${u.role}, Name: ${u.name}`);
  }

  const adminExists = await userRepository.findOne({ where: { role: UserRole.ADMIN } });
  
  if (!adminExists) {
    console.log('\nNo Admin found. Creating default admin...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const defaultAdmin = userRepository.create({
      loginId: 'admin',
      name: 'System Admin',
      password: hashedPassword,
      role: UserRole.ADMIN,
      feeStatus: FeeStatus.PAID,
    });
    await userRepository.save(defaultAdmin);
    console.log('Default admin created:');
    console.log('Login ID: admin');
    console.log('Password: admin123');
  } else {
    console.log('\nAn admin user already exists. If you forgot the password, we can reset it.');
  }

  await pgDataSource.destroy();
}

checkAndCreateAdmin().catch(console.error);
