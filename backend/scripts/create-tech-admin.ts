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

async function checkAndCreateTechAdmin() {
  await pgDataSource.initialize();
  const userRepository = pgDataSource.getRepository(User);
  
  const techAdminExists = await userRepository.findOne({ where: { role: UserRole.TECH_ADMIN } });
  
  if (!techAdminExists) {
    console.log('\nNo Tech Admin found. Creating default tech admin...');
    const hashedPassword = await bcrypt.hash('techadmin123', 10);
    const defaultTechAdmin = userRepository.create({
      loginId: 'techadmin',
      name: 'System Tech Admin',
      password: hashedPassword,
      role: UserRole.TECH_ADMIN,
      feeStatus: FeeStatus.PAID, // Reusing existing enum
    });
    await userRepository.save(defaultTechAdmin);
    console.log('Default tech admin created:');
    console.log('Login ID: techadmin');
    console.log('Password: techadmin123');
  } else {
    console.log('\nA tech admin user already exists. Login ID:', techAdminExists.loginId);
  }

  await pgDataSource.destroy();
}

checkAndCreateTechAdmin().catch(console.error);
