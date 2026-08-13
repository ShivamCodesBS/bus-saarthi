import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sos_alerts')
export class SosAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  loginId: string;

  @Column({ length: 100, nullable: true })
  passenger: string;

  @Column({ length: 20 })
  route: string;

  @CreateDateColumn({ type: 'timestamptz' })
  time: Date;
}
