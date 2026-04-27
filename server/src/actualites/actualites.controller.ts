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
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from 'src/session/session.service';
import { ActualitesService } from './actualites.service';

type ActualiteMutationInput = {
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  author?: string;
  imageUrl?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
};

@Controller('api/actualites')
export class ActualitesController {
  constructor(
    private readonly actualitesService: ActualitesService,
    private readonly sessionService: SessionService,
  ) {}

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
      session.user.role?.rolePermissions?.map((rp: any) => rp.permission?.name) ??
      [];
    const roleName = String(session.user.role?.name ?? '').toLowerCase();
    const isAdminByRole = roleName.includes('admin');
    const hasAdminPermission = permissions.includes('Admin-Panel');

    if (!isAdminByRole && !hasAdminPermission) {
      throw new ForbiddenException('Acces refuse');
    }
  }

  @Get()
  async getPublicActualites(
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.actualitesService.getPublicActualites({ search, category });
  }

  @Get('admin/all')
  async getAdminActualites(@Req() req: any) {
    await this.assertAdminAccess(req);
    return this.actualitesService.getAdminActualites();
  }

  @Post('admin')
  async createActualite(@Req() req: any, @Body() body: ActualiteMutationInput) {
    await this.assertAdminAccess(req);
    return this.actualitesService.createActualite(body);
  }

  @Patch('admin/:id')
  async updateActualite(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActualiteMutationInput,
  ) {
    await this.assertAdminAccess(req);
    return this.actualitesService.updateActualite(id, body);
  }

  @Delete('admin/:id')
  async deleteActualite(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertAdminAccess(req);
    return this.actualitesService.deleteActualite(id);
  }

  @Post('admin/reset')
  async resetActualites(@Req() req: any) {
    await this.assertAdminAccess(req);
    return this.actualitesService.resetActualites();
  }
}
