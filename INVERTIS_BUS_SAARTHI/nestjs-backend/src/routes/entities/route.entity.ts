import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import type { User } from '../../users/entities/user.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  routeId: string;

  @Column({ length: 100 })
  routeName: string;

  @Column({ length: 30 })
  busNumber: string;

  @Column({ nullable: true, length: 50 })
  driverId: string;

  @Column({ type: 'text' })
  stops: string;

  @Column({ length: 50, default: 'Bareilly' })
  city: string;

  @Column({ nullable: true, length: 100 })
  vehicleModel: string;

  @Column({ nullable: true, length: 50 })
  registrationNumber: string;

  @Column({ type: 'int', nullable: true })
  seatingCapacity: number;

  @Column({ type: 'timestamptz', nullable: true })
  insuranceExpiry: Date;

  @Column({ type: 'int', default: 60 })
  speedLimit: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany('User', (user: User) => user.route)
  users: User[];
}
