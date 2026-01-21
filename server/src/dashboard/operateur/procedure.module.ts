import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ProcedureController } from '././procedure.controller';
import { ProcedureService } from './procedure.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../../auth/jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [ProcedureController],
  providers: [ProcedureService, PrismaService, JwtStrategy],
})
export class ProcedureOperateurModule {}
