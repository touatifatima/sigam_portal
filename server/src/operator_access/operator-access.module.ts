import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../session/session.module';
import { OperatorAccessController } from './operator-access.controller';
import { OperatorAccessService } from './operator-access.service';

@Module({
  imports: [PrismaModule, SessionModule, AuthModule],
  controllers: [OperatorAccessController],
  providers: [OperatorAccessService],
})
export class OperatorAccessModule {}
