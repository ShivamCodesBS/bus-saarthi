import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grievance, GrievanceStatus } from './entities/grievance.entity';
import { GrievanceUpvote } from './entities/grievance-upvote.entity';

@Injectable()
export class GrievancesService {
  constructor(
    @InjectRepository(Grievance) private grievanceRepository: Repository<Grievance>,
    @InjectRepository(GrievanceUpvote) private upvoteRepository: Repository<GrievanceUpvote>,
  ) {}

  async create(loginId: string, text: string, type: string, mediaUrl?: string) {
    const grievance = this.grievanceRepository.create({
      loginId,
      route: '4', // Default or fetch from user
      text,
      type,
      mediaUrl,
    });
    await this.grievanceRepository.save(grievance);
    return { status: 'success', message: 'Grievance submitted successfully' };
  }

  async findAll() {
    return this.grievanceRepository.find({ order: { createdAt: 'DESC' } });
  }

  async upvote(id: string, loginId: string) {
    const grievance = await this.grievanceRepository.findOne({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');

    const existingUpvote = await this.upvoteRepository.findOne({ where: { grievanceId: id, loginId } });

    if (existingUpvote) {
      // Remove upvote
      await this.upvoteRepository.remove(existingUpvote);
      grievance.upvotes -= 1;
    } else {
      // Add upvote
      const upvote = this.upvoteRepository.create({ grievanceId: id, loginId });
      await this.upvoteRepository.save(upvote);
      grievance.upvotes += 1;
    }

    await this.grievanceRepository.save(grievance);
    return { status: 'success', upvotes: grievance.upvotes };
  }

  async resolve(id: string) {
    const grievance = await this.grievanceRepository.findOne({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');

    grievance.status = GrievanceStatus.RESOLVED;
    await this.grievanceRepository.save(grievance);
    return { status: 'success' };
  }

  async remove(id: string) {
    const grievance = await this.grievanceRepository.findOne({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');
    await this.grievanceRepository.remove(grievance);
    return { status: 'success', message: 'Grievance deleted' };
  }
}
