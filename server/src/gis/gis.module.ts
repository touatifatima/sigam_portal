import { Module } from '@nestjs/common';
import { GisService } from './gis.service';
import { GisController } from './gis.controller';

@Module({
  providers: [GisService],
  controllers: [GisController],
  exports: [GisService],
})
export class GisModule {}