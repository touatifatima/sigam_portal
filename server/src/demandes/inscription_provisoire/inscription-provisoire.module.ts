import { Module } from '@nestjs/common';
import { InscriptionProvisoireController } from './inscription-provisoire.controller';
import { InscriptionProvisoireService } from './inscription-provisoire.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordonneesModule } from '../cadastre/coordonnees.module';

@Module({
  imports: [CoordonneesModule],
  controllers: [InscriptionProvisoireController],
  providers: [InscriptionProvisoireService, PrismaService],
})
export class InscriptionProvisoireModule {}