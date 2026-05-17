import {
  NotificationCategory,
  NotificationPriority,
  Prisma,
  TypeNotification,
} from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type NotificationListParams = {
  userId: number;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
  type?: string;
  category?: string;
};

type AdminNotificationListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  userQuery?: string;
  type?: string[];
  category?: string[];
  priority?: string[];
  isRead?: boolean | null;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

type AdminBulkAction = 'mark_read' | 'mark_unread' | 'delete';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly adminPanelPermissionName = 'Admin-Panel';

  private getAdminUserWhere(): Prisma.UtilisateurPortailWhereInput {
    return {
      OR: [
        {
          role: {
            is: {
              name: { contains: 'admin', mode: 'insensitive' },
            },
          },
        },
        {
          role: {
            is: {
              rolePermissions: {
                some: {
                  permission: {
                    is: {
                      name: this.adminPanelPermissionName,
                    },
                  },
                },
              },
            },
          },
        },
        {
          userGroups: {
            some: {
              group: {
                is: {
                  groupPermissions: {
                    some: {
                      permission: {
                        is: {
                          name: this.adminPanelPermissionName,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    };
  }

  private toSafePage(value?: number) {
    const page = Number(value || 1);
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }

  private toSafePageSize(value?: number) {
    const pageSize = Number(value || 20);
    if (!Number.isFinite(pageSize) || pageSize <= 0) return 20;
    return Math.min(Math.floor(pageSize), 100);
  }

  private normalizeType(type?: string): TypeNotification | undefined {
    if (!type) return undefined;
    const t = String(type).trim().toUpperCase();
    const allowed: TypeNotification[] = [
      TypeNotification.INFO,
      TypeNotification.AVIS,
      TypeNotification.TAXE,
      TypeNotification.ALERTE,
      TypeNotification.REPONSE,
    ];
    return allowed.includes(t as TypeNotification)
      ? (t as TypeNotification)
      : undefined;
  }

  private normalizeCategory(
    category?: string,
  ): NotificationCategory | undefined {
    if (!category) return undefined;
    const c = String(category).trim().toUpperCase();
    const allowed: NotificationCategory[] = [
      NotificationCategory.DEMANDE,
      NotificationCategory.PERMIS,
      NotificationCategory.MESSAGE_ADMIN,
      NotificationCategory.PAIEMENT,
      NotificationCategory.RELANCE,
      NotificationCategory.SYSTEM,
    ];
    return allowed.includes(c as NotificationCategory)
      ? (c as NotificationCategory)
      : undefined;
  }

  private normalizePriority(
    priority?: string,
  ): NotificationPriority | undefined {
    if (!priority) return undefined;
    const p = String(priority).trim().toUpperCase();
    const allowed: NotificationPriority[] = [
      NotificationPriority.LOW,
      NotificationPriority.MEDIUM,
      NotificationPriority.HIGH,
      NotificationPriority.URGENT,
    ];
    return allowed.includes(p as NotificationPriority)
      ? (p as NotificationPriority)
      : undefined;
  }

  private normalizeTypeList(values?: string[]) {
    const set = new Set<TypeNotification>();
    (values || []).forEach((value) => {
      const normalized = this.normalizeType(value);
      if (normalized) set.add(normalized);
    });
    return Array.from(set);
  }

  private normalizeCategoryList(values?: string[]) {
    const set = new Set<NotificationCategory>();
    (values || []).forEach((value) => {
      const normalized = this.normalizeCategory(value);
      if (normalized) set.add(normalized);
    });
    return Array.from(set);
  }

  private normalizePriorityList(values?: string[]) {
    const set = new Set<NotificationPriority>();
    (values || []).forEach((value) => {
      const normalized = this.normalizePriority(value);
      if (normalized) set.add(normalized);
    });
    return Array.from(set);
  }

  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private buildAdminWhere(
    params: AdminNotificationListParams,
  ): Prisma.NotificationPortailWhereInput {
    const clauses: Prisma.NotificationPortailWhereInput[] = [];

    const types = this.normalizeTypeList(params.type);
    if (types.length) {
      clauses.push({ type: { in: types } });
    }

    const categories = this.normalizeCategoryList(params.category);
    if (categories.length) {
      clauses.push({ category: { in: categories } });
    }

    const priorities = this.normalizePriorityList(params.priority);
    if (priorities.length) {
      clauses.push({ priority: { in: priorities } });
    }

    if (params.isRead === true || params.isRead === false) {
      clauses.push({ isRead: params.isRead });
    }

    if (params.fromDate || params.toDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (params.fromDate) {
        const from = new Date(params.fromDate);
        if (!Number.isNaN(from.getTime())) createdAt.gte = from;
      }
      if (params.toDate) {
        const to = new Date(params.toDate);
        if (!Number.isNaN(to.getTime())) createdAt.lte = this.endOfDay(to);
      }
      if (createdAt.gte || createdAt.lte) {
        clauses.push({ createdAt });
      }
    }

    const search = String(params.search || '').trim();
    if (search) {
      const searchUpper = search.toUpperCase();
      const searchType = this.normalizeType(searchUpper);
      const searchCategory = this.normalizeCategory(searchUpper);
      const searchPriority = this.normalizePriority(searchUpper);
      clauses.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
          { relatedEntityType: { contains: search, mode: 'insensitive' } },
          ...(searchType ? [{ type: searchType }] : []),
          ...(searchCategory ? [{ category: searchCategory }] : []),
          ...(searchPriority ? [{ priority: searchPriority }] : []),
          {
            utilisateur: {
              is: {
                username: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            utilisateur: {
              is: {
                email: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            utilisateur: {
              is: {
                nom: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            utilisateur: {
              is: {
                Prenom: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    const userQuery = String(params.userQuery || '').trim();
    if (userQuery) {
      clauses.push({
        OR: [
          {
            utilisateur: {
              is: {
                username: { contains: userQuery, mode: 'insensitive' },
              },
            },
          },
          {
            utilisateur: {
              is: {
                email: { contains: userQuery, mode: 'insensitive' },
              },
            },
          },
          {
            utilisateur: {
              is: {
                nom: { contains: userQuery, mode: 'insensitive' },
              },
            },
          },
          {
            utilisateur: {
              is: {
                Prenom: { contains: userQuery, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    if (!clauses.length) return {};
    return { AND: clauses };
  }

  private buildAdminOrderBy(params: AdminNotificationListParams) {
    const order: Prisma.SortOrder =
      String(params.sortOrder || 'desc').toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';
    const sortBy = String(params.sortBy || 'createdAt');

    const allowedSimple: Array<
      | 'id'
      | 'createdAt'
      | 'type'
      | 'category'
      | 'priority'
      | 'isRead'
      | 'title'
      | 'message'
    > = ['id', 'createdAt', 'type', 'category', 'priority', 'isRead', 'title', 'message'];
    if (allowedSimple.includes(sortBy as any)) {
      return { [sortBy]: order } as Prisma.NotificationPortailOrderByWithRelationInput;
    }
    if (sortBy === 'user') {
      return {
        utilisateur: {
          username: order,
        },
      } as Prisma.NotificationPortailOrderByWithRelationInput;
    }
    return { createdAt: 'desc' } as Prisma.NotificationPortailOrderByWithRelationInput;
  }

  private truncate(text: string, size = 90) {
    const value = String(text || '').trim();
    if (!value) return '';
    if (value.length <= size) return value;
    return `${value.slice(0, size - 1)}...`;
  }

  private formatDateFr(value: Date) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value);
  }

  private async ensurePermisExpirationNotifications(userId: number) {
    const user = await this.prisma.utilisateurPortail.findUnique({
      where: { id: userId },
      select: { id: true, detenteurId: true },
    });
    if (!user?.detenteurId) return;

    const now = new Date();
    const horizon = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const permits = await this.prisma.permisPortail.findMany({
      where: {
        id_detenteur: user.detenteurId,
        date_expiration: {
          not: null,
          gte: now,
          lte: horizon,
        },
      },
      select: {
        id: true,
        code_permis: true,
        date_expiration: true,
      },
    });
    if (!permits.length) return;

    const existing = await this.prisma.notificationPortail.findMany({
      where: {
        userId,
        category: NotificationCategory.PERMIS,
        relatedEntityType: 'permis_expiration',
        permisId: {
          in: permits.map((p) => p.id),
        },
      },
      select: { permisId: true },
    });
    const existingSet = new Set(existing.map((n) => n.permisId).filter(Boolean));

    for (const permit of permits) {
      if (existingSet.has(permit.id)) continue;
      if (!permit.date_expiration) continue;

      const daysLeft = Math.max(
        0,
        Math.ceil(
          (permit.date_expiration.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      );
      const code = permit.code_permis || String(permit.id);

      await this.prisma.notificationPortail.create({
        data: {
          userId,
          type: TypeNotification.ALERTE,
          category: NotificationCategory.PERMIS,
          priority: NotificationPriority.HIGH,
          title: 'Attention : expiration prochaine de permis',
          message: `Attention : votre permis n° ${code} expire dans ${daysLeft} jours (date fin : ${this.formatDateFr(permit.date_expiration)}). Pensez au renouvellement.`,
          relatedEntityId: permit.id,
          relatedEntityType: 'permis_expiration',
          permisId: permit.id,
        },
      });
    }
  }

  async listUserNotifications(params: NotificationListParams) {
    const userId = Number(params.userId);
    const page = this.toSafePage(params.page);
    const pageSize = this.toSafePageSize(params.pageSize);
    const type = this.normalizeType(params.type);
    const category = this.normalizeCategory(params.category);
    const unreadOnly = params.unreadOnly === true;

    await this.ensurePermisExpirationNotifications(userId);

    const where: Prisma.NotificationPortailWhereInput = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notificationPortail.count({ where }),
      this.prisma.notificationPortail.count({
        where: { userId, isRead: false },
      }),
      this.prisma.notificationPortail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      notifications: items,
      items,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount,
    };
  }

  async getRecentNotifications(userId: number, limit = 8) {
    await this.ensurePermisExpirationNotifications(userId);

    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.notificationPortail.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),
      this.prisma.notificationPortail.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  async markAsRead(userId: number, notificationId: number) {
    const existing = await this.prisma.notificationPortail.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification introuvable');
    }
    await this.prisma.notificationPortail.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number) {
    await this.prisma.notificationPortail.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: number) {
    return this.prisma.notificationPortail.count({
      where: { userId, isRead: false },
    });
  }

  async isAdminUser(userId: number) {
    const user = await this.prisma.utilisateurPortail.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) return false;

    const admin = await this.prisma.utilisateurPortail.findFirst({
      where: {
        id: userId,
        ...this.getAdminUserWhere(),
      },
      select: { id: true },
    });
    return Boolean(admin?.id);
  }

  async listAdminNotifications(params: AdminNotificationListParams) {
    const page = this.toSafePage(params.page);
    const pageSize = this.toSafePageSize(params.pageSize);
    const where = this.buildAdminWhere(params);
    const orderBy = this.buildAdminOrderBy(params);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.notificationPortail.count({ where }),
      this.prisma.notificationPortail.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          utilisateur: {
            select: {
              id: true,
              username: true,
              email: true,
              nom: true,
              Prenom: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getAdminStats(params: Omit<AdminNotificationListParams, 'page' | 'pageSize'>) {
    const where = this.buildAdminWhere(params);
    const baseAnd = Array.isArray((where as any)?.AND) ? (where as any).AND : [];
    const extendWhere = (extra: Prisma.NotificationPortailWhereInput) =>
      baseAnd.length
        ? ({ AND: [...baseAnd, extra] } as Prisma.NotificationPortailWhereInput)
        : extra;

    const [total, unread, read, urgent] = await this.prisma.$transaction([
      this.prisma.notificationPortail.count({ where }),
      this.prisma.notificationPortail.count({
        where: extendWhere({ isRead: false }),
      }),
      this.prisma.notificationPortail.count({
        where: extendWhere({ isRead: true }),
      }),
      this.prisma.notificationPortail.count({
        where: extendWhere({
          priority: { in: [NotificationPriority.HIGH, NotificationPriority.URGENT] },
        }),
      }),
    ]);

    return {
      total,
      unread,
      read,
      urgent,
    };
  }

  async getAdminNotificationById(id: number) {
    const item = await this.prisma.notificationPortail.findUnique({
      where: { id },
      include: {
        utilisateur: {
          select: {
            id: true,
            username: true,
            email: true,
            nom: true,
            Prenom: true,
          },
        },
        demande: {
          select: {
            id_demande: true,
            code_demande: true,
            statut_demande: true,
          },
        },
        permis: {
          select: {
            id: true,
            code_permis: true,
            date_expiration: true,
          },
        },
        messageRelated: {
          select: {
            id: true,
            content: true,
            senderId: true,
            receiverId: true,
            conversation: {
              select: {
                id: true,
                entityType: true,
                entityCode: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Notification introuvable');
    }
    return item;
  }

  async setAdminReadState(id: number, isRead: boolean) {
    const existing = await this.prisma.notificationPortail.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification introuvable');
    }
    return this.prisma.notificationPortail.update({
      where: { id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });
  }

  async deleteAdminNotification(id: number) {
    const existing = await this.prisma.notificationPortail.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification introuvable');
    }
    await this.prisma.notificationPortail.delete({
      where: { id },
    });
    return { success: true };
  }

  async bulkAdminAction(ids: number[], action: AdminBulkAction) {
    const safeIds = Array.from(
      new Set(
        (ids || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    if (!safeIds.length) {
      return { success: true, count: 0 };
    }

    if (action === 'delete') {
      const res = await this.prisma.notificationPortail.deleteMany({
        where: { id: { in: safeIds } },
      });
      return { success: true, count: res.count };
    }

    const isRead = action === 'mark_read';
    const res = await this.prisma.notificationPortail.updateMany({
      where: { id: { in: safeIds } },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });
    return { success: true, count: res.count };
  }

  async createDemandeStatusNotification(input: {
    userId: number;
    demandeId: number;
    demandeCode: string;
    typePermisLabel?: string | null;
    statut: 'ACCEPTEE' | 'REJETEE' | 'EN_COMPLEMENT';
    motifRejet?: string | null;
  }) {
    const code = input.demandeCode || `DEM-${input.demandeId}`;
    const type = input.typePermisLabel?.trim() || 'Type inconnu';

    let title = 'Mise a jour de demande';
    let message = `Votre demande n° ${code} a ete mise a jour.`;
    let notifType: TypeNotification = TypeNotification.AVIS;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    if (input.statut === 'ACCEPTEE') {
      title = 'Demande acceptee';
      message = `Felicitations ! Votre demande n° ${code} (${type}) a ete acceptee.`;
      notifType = TypeNotification.AVIS;
      priority = NotificationPriority.MEDIUM;
    } else if (input.statut === 'REJETEE') {
      title = 'Demande rejetee';
      message = `Votre demande n° ${code} a ete rejetee. Motif : ${input.motifRejet || 'Non precise'}`;
      notifType = TypeNotification.ALERTE;
      priority = NotificationPriority.HIGH;
    } else if (input.statut === 'EN_COMPLEMENT') {
      title = 'Pieces complementaires demandees';
      message = `Pieces complementaires demandees pour votre demande n° ${code}.`;
      notifType = TypeNotification.ALERTE;
      priority = NotificationPriority.HIGH;
    }

    return this.prisma.notificationPortail.create({
      data: {
        userId: input.userId,
        type: notifType,
        category: NotificationCategory.DEMANDE,
        priority,
        title,
        message,
        relatedEntityId: input.demandeId,
        relatedEntityType: 'demande',
        demandeId: input.demandeId,
      },
    });
  }

  async createAdminMessageNotification(input: {
    receiverId: number;
    messageId: number;
    preview: string;
    senderDisplayName?: string | null;
  }) {
    const preview = this.truncate(input.preview || '', 90);
    const sender = this.truncate(input.senderDisplayName || 'Administration', 40);
    return this.prisma.notificationPortail.create({
      data: {
        userId: input.receiverId,
        type: TypeNotification.REPONSE,
        category: NotificationCategory.MESSAGE_ADMIN,
        priority: NotificationPriority.MEDIUM,
        title: 'Nouveau message de l administration',
        message: `Nouveau message recu de l administration (${sender}) : ${preview}`,
        relatedEntityId: input.messageId,
        relatedEntityType: 'message_portail',
        messageId: input.messageId,
      },
    });
  }

  async createUserMessageToAdminNotification(input: {
    adminUserId: number;
    messageId: number;
    preview: string;
    senderDisplayName?: string | null;
  }) {
    const preview = this.truncate(input.preview || '', 90);
    const sender = this.truncate(input.senderDisplayName || 'Utilisateur', 40);
    return this.prisma.notificationPortail.create({
      data: {
        userId: input.adminUserId,
        type: TypeNotification.REPONSE,
        category: NotificationCategory.MESSAGE_ADMIN,
        priority: NotificationPriority.MEDIUM,
        title: 'Nouveau message utilisateur',
        message: `Nouveau message recu de ${sender} : ${preview}`,
        relatedEntityId: input.messageId,
        relatedEntityType: 'message_portail',
        messageId: input.messageId,
      },
    });
  }

  async createExpertNotification(expert: any, type: string) {
    const title = this.getExpertNotificationTitle(type);
    const expertName = expert?.nom_expert || 'Nom non specifie';
    const agrementNumber = expert?.num_agrement || 'Numero non specifie';
    const message = this.getExpertNotificationMessage(
      expertName,
      agrementNumber,
      type,
    );

    // Compatibilite: notifier les comptes admin existants
    const admins = await this.prisma.utilisateurPortail.findMany({
      where: {
        role: {
          is: {
            name: { contains: 'admin', mode: 'insensitive' },
          },
        },
      },
      select: { id: true },
    });
    if (!admins.length) return null;

    const payload = admins.map((a) => ({
      userId: a.id,
      type: TypeNotification.INFO,
      category: NotificationCategory.SYSTEM,
      priority: NotificationPriority.LOW,
      title,
      message,
      relatedEntityId: expert?.id_expert ?? null,
      relatedEntityType: 'expertminier',
      expertId: expert?.id_expert ?? null,
    }));

    await this.prisma.notificationPortail.createMany({ data: payload });
    return { created: payload.length };
  }

  private getExpertNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      expert_created: 'Nouvel Expert Minier',
      expert_updated: 'Expert Minier Modifie',
      expert_deleted: 'Expert Minier Supprime',
    };
    return titles[type] || 'Notification Expert Minier';
  }

  private getExpertNotificationMessage(
    expertName: string,
    agrementNumber: string,
    type: string,
  ): string {
    const messages: Record<string, string> = {
      expert_created: `L'expert minier "${expertName}" a ete cree avec le numero d'agrement ${agrementNumber}`,
      expert_updated: `Les informations de l'expert minier "${expertName}" ont ete mises a jour`,
      expert_deleted: `L'expert minier "${expertName}" a ete supprime du systeme`,
    };
    return messages[type] || `Notification pour l'expert ${expertName}`;
  }

  async getAdminRecipientIds() {
    const admins = await this.prisma.utilisateurPortail.findMany({
      where: this.getAdminUserWhere(),
      select: { id: true },
    });

    return Array.from(
      new Set(
        admins
          .map((item) => Number(item.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
  }

  async createAdminNewAccountNotification(input: {
    createdUserId: number;
    email?: string | null;
    username?: string | null;
    roleName?: string | null;
    fullName?: string | null;
  }) {
    const createdUserId = Number(input.createdUserId);
    if (!Number.isFinite(createdUserId) || createdUserId <= 0) {
      return { created: 0 };
    }

    const adminIds = await this.getAdminRecipientIds();
    if (!adminIds.length) return { created: 0 };

    const displayName =
      this.truncate(input.fullName || '', 90) ||
      this.truncate(input.username || '', 60) ||
      this.truncate(input.email || '', 70) ||
      `Utilisateur #${createdUserId}`;
    const rolePart = this.truncate(input.roleName || '', 40);
    const roleSuffix = rolePart ? ` (role: ${rolePart})` : '';

    const title = 'Nouveau compte cree';
    const message = `Un nouveau compte a ete cree: ${displayName}${roleSuffix}.`;

    const existingNotifications = await this.prisma.notificationPortail.findMany({
      where: {
        userId: { in: adminIds },
        relatedEntityType: 'user_account_created',
        relatedEntityId: createdUserId,
        title,
      },
      select: { userId: true },
    });
    const existingAdminSet = new Set(
      existingNotifications
        .map((item) => Number(item.userId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

    const payload = adminIds
      .filter((adminId) => !existingAdminSet.has(adminId))
      .map((adminId) => ({
        userId: adminId,
        type: TypeNotification.INFO as TypeNotification,
        category: NotificationCategory.SYSTEM as NotificationCategory,
        priority: NotificationPriority.MEDIUM as NotificationPriority,
        title,
        message,
        relatedEntityId: createdUserId,
        relatedEntityType: 'user_account_created',
      }));

    if (!payload.length) return { created: 0 };

    await this.prisma.notificationPortail.createMany({ data: payload });
    return { created: payload.length };
  }

  async createAdminNewDemandeNotification(input: {
    demandeId: number;
    demandeCode?: string | null;
    requesterUserId?: number | null;
    requesterDisplayName?: string | null;
    companyName?: string | null;
  }) {
    const demandeId = Number(input.demandeId);
    if (!Number.isFinite(demandeId) || demandeId <= 0) {
      return { created: 0 };
    }

    const adminIds = await this.getAdminRecipientIds();
    if (!adminIds.length) return { created: 0 };

    const existingDemande = await this.prisma.demandePortail.findUnique({
      where: { id_demande: demandeId },
      select: {
        id_demande: true,
        code_demande: true,
        utilisateurId: true,
        utilisateur: {
          select: {
            id: true,
            nom: true,
            Prenom: true,
            username: true,
            email: true,
          },
        },
        detenteurdemande: {
          include: {
            detenteur: {
              select: {
                nom_societeFR: true,
                nom_societeAR: true,
              },
            },
          },
          orderBy: { id_detenteurDemande: 'asc' },
        },
      },
    });

    const rawCode = String(
      input.demandeCode || existingDemande?.code_demande || `DEM-${demandeId}`,
    );
    const code = this.truncate(
      rawCode.toUpperCase().startsWith('TEMP-') ? `DEM-${demandeId}` : rawCode,
      80,
    );

    const linkedCompany = existingDemande?.detenteurdemande?.find(
      (link) => link?.detenteur,
    )?.detenteur;
    const company =
      this.truncate(input.companyName || '', 90) ||
      this.truncate(linkedCompany?.nom_societeFR || '', 90) ||
      this.truncate(linkedCompany?.nom_societeAR || '', 90);

    const user = existingDemande?.utilisateur;
    const userFullName = [this.truncate(user?.nom || '', 45), this.truncate(user?.Prenom || '', 45)]
      .filter(Boolean)
      .join(' ')
      .trim();
    const fallbackRequester =
      userFullName ||
      this.truncate(user?.username || '', 45) ||
      this.truncate(user?.email || '', 70) ||
      (Number.isFinite(Number(input.requesterUserId || existingDemande?.utilisateurId))
        ? `Utilisateur #${Number(input.requesterUserId || existingDemande?.utilisateurId)}`
        : 'Utilisateur');

    const requesterLabel =
      this.truncate(input.requesterDisplayName || '', 90) ||
      company ||
      fallbackRequester;

    const title = 'Nouvelle demande recue';
    const message = `Une nouvelle demande a ete deposee : ${code} par ${requesterLabel}.`;

    const existingNotifications = await this.prisma.notificationPortail.findMany({
      where: {
        userId: { in: adminIds },
        demandeId,
        relatedEntityType: 'demande',
        title,
      },
      select: { userId: true },
    });

    const existingAdminSet = new Set(
      existingNotifications
        .map((item) => Number(item.userId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

    const payload = adminIds
      .filter((adminId) => !existingAdminSet.has(adminId))
      .map((adminId) => ({
        userId: adminId,
        type: TypeNotification.AVIS as TypeNotification,
        category: NotificationCategory.DEMANDE as NotificationCategory,
        priority: NotificationPriority.MEDIUM as NotificationPriority,
        title,
        message,
        relatedEntityId: demandeId,
        relatedEntityType: 'demande',
        demandeId,
      }));

    if (!payload.length) return { created: 0 };

    await this.prisma.notificationPortail.createMany({ data: payload });
    return { created: payload.length };
  }

  async createEntrepriseIdentificationRequestNotification(input: {
    requesterUserId: number;
    requesterEmail?: string | null;
    requesterUsername?: string | null;
    companyName?: string | null;
  }) {
    const adminIds = await this.getAdminRecipientIds();
    if (!adminIds.length) return { created: 0 };

    const username = this.truncate(input.requesterUsername || '', 40);
    const email = this.truncate(input.requesterEmail || '', 70);
    const company = this.truncate(input.companyName || '', 90);
    const requesterLabel =
      username || email || `Utilisateur #${input.requesterUserId}`;
    const companyPart = company ? ` | Entreprise: ${company}` : '';

    const payload = adminIds.map((adminId) => ({
      userId: adminId,
      type: TypeNotification.ALERTE as TypeNotification,
      category: NotificationCategory.SYSTEM as NotificationCategory,
      priority: NotificationPriority.HIGH as NotificationPriority,
      title: "Nouvelle demande d'identification d'entreprise",
      message: `Nouvelle demande d'identification d'entreprise de ${requesterLabel}${companyPart}.`,
      relatedEntityId: input.requesterUserId,
      relatedEntityType: 'entreprise_identification_request',
    }));

    await this.prisma.notificationPortail.createMany({ data: payload });
    return { created: payload.length };
  }

  async createEntrepriseIdentificationDecisionNotification(input: {
    userId: number;
    status: 'CONFIRMEE' | 'REFUSEE';
    reason?: string | null;
  }) {
    const isConfirmed = input.status === 'CONFIRMEE';
    const cleanReason = this.truncate(String(input.reason || '').trim(), 400);

    const title = isConfirmed
      ? 'Identification entreprise confirmee'
      : 'Identification entreprise refusee';
    const message = isConfirmed
      ? 'Bienvenue ! Votre entreprise a ete confirmee. Vous pouvez acceder a votre espace.'
      : `Votre demande d'identification d'entreprise a ete refusee.${cleanReason ? ` Motif: ${cleanReason}` : ''}`;

    return this.prisma.notificationPortail.create({
      data: {
        userId: input.userId,
        type: isConfirmed ? TypeNotification.AVIS : TypeNotification.ALERTE,
        category: NotificationCategory.SYSTEM,
        priority: isConfirmed
          ? NotificationPriority.MEDIUM
          : NotificationPriority.HIGH,
        title,
        message,
        relatedEntityId: input.userId,
        relatedEntityType: isConfirmed
          ? 'entreprise_identification_confirmed'
          : 'entreprise_identification_rejected',
      },
    });
  }
}

