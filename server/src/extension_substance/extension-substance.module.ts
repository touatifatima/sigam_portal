import { Module } from '@nestjs/common';
import { ExtensionSubstanceController } from './extension-substance.controller';
import { ExtensionSubstanceService } from './extension-substance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [ExtensionSubstanceController],
  providers: [ExtensionSubstanceService],
})
export class ExtensionSubstanceModule {}
