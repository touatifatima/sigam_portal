import { Module } from '@nestjs/common';
import { CessionModule } from '../cession/cession.module';
import { ProcedureController } from './procedure.controller';
import { ProcedureService } from './procedure.service';
import { GisModule } from '../gis/gis.module';

@Module({
  imports: [GisModule, CessionModule],
  controllers: [ProcedureController],
  providers: [ProcedureService],
})
export class ProcedureModule {}
