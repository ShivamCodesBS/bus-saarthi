import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('broadcasts')
export class Broadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ length: 200, nullable: true })
  title: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
