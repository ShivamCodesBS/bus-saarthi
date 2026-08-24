import { Module } from '@nestjs/common';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { User } from '@prisma/client';

@Module({
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
