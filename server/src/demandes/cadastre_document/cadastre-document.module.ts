import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SessionModule } from 'src/session/session.module';
import { CadastreDocumentController } from './cadastre-document.controller';
import { CadastreDocumentService } from './cadastre-document.service';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [CadastreDocumentController],
  providers: [CadastreDocumentService],
})
export class CadastreDocumentModule {}
