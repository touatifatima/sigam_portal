import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NavbarQuickLink, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type SessionUserLike = {
  role?: {
    name?: string | null;
    rolePermissions?: Array<{
      permission?: { name?: string | null } | null;
    }>;
  } | null;
} | null;

export type NavbarQuickLinkInput = {
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
};

const ADMIN_ROLES = ['admin', 'administrateur'];
const OPERATEUR_ROLES = ['operateur', 'operator'];
const INVESTISSEUR_ROLES = ['investisseur', 'investor'];

@Injectable()
export class NavbarLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeString(value: unknown, maxLength?: number) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    if (!maxLength || maxLength <= 0) return normalized;
    return normalized.slice(0, maxLength);
  }

  private toNullableString(value: unknown, maxLength?: number) {
    const normalized = this.sanitizeString(value, maxLength);
    return normalized || null;
  }

  private normalizeKey(value: unknown) {
    const normalized = this.sanitizeString(value).toLowerCase();
    if (!normalized) return '';
    return normalized
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '');
  }

  private normalizeHref(value: unknown) {
    const href = this.sanitizeString(value, 255);
    if (!href) {
      throw new BadRequestException('Le champ href est requis.');
    }

    if (href.startsWith('/') || /^https?:\/\//i.test(href)) {
      return href;
    }

    return `/${href}`;
  }

  private normalizeSortOrder(value: unknown, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return defaultValue;
    return Math.trunc(parsed);
  }

  private parseRoleTokens(roleName?: string | null) {
    return String(roleName || '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
  }

  private extractPermissionNames(user: SessionUserLike) {
    return (
      user?.role?.rolePermissions
        ?.map((entry) => String(entry?.permission?.name || '').trim())
        .filter(Boolean) ?? []
    );
  }

  private buildRoleFilters(roleTokens: string[]) {
    const filters: Prisma.NavbarQuickLinkWhereInput[] = [];

    if (roleTokens.some((role) => ADMIN_ROLES.includes(role))) {
      filters.push({ showForAdmin: true });
    }
    if (roleTokens.some((role) => OPERATEUR_ROLES.includes(role))) {
      filters.push({ showForOperateur: true });
    }
    if (roleTokens.some((role) => INVESTISSEUR_ROLES.includes(role))) {
      filters.push({ showForInvestisseur: true });
    }

    return filters;
  }

  private mapItem(item: NavbarQuickLink) {
    return {
      id: item.id,
      key: item.key,
      label: item.label,
      href: item.href,
      description: item.description,
      icon: item.icon,
      section: item.section,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      showForAdmin: item.showForAdmin,
      showForOperateur: item.showForOperateur,
      showForInvestisseur: item.showForInvestisseur,
      requiredPermission: item.requiredPermission,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private handlePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('La cle existe deja.');
    }
    throw error;
  }

  private buildCreateData(input: NavbarQuickLinkInput): Prisma.NavbarQuickLinkCreateInput {
    const label = this.sanitizeString(input.label, 150);
    if (!label) {
      throw new BadRequestException('Le champ label est requis.');
    }

    const href = this.normalizeHref(input.href);
    const keySeed = input.key || label || href;
    const key = this.normalizeKey(keySeed);
    if (!key) {
      throw new BadRequestException('Le champ key est invalide.');
    }

    return {
      key,
      label,
      href,
      description: this.toNullableString(input.description, 255),
      icon: this.toNullableString(input.icon, 80),
      section: this.sanitizeString(input.section || 'main', 60) || 'main',
      sortOrder: this.normalizeSortOrder(input.sortOrder, 0),
      isActive: input.isActive ?? true,
      showForAdmin: input.showForAdmin ?? true,
      showForOperateur: input.showForOperateur ?? true,
      showForInvestisseur: input.showForInvestisseur ?? true,
      requiredPermission: this.toNullableString(input.requiredPermission, 120),
    };
  }

  private buildUpdateData(input: NavbarQuickLinkInput): Prisma.NavbarQuickLinkUpdateInput {
    const data: Prisma.NavbarQuickLinkUpdateInput = {};

    if (input.key !== undefined) {
      const key = this.normalizeKey(input.key);
      if (!key) {
        throw new BadRequestException('Le champ key est invalide.');
      }
      data.key = key;
    }

    if (input.label !== undefined) {
      const label = this.sanitizeString(input.label, 150);
      if (!label) {
        throw new BadRequestException('Le champ label est requis.');
      }
      data.label = label;
    }

    if (input.href !== undefined) {
      data.href = this.normalizeHref(input.href);
    }

    if (input.description !== undefined) {
      data.description = this.toNullableString(input.description, 255);
    }

    if (input.icon !== undefined) {
      data.icon = this.toNullableString(input.icon, 80);
    }

    if (input.section !== undefined) {
      data.section = this.sanitizeString(input.section, 60) || 'main';
    }

    if (input.sortOrder !== undefined) {
      data.sortOrder = this.normalizeSortOrder(input.sortOrder, 0);
    }

    if (input.isActive !== undefined) {
      data.isActive = Boolean(input.isActive);
    }

    if (input.showForAdmin !== undefined) {
      data.showForAdmin = Boolean(input.showForAdmin);
    }

    if (input.showForOperateur !== undefined) {
      data.showForOperateur = Boolean(input.showForOperateur);
    }

    if (input.showForInvestisseur !== undefined) {
      data.showForInvestisseur = Boolean(input.showForInvestisseur);
    }

    if (input.requiredPermission !== undefined) {
      data.requiredPermission = this.toNullableString(input.requiredPermission, 120);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification fournie.');
    }

    return data;
  }

  async getVisibleForUser(user: SessionUserLike) {
    const configured = (await this.prisma.navbarQuickLink.count()) > 0;
    if (!configured) {
      return { configured: false, items: [] as ReturnType<typeof this.mapItem>[] };
    }

    const roleTokens = this.parseRoleTokens(user?.role?.name);
    const roleFilters = this.buildRoleFilters(roleTokens);
    if (roleFilters.length === 0) {
      return { configured: true, items: [] as ReturnType<typeof this.mapItem>[] };
    }

    const permissionSet = new Set(this.extractPermissionNames(user));
    const items = await this.prisma.navbarQuickLink.findMany({
      where: {
        isActive: true,
        OR: roleFilters,
      },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });

    const visible = items.filter((item) => {
      const required = String(item.requiredPermission || '').trim();
      if (!required) return true;
      return permissionSet.has(required);
    });

    return {
      configured: true,
      items: visible.map((item) => this.mapItem(item)),
    };
  }

  async getAllForAdmin() {
    const items = await this.prisma.navbarQuickLink.findMany({
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });

    return {
      items: items.map((item) => this.mapItem(item)),
    };
  }

  async createForAdmin(input: NavbarQuickLinkInput) {
    const data = this.buildCreateData(input);
    try {
      const item = await this.prisma.navbarQuickLink.create({ data });
      return { item: this.mapItem(item) };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateForAdmin(id: number, input: NavbarQuickLinkInput) {
    const existing = await this.prisma.navbarQuickLink.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Lien navbar introuvable.');
    }

    const data = this.buildUpdateData(input);

    try {
      const item = await this.prisma.navbarQuickLink.update({
        where: { id },
        data,
      });
      return { item: this.mapItem(item) };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async deleteForAdmin(id: number) {
    const existing = await this.prisma.navbarQuickLink.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Lien navbar introuvable.');
    }

    await this.prisma.navbarQuickLink.delete({ where: { id } });
    return { success: true, id };
  }
}

