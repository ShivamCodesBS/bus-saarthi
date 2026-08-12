import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GrievanceUpvote } from './grievance-upvote.entity';

export enum GrievanceStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

@Entity('grievances')
export class Grievance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  loginId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'login_id', referencedColumnName: 'loginId' })
  user: User;

  @Column({ length: 20 })
  route: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ length: 100, nullable: true })
  realName: string;

  @Column({ length: 50, nullable: true })
  type: string;

  @Column({ type: 'text', nullable: true })
  mediaUrl: string;

  @Column({ type: 'enum', enum: GrievanceStatus, default: GrievanceStatus.PENDING })
  status: GrievanceStatus;

  @Column({ type: 'int', default: 0 })
  upvotes: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => GrievanceUpvote, (upvote) => upvote.grievance)
  upvoteRecords: GrievanceUpvote[];
}
