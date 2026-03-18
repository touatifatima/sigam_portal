import { Module } from '@nestjs/common';
import { InscriptionProvisoireController } from './inscription-provisoire.controller';
import { InscriptionProvisoireService } from './inscription-provisoire.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordonneesModule } from '../cadastre/coordonnees.module';
import { GisModule } from '../gis/gis.module';

@Module({
  imports: [CoordonneesModule, GisModule],
  controllers: [InscriptionProvisoireController],
  providers: [InscriptionProvisoireService, PrismaService],
})
export class InscriptionProvisoireModule {}
