import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionModule } from 'src/session/session.module';
import { ProcedureExtensionPerimetreController } from './procedure-extension-perimetre.controller';
import { ProcedureExtensionPerimetreService } from './procedure-extension-perimetre.service';

@Module({
  imports: [SessionModule],
  controllers: [ProcedureExtensionPerimetreController],
  providers: [ProcedureExtensionPerimetreService, PrismaService],
})
export class ProcedureExtensionPerimetreModule {}
