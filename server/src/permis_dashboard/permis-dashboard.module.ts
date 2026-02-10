// src/procedure/procedure.module.ts
import { Module } from '@nestjs/common';
import { PermisDashboardController } from './permis-dashboard.controller';
import { PermisDashboardService } from './permis-dashboard.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DemandesDashboardService } from './demandes.service';
import { DemandesDashboardController } from './demandes.controller';
import { Permisdashboard2Service } from './permis.service';
import { PermisDashboard2Controller } from './permis.controller';
import { PermisPublicController } from './permis-public.controller';
import { PermisOperateurController } from './permis-operateur.controller';
import { SessionService } from '../session/session.service';
import { GisModule } from '../gis/gis.module';

@Module({
  imports: [GisModule],
  controllers: [
    PermisDashboardController,
    DemandesDashboardController,
    PermisDashboard2Controller,
    PermisPublicController,
    PermisOperateurController,
  ],
  providers: [
    PermisDashboardService,
    Permisdashboard2Service,
    DemandesDashboardService,
    PrismaService,
    SessionService,
  ],
})
export class PermisDashboardfModule {}
