import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcedureEtapeService } from '../procedure_etape/procedure-etape.service';
import { TransfertController } from './transfert.controller';
import { TransfertService } from './transfert.service';

@Module({
  controllers: [TransfertController],
  providers: [TransfertService, PrismaService, ProcedureEtapeService],
})
export class TransfertModule {}
