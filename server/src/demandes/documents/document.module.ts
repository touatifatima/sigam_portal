import { Module } from '@nestjs/common';
import { CessionModule } from 'src/cession/cession.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DocumentsReminderService } from './documents.reminder.service';

@Module({
  imports: [PrismaModule, CessionModule, NotificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsReminderService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
