import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import type { Route } from '../../routes/entities/route.entity';
import type { Attendance } from '../../attendance/entities/attendance.entity';

export enum UserRole {
  PASSENGER = 'passenger',
  ADMIN = 'admin',
  DRIVER = 'driver',
  TRANSPORT_INCHARGE = 'transport_incharge',
  TECH_ADMIN = 'tech_admin',
}

export enum FeeStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  loginId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ select: false })
  password?: string; // Optional because we might omit it when sending to client

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ nullable: true })
  routeId: string;

  @ManyToOne('Route', (route: Route) => route.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_id', referencedColumnName: 'routeId' })
  route: Route;

  @Column({ type: 'enum', enum: FeeStatus, default: FeeStatus.UNPAID })
  feeStatus: FeeStatus;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 100 })
  email: string;

  @Column({ type: 'text', nullable: true })
  profilePic: string;

  @Column({ nullable: true, length: 100 })
  designation: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogin: Date;

  @Column({ type: 'float', nullable: true })
  locationLat: number;

  @Column({ type: 'float', nullable: true })
  locationLng: number;

  // --- Driver Specific Fields ---
  @Column({ nullable: true, length: 50 })
  licenseNumber: string;

  @Column({ type: 'timestamptz', nullable: true })
  licenseExpiry: Date;

  @Column({ type: 'int', nullable: true })
  experienceYears: number;

  @Column({ nullable: true, length: 10 })
  bloodGroup: string;

  // --- Passenger Specific Fields ---
  @Column({ nullable: true, length: 100 })
  parentName: string;

  @Column({ nullable: true, length: 20 })
  parentPhone: string;

  @Column({ type: 'timestamptz', nullable: true })
  dob: Date;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true, length: 50 })
  gradeClass: string;

  @Column({ default: false })
  wakeAlarm: boolean;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  awsFaceId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  externalImageId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  s3ObjectKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  faceEnrolledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany('Attendance', (attendance: Attendance) => attendance.passenger)
  attendanceRecords: Attendance[];
}
