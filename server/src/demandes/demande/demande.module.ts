import { Module } from '@nestjs/common';
import { DemandesController } from './demande.controller';
import { DemandeService } from './demande.service';
import { FactureModule } from 'src/facture/facture.module';

@Module({
  imports: [FactureModule],
  controllers: [DemandesController],
  providers: [DemandeService],
})
export class DemandesModule {}
