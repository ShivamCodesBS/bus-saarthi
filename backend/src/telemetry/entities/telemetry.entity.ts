import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('telemetry')
export class Telemetry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, default: '4' })
  routeId: string;

  @Column({ type: 'double precision', nullable: true })
  latitude: number;

  @Column({ type: 'double precision', nullable: true })
  longitude: number;

  @Column({ type: 'real', nullable: true })
  gpsSpeedKnots: number;

  @Column({ type: 'real', nullable: true })
  mpuSpeedKmh: number;

  @Column({ type: 'real', nullable: true })
  headingDeg: number;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
