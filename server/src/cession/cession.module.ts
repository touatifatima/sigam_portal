import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProcedureEtapeService } from 'src/procedure_etape/procedure-etape.service';
import { CessionController } from './cession.controller';
import { CessionService } from './cession.service';

@Module({
  controllers: [CessionController],
  providers: [CessionService, PrismaService, ProcedureEtapeService],
  exports: [CessionService],
})
export class CessionModule {}
