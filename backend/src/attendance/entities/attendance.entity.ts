import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FeeStatus } from '../../users/entities/user.entity';
import type { User } from '../../users/entities/user.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'passenger_id', length: 50 })
  passengerId: string;

  @ManyToOne('User', (user: User) => user.attendanceRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'passenger_id', referencedColumnName: 'loginId' })
  passenger: User;

  @Column({ length: 20 })
  routeId: string;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ type: 'enum', enum: FeeStatus, nullable: true })
  feeStatus: FeeStatus;

  @Column({ type: 'real', nullable: true })
  confidence: number;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
