import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SessionModule } from 'src/session/session.module';
import { ProcedureDeclarationsController } from './procedure-declarations.controller';
import { ProcedureDeclarationsService } from './procedure-declarations.service';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [ProcedureDeclarationsController],
  providers: [ProcedureDeclarationsService],
})
export class ProcedureDeclarationsModule {}
