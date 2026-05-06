import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from 'src/session/session.service';
import { StaticPagesService } from './static-pages.service';

class UpdateStaticPageDto {
  title?: string;
  content?: string;
  locale?: string;
}

class ManageStaticPageDto {
  locale?: string;
}

@Controller('api/static-pages')
export class StaticPagesController {
  constructor(
    private readonly staticPagesService: StaticPagesService,
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
      session.user.role?.rolePermissions?.map((rp: any) => rp.permission?.name) ?? [];
    const roleName = String(session.user.role?.name ?? '').toLowerCase();
    const isAdminByRole = roleName.includes('admin');
    const hasAdminPermission = permissions.includes('Admin-Panel');

    if (!isAdminByRole && !hasAdminPermission) {
      throw new ForbiddenException('Acces refuse');
    }

    return session;
  }

  @Get()
  async getAll(@Req() req: any, @Query('locale') locale?: string) {
    await this.assertAdminAccess(req);
    return this.staticPagesService.getAll(locale);
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.staticPagesService.getBySlug(slug, locale);
  }

  @Put(':slug')
  async updateBySlug(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: UpdateStaticPageDto,
  ) {
    const session = await this.assertAdminAccess(req);

    return this.staticPagesService.updateBySlug(slug, {
      title: body.title,
      content: body.content,
      locale: body.locale,
      updatedBy: String(session.user.id),
    });
  }

  @Post(':slug')
  async restoreBySlug(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: ManageStaticPageDto,
  ) {
    const session = await this.assertAdminAccess(req);

    return this.staticPagesService.restoreBySlug(slug, {
      locale: body.locale,
      updatedBy: String(session.user.id),
    });
  }

  @Delete(':slug')
  async clearBySlug(
    @Req() req: any,
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ) {
    const session = await this.assertAdminAccess(req);

    return this.staticPagesService.clearBySlug(slug, {
      locale,
      updatedBy: String(session.user.id),
    });
  }
}
