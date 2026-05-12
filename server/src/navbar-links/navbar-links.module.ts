import { Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';
import { NavbarLinksController } from './navbar-links.controller';
import { NavbarLinksService } from './navbar-links.service';

@Module({
  imports: [SessionModule],
  controllers: [NavbarLinksController],
  providers: [NavbarLinksService],
  exports: [NavbarLinksService],
})
export class NavbarLinksModule {}

