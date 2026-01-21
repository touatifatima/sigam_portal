// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // ← Important : rend PrismaService disponible partout sans ré-importer
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}