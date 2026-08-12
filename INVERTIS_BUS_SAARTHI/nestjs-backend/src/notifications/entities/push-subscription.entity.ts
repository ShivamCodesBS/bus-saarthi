import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  loginId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'login_id', referencedColumnName: 'loginId' })
  user: User;

  @Column({ type: 'jsonb' })
  subscription: any;

  @Column({ length: 20, default: 'web' })
  deviceType: string;
}
