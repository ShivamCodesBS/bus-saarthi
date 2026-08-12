import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('leaves')
@Unique(['loginId', 'date'])
export class Leave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  loginId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'login_id', referencedColumnName: 'loginId' })
  user: User;

  @Column({ type: 'date' })
  date: string; // Date string format YYYY-MM-DD
}
