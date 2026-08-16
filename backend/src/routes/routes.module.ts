import { Module } from '@nestjs/common';

import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';

import { User } from '@prisma/client';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
