// === fusion-permis.module.ts ===

import { Module } from '@nestjs/common';
import { FusionPermisController } from './fusion-permis.controller';
import { FusionPermisService } from './fusion-permis.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsModule } from 'src/demandes/documents/document.module';
import { GisService } from 'src/gis/gis.service';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [DocumentsModule, SessionModule],
  controllers: [FusionPermisController],
  providers: [FusionPermisService, PrismaService, GisService],
})
export class FusionPermisModule {}
