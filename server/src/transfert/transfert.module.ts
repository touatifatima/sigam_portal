import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcedureEtapeService } from '../procedure_etape/procedure-etape.service';
import { SessionModule } from '../session/session.module';
import { TransfertController } from './transfert.controller';
import { TransfertService } from './transfert.service';

@Module({
  imports: [SessionModule],
  controllers: [TransfertController],
  providers: [TransfertService, PrismaService, ProcedureEtapeService],
})
export class TransfertModule {}
