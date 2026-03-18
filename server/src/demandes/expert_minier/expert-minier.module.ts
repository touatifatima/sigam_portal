import { Module } from '@nestjs/common';
import { ExpertMinierService } from './expert-minier.service';
import { ExpertMinierController } from './expert-minier.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ExpertMinierController],
  providers: [ExpertMinierService],
})
export class ExpertMinierModule {}

