import { Module } from '@nestjs/common';
import { SocieteController } from './societe.controller';
import { SocieteService } from './societe.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [SessionModule],
  controllers: [SocieteController],
  providers: [SocieteService, PrismaService],
})
export class SocieteModule {}
