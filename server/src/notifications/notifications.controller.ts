import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Observable, from, interval, map, startWith, switchMap } from 'rxjs';

type SseMessageEvent = {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
};

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private parseListQuery(value?: string | string[]) {
    if (!value) return [] as string[];
    const list = Array.isArray(value) ? value : [value];
    return list
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseBooleanQuery(value?: string) {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'oui'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non'].includes(normalized)) return false;
    return null;
  }

  private extractUserIdFromRequest(req: any, fallbackUserId?: number) {
    if (Number.isFinite(fallbackUserId) && Number(fallbackUserId) > 0) {
      return Number(fallbackUserId);
    }

    const userIdHeader = req?.headers?.['x-user-id'];
    if (userIdHeader) {
      const parsed = parseInt(String(userIdHeader), 10);
      if (!Number.isNaN(parsed)) return parsed;
    }

    const reqUserId = req?.user?.id ?? req?.user?.sub;
    if (Number.isFinite(Number(reqUserId))) {
      return Number(reqUserId);
    }

    const sessionUserId = req?.session?.userId;
    if (Number.isFinite(Number(sessionUserId))) {
      return Number(sessionUserId);
    }

    const authHeader = req?.headers?.authorization;
    if (authHeader && String(authHeader).startsWith('Bearer ')) {
      const token = String(authHeader).substring(7);
      if (token && token !== 'null') {
        try {
          const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64').toString(),
          );
          const tokenUserId = payload?.id ?? payload?.sub;
          if (Number.isFinite(Number(tokenUserId))) {
            return Number(tokenUserId);
          }
        } catch {
          // ignore malformed token
        }
      }
    }

    throw new UnauthorizedException('Utilisateur non authentifie');
  }

  private async assertAdminAccess(req: any) {
    const userId = this.extractUserIdFromRequest(req);
    const permissions = Array.isArray(req?.user?.permissions)
      ? req.user.permissions
      : [];
    const hasAdminPermission = permissions.includes('Admin-Panel');
    if (hasAdminPermission) return userId;

    const isAdmin = await this.notificationsService.isAdminUser(userId);
    if (!isAdmin) {
      throw new ForbiddenException('Acces refuse');
    }
    return userId;
  }

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    const userId = this.extractUserIdFromRequest(req);
    return this.notificationsService.listUserNotifications({
      userId,
      unreadOnly:
        unreadOnly === 'true' || unreadOnly === '1' || unreadOnly === 'yes',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      type,
      category,
    });
  }

  @Get('recent')
  async getRecentNotifications(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const userId = this.extractUserIdFromRequest(req);
    return this.notificationsService.getRecentNotifications(
      userId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserIdFromRequest(req);
    await this.notificationsService.markAsRead(userId, parseInt(id, 10));
    const count = await this.notificationsService.getUnreadCount(userId);
    return { success: true, count };
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = this.extractUserIdFromRequest(req);
    await this.notificationsService.markAllAsRead(userId);
    return { success: true, count: 0 };
  }

  @Get('count')
  async getUnreadCount(@Req() req: any) {
    const userId = this.extractUserIdFromRequest(req);
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Sse('sse')
  sse(
    @Req() req: any,
    @Query('userId') userId?: string,
  ): Observable<SseMessageEvent> {
    const fallbackUserId = userId ? Number(userId) : undefined;
    const resolvedUserId = this.extractUserIdFromRequest(req, fallbackUserId);

    return interval(5000).pipe(
      startWith(0),
      switchMap(() =>
        from(this.notificationsService.getUnreadCount(resolvedUserId)).pipe(
          map((count) => ({
            data: { count, timestamp: new Date().toISOString() },
          })),
        ),
      ),
    );
  }

  @Get('admin')
  async getAdminNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('userQuery') userQuery?: string,
    @Query('type') type?: string | string[],
    @Query('category') category?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('isRead') isRead?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    await this.assertAdminAccess(req);
    return this.notificationsService.listAdminNotifications({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search ? String(search) : undefined,
      userQuery: userQuery ? String(userQuery) : undefined,
      type: this.parseListQuery(type),
      category: this.parseListQuery(category),
      priority: this.parseListQuery(priority),
      isRead: this.parseBooleanQuery(isRead),
      fromDate: fromDate ? String(fromDate) : undefined,
      toDate: toDate ? String(toDate) : undefined,
      sortBy: sortBy ? String(sortBy) : undefined,
      sortOrder:
        String(sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc',
    });
  }

  @Get('admin/stats')
  async getAdminStats(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('userQuery') userQuery?: string,
    @Query('type') type?: string | string[],
    @Query('category') category?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('isRead') isRead?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    await this.assertAdminAccess(req);
    return this.notificationsService.getAdminStats({
      search: search ? String(search) : undefined,
      userQuery: userQuery ? String(userQuery) : undefined,
      type: this.parseListQuery(type),
      category: this.parseListQuery(category),
      priority: this.parseListQuery(priority),
      isRead: this.parseBooleanQuery(isRead),
      fromDate: fromDate ? String(fromDate) : undefined,
      toDate: toDate ? String(toDate) : undefined,
    });
  }

  @Get('admin/:id')
  async getAdminNotificationById(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertAdminAccess(req);
    return this.notificationsService.getAdminNotificationById(id);
  }

  @Post('admin/:id/read')
  async setAdminReadState(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: { isRead?: boolean },
  ) {
    await this.assertAdminAccess(req);
    const isRead =
      body && typeof body.isRead === 'boolean' ? body.isRead : true;
    const item = await this.notificationsService.setAdminReadState(id, isRead);
    return { success: true, item };
  }

  @Delete('admin/:id')
  async deleteAdminNotification(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertAdminAccess(req);
    return this.notificationsService.deleteAdminNotification(id);
  }

  @Post('admin/bulk')
  async bulkAdminAction(
    @Req() req: any,
    @Body()
    body: { ids?: number[]; action?: 'mark_read' | 'mark_unread' | 'delete' },
  ) {
    await this.assertAdminAccess(req);
    const action = String(body?.action || '').trim().toLowerCase();
    if (!['mark_read', 'mark_unread', 'delete'].includes(action)) {
      throw new BadRequestException(
        'Action invalide (mark_read | mark_unread | delete)',
      );
    }
    return this.notificationsService.bulkAdminAction(
      Array.isArray(body?.ids) ? body.ids : [],
      action as 'mark_read' | 'mark_unread' | 'delete',
    );
  }
}
