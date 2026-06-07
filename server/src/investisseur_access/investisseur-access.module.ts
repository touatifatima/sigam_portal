import { Module } from '@nestjs/common';
import { OperatorAccessModule } from '../operator_access/operator-access.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../session/session.module';
import { InvestisseurAccessController } from './investisseur-access.controller';

@Module({
  imports: [OperatorAccessModule, PrismaModule, SessionModule],
  controllers: [InvestisseurAccessController],
})
export class InvestisseurAccessModule {}
