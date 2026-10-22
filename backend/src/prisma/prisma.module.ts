import { Global, Module } from '@nestjs/common';
import { PrismaService, withSafePoolSize } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        // Cap the connection pool so it never exceeds what the database
        // provider allows. See `withSafePoolSize` for the details.
        process.env.DATABASE_URL = withSafePoolSize(process.env.DATABASE_URL);
        return new PrismaService();
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
