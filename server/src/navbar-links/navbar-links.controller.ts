import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from 'src/session/session.service';
import {
  NavbarLinksService,
  NavbarQuickLinkInput,
} from './navbar-links.service';

class NavbarQuickLinkDto implements NavbarQuickLinkInput {
  key?: string;
  label?: string;
  href?: string;
  description?: string | null;
  icon?: string | null;
  section?: string;
  sortOrder?: number;
  isActive?: boolean;
  showForAdmin?: boolean;
  showForOperateur?: boolean;
  showForInvestisseur?: boolean;
  requiredPermission?: string | null;
}

@Controller('api/navbar-links')
export class NavbarLinksController {
  constructor(
    private readonly navbarLinksService: NavbarLinksService,
    private readonly sessionService: SessionService,
  ) {}

  private async getOptionalSessionUser(req: any) {
    const token = req?.cookies?.auth_token;
    if (!token) return null;

    const session = await this.sessionService.validateSession(token);
    if (!session?.user?.id) return null;

    return session.user;
  }

  private async assertAdminAccess(req: any) {
    const token = req?.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Non authentifie');
    }

    const session = await this.sessionService.validateSession(token);
    if (!session?.user?.id) {
      throw new UnauthorizedException('Session invalide');
    }

    const permissions =
      session.user.role?.rolePermissions?.map((rp: any) => rp.permission?.name) ?? [];
    const roleName = String(session.user.role?.name ?? '').toLowerCase();
    const isAdminByRole = roleName.includes('admin');
    const hasAdminPermission = permissions.includes('Admin-Panel');

    if (!isAdminByRole && !hasAdminPermission) {
      throw new ForbiddenException('Acces refuse');
    }
  }

  @Get('visible')
  async getVisibleLinks(@Req() req: any) {
    const user = await this.getOptionalSessionUser(req);
    return this.navbarLinksService.getVisibleForUser(user);
  }

  @Get('admin/all')
  async getAllForAdmin(@Req() req: any) {
    await this.assertAdminAccess(req);
    return this.navbarLinksService.getAllForAdmin();
  }

  @Post('admin')
  async createForAdmin(@Req() req: any, @Body() body: NavbarQuickLinkDto) {
    await this.assertAdminAccess(req);
    return this.navbarLinksService.createForAdmin(body);
  }

  @Patch('admin/:id')
  async updateForAdmin(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: NavbarQuickLinkDto,
  ) {
    await this.assertAdminAccess(req);
    return this.navbarLinksService.updateForAdmin(id, body);
  }

  @Delete('admin/:id')
  async deleteForAdmin(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertAdminAccess(req);
    return this.navbarLinksService.deleteForAdmin(id);
  }
}

