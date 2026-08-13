import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave } from './entities/leave.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave) private leaveRepository: Repository<Leave>,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async markLeave(loginId: string, dateStr: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user || user.role !== UserRole.PASSENGER) {
      throw new BadRequestException('Only passengers can mark leaves');
    }

    try {
      const leave = this.leaveRepository.create({ loginId, date: dateStr });
      await this.leaveRepository.save(leave);
      return { status: 'success', message: 'Leave marked' };
    } catch (error) {
      if (error.code === '23505') { // Postgres unique constraint violation
        return { status: 'success', message: 'Leave already marked for this date' };
      }
      throw error;
    }
  }

  async cancelLeave(loginId: string, dateStr: string) {
    await this.leaveRepository.delete({ loginId, date: dateStr });
    return { status: 'success', message: 'Leave cancelled' };
  }
}
