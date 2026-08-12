import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrievancesService } from './grievances.service';
import { GrievancesController } from './grievances.controller';
import { Grievance } from './entities/grievance.entity';
import { GrievanceUpvote } from './entities/grievance-upvote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Grievance, GrievanceUpvote])],
  controllers: [GrievancesController],
  providers: [GrievancesService],
  exports: [GrievancesService],
})
export class GrievancesModule {}
