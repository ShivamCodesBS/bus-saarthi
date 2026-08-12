import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { User, FeeStatus } from '../users/entities/user.entity';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private eventEmitter: EventEmitter2,
  ) {}

  async syncAttendance(syncDto: SyncAttendanceDto) {
    const { route_id, records } = syncDto;
    
    if (!records || records.length === 0) {
      throw new BadRequestException('No records to sync');
    }

    const todayStart = getISTMidnightUTC();
    const results = { synced: 0, skipped: 0, errors: 0 };

    for (const record of records) {
      try {
        // Prevent duplicate check
        const existing = await this.attendanceRepository.createQueryBuilder('att')
          .where('att.passengerId = :passengerId', { passengerId: record.passenger_id })
          .andWhere('att.timestamp >= :todayStart', { todayStart })
          .getOne();

        if (existing) {
          results.skipped++;
          continue;
        }

        const passenger = await this.usersRepository.findOne({ where: { loginId: record.passenger_id } });
        if (!passenger) {
          results.errors++;
          continue;
        }

        const newAttendance = this.attendanceRepository.create({
          passengerId: passenger.loginId,
          routeId: route_id,
          name: passenger.name,
          feeStatus: passenger.feeStatus,
          confidence: record.confidence || undefined,
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
        });

        await this.attendanceRepository.save(newAttendance);
        results.synced++;

        // Emit event for real-time gateway (to be handled in Gateway module)
        this.eventEmitter.emit('attendance.marked', {
          passenger_id: passenger.loginId,
          name: passenger.name,
          route_id: route_id,
          fee_status: passenger.feeStatus,
        });

      } catch (err) {
        console.error(`Error syncing attendance for ${record.passenger_id}:`, err);
        results.errors++;
      }
    }

    return {
      status: 'success',
      ...results,
    };
  }

  async getAllAttendanceToday() {
    const todayStart = getISTMidnightUTC();
    return this.attendanceRepository.createQueryBuilder('att')
      .where('att.timestamp >= :todayStart', { todayStart })
      .orderBy('att.timestamp', 'DESC')
      .getMany();
  }

  async getAttendanceForRoute(routeId: string) {
    const todayStart = getISTMidnightUTC();
    return this.attendanceRepository.createQueryBuilder('att')
      .where('att.routeId = :routeId', { routeId })
      .andWhere('att.timestamp >= :todayStart', { todayStart })
      .orderBy('att.timestamp', 'DESC')
      .getMany();
  }

  async getAttendanceForUser(loginId: string) {
    return this.attendanceRepository.createQueryBuilder('att')
      .where('att.passengerId = :loginId', { loginId })
      .orderBy('att.timestamp', 'DESC')
      .limit(30)
      .getMany();
  }
}
