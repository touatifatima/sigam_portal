// notification.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Expert } from './expertminier';

// Map to the existing prisma-managed table
@Entity('notifications_portail')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  relatedEntityId: number;

  @Column({ nullable: true })
  relatedEntityType: string;

  @ManyToOne(() => Expert, { nullable: true })
  @JoinColumn({ name: 'expertId' })
  expert: Expert;

  @Column({ nullable: true })
  expertId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @Column({ default: 'info' })
  priority: string;
}
