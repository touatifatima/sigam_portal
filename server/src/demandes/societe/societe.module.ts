import { Module } from '@nestjs/common';
import { SocieteController } from './societe.controller';
import { SocieteService } from './societe.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionModule } from 'src/session/session.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [SessionModule, NotificationsModule],
  controllers: [SocieteController],
  providers: [SocieteService, PrismaService],
})
export class SocieteModule {}
