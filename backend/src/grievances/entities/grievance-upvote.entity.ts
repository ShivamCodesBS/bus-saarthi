import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Grievance } from './grievance.entity';
import { User } from '../../users/entities/user.entity';

@Entity('grievance_upvotes')
export class GrievanceUpvote {
  @PrimaryColumn({ type: 'uuid' })
  grievanceId: string;

  @PrimaryColumn({ length: 50 })
  loginId: string;

  @ManyToOne(() => Grievance, (grievance) => grievance.upvoteRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grievance_id' })
  grievance: Grievance;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'login_id', referencedColumnName: 'loginId' })
  user: User;
}
