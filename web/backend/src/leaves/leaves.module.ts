import { Module } from '@nestjs/common';

import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';

import { User } from '@prisma/client';

@Module({
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
