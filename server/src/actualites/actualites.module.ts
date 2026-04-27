import { Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';
import { ActualitesController } from './actualites.controller';
import { ActualitesService } from './actualites.service';

@Module({
  imports: [SessionModule],
  controllers: [ActualitesController],
  providers: [ActualitesService],
})
export class ActualitesModule {}
