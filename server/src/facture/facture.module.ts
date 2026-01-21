import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FactureController } from './facture.controller';
import { FactureService } from './facture.service';

@Module({
  controllers: [FactureController],
  providers: [FactureService, PrismaService],
  exports: [FactureService],
})
export class FactureModule {}
