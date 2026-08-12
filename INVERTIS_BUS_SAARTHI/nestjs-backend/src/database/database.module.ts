import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('database.postgres.url'),
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('database.postgres.synchronize'),
      }),
    }),
  ],
})
export class DatabaseModule {}
