import { Module } from '@nestjs/common';
import { ProcedureController } from './procedure.controller';
import { ProcedureService } from './procedure.service';
import { GisModule } from '../gis/gis.module';

@Module({
  imports: [GisModule],
  controllers: [ProcedureController],
  providers: [ProcedureService],
})
export class ProcedureModule {}