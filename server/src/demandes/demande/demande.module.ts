import { Module } from '@nestjs/common';
import { DemandesController } from './demande.controller';
import { DemandeService } from './demande.service';
import { FactureModule } from 'src/facture/facture.module';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [FactureModule, SessionModule],
  controllers: [DemandesController],
  providers: [DemandeService],
})
export class DemandesModule {}
