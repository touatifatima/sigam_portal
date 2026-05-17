import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProcedureEtapeService } from 'src/procedure_etape/procedure-etape.service';
import { SessionModule } from 'src/session/session.module';
import { CessionController } from './cession.controller';
import { CessionService } from './cession.service';

@Module({
  imports: [SessionModule],
  controllers: [CessionController],
  providers: [CessionService, PrismaService, ProcedureEtapeService],
  exports: [CessionService],
})
export class CessionModule {}
