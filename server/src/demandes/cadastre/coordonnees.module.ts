import { Module } from '@nestjs/common';
import { CoordonneesController } from './coordonee.controller';
import { CoordonneesService } from './coordonnees.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GisModule } from '../../gis/gis.module';

@Module({
  imports: [GisModule],
  controllers: [CoordonneesController],
  providers: [CoordonneesService, PrismaService],
  exports: [CoordonneesService],
})
export class CoordonneesModule {}