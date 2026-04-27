import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActualitePortail, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaService;

const CATEGORY_OPTIONS = [
  'Actualite',
  'Reglementation',
  'Evenement',
  'Communique',
  'Technique',
] as const;

type ActualiteCategory = (typeof CATEGORY_OPTIONS)[number];

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

type ActualiteListQuery = {
  search?: string;
  category?: string;
};

@Injectable()
export class ActualitesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaults = [
    {
      slug: 'lancement-guichet-numerique-pom',
      title: 'Lancement du guichet numerique POM pour les demandes minieres',
      excerpt:
        'Le portail evolue avec un parcours de depot plus rapide, une meilleure tracabilite et un suivi de dossier en temps reel.',
      content:
        "Le Portail des Activites Minieres met en service une nouvelle experience de depot numerique. Les utilisateurs peuvent preparer leurs pieces, suivre les etapes et recevoir des notifications consolidees depuis un seul espace.",
      category: 'Actualite' as ActualiteCategory,
      author: 'Equipe POM',
      imageUrl:
        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=700&fit=crop&auto=format&q=80',
      isPublished: true,
      isFeatured: true,
      publishedAt: new Date('2026-03-18T09:30:00.000Z'),
      createdAt: new Date('2026-03-18T09:00:00.000Z'),
      updatedAt: new Date('2026-03-18T09:30:00.000Z'),
    },
    {
      slug: 'mise-a-jour-regles-controle-geometrique',
      title: 'Mise a jour des regles de controle geometrique avant depot',
      excerpt:
        'De nouvelles regles de verification prealable renforcent la qualite des dossiers et reduisent les rejets pour incoherences cartographiques.',
      content:
        "Le module de verification prealable integre des controles supplementaires sur les perimetres, les chevauchements et la projection des coordonnees. Cette evolution facilite l'instruction technique et la fiabilite des informations transmises.",
      category: 'Reglementation' as ActualiteCategory,
      author: 'Direction Cadastre',
      imageUrl:
        'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=1200&h=700&fit=crop&auto=format&q=80',
      isPublished: true,
      isFeatured: false,
      publishedAt: new Date('2026-02-26T11:00:00.000Z'),
      createdAt: new Date('2026-02-26T10:30:00.000Z'),
      updatedAt: new Date('2026-02-26T11:00:00.000Z'),
    },
    {
      slug: 'forum-minier-national-2026',
      title: 'Forum minier national 2026: ouverture des inscriptions',
      excerpt:
        'Le forum reunira operateurs, investisseurs et experts autour des priorites de developpement durable du secteur minier.',
      content:
        "Les inscriptions au forum minier national 2026 sont ouvertes. L'evenement couvrira les axes innovation, securite operationnelle, traitement des demandes et valorisation des ressources.",
      category: 'Evenement' as ActualiteCategory,
      author: 'Cellule Communication',
      imageUrl:
        'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=700&fit=crop&auto=format&q=80',
      isPublished: true,
      isFeatured: false,
      publishedAt: new Date('2026-01-28T08:40:00.000Z'),
      createdAt: new Date('2026-01-28T08:10:00.000Z'),
      updatedAt: new Date('2026-01-28T08:40:00.000Z'),
    },
  ];

  private slugify(value: string): string {
    const cleaned = String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return cleaned || `actualite-${Date.now()}`;
  }

  private readTimeFromText(text: string): number {
    const words = String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
  }

  private normalizeCategory(category?: string, fallback?: string): ActualiteCategory {
    const value = String(category || fallback || '').trim().toLowerCase();
    const found = CATEGORY_OPTIONS.find((option) => option.toLowerCase() === value);
    return found || 'Actualite';
  }

  private normalizeText(value: unknown, fallback = ''): string {
    return String(value ?? fallback).trim();
  }

  private mapItem(item: ActualitePortail) {
    return {
      id: String(item.id),
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      content: item.content,
      category: this.normalizeCategory(item.category),
      author: item.author,
      imageUrl: item.imageUrl ?? '',
      isPublished: item.isPublished,
      isFeatured: item.isFeatured,
      readTimeMinutes: this.readTimeFromText(item.content || item.title),
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : '',
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private buildSearchWhere(search?: string): Prisma.ActualitePortailWhereInput {
    const q = String(search || '').trim();
    if (!q) return {};
    return {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  private buildCategoryWhere(category?: string): Prisma.ActualitePortailWhereInput {
    const value = String(category || '').trim();
    if (!value || value.toLowerCase() === 'toutes') return {};
    return {
      category: this.normalizeCategory(value),
    };
  }

  private async ensureUniqueSlug(
    client: DbClient,
    base: string,
    excludeId?: number,
  ): Promise<string> {
    const cleanedBase = this.slugify(base);
    let candidate = cleanedBase;
    let counter = 2;

    while (true) {
      const found = await client.actualitePortail.findFirst({
        where: {
          slug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!found) return candidate;
      candidate = `${cleanedBase}-${counter}`;
      counter += 1;
    }
  }

  private async ensureSeeded() {
    const count = await this.prisma.actualitePortail.count();
    if (count > 0) return;

    await this.prisma.actualitePortail.createMany({
      data: this.defaults.map((item) => ({
        slug: item.slug,
        title: item.title,
        excerpt: item.excerpt,
        content: item.content,
        category: item.category,
        author: item.author,
        imageUrl: item.imageUrl,
        isPublished: item.isPublished,
        isFeatured: item.isFeatured,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  }

  private validateRequiredText(input: {
    title: string;
    excerpt: string;
    content: string;
  }) {
    if (!input.title) {
      throw new BadRequestException('Le titre est obligatoire');
    }
    if (!input.excerpt) {
      throw new BadRequestException('Le resume est obligatoire');
    }
    if (!input.content) {
      throw new BadRequestException('Le contenu est obligatoire');
    }
  }

  async getPublicActualites(query: ActualiteListQuery) {
    await this.ensureSeeded();

    const where: Prisma.ActualitePortailWhereInput = {
      isPublished: true,
      ...this.buildCategoryWhere(query.category),
      ...this.buildSearchWhere(query.search),
    };

    const items = await this.prisma.actualitePortail.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      items: items.map((item) => this.mapItem(item)),
    };
  }

  async getAdminActualites() {
    await this.ensureSeeded();

    const items = await this.prisma.actualitePortail.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: items.map((item) => this.mapItem(item)),
    };
  }

  async createActualite(input: ActualiteMutationInput) {
    const title = this.normalizeText(input.title);
    const excerpt = this.normalizeText(input.excerpt);
    const content = this.normalizeText(input.content);
    this.validateRequiredText({ title, excerpt, content });

    const rawPublished = typeof input.isPublished === 'boolean' ? input.isPublished : false;
    const rawFeatured = typeof input.isFeatured === 'boolean' ? input.isFeatured : false;
    const isPublished = rawPublished || rawFeatured;
    const isFeatured = isPublished ? rawFeatured : false;
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const slug = await this.ensureUniqueSlug(tx, title);

      if (isFeatured) {
        await tx.actualitePortail.updateMany({
          where: { isFeatured: true },
          data: { isFeatured: false },
        });
      }

      return tx.actualitePortail.create({
        data: {
          slug,
          title,
          excerpt,
          content,
          category: this.normalizeCategory(input.category),
          author: this.normalizeText(input.author, 'Equipe POM') || 'Equipe POM',
          imageUrl: this.normalizeText(input.imageUrl) || null,
          isPublished,
          isFeatured,
          publishedAt: isPublished ? now : null,
        },
      });
    });

    return {
      item: this.mapItem(created),
    };
  }

  async updateActualite(id: number, input: ActualiteMutationInput) {
    const existing = await this.prisma.actualitePortail.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Actualite introuvable');
    }

    const nextTitle =
      typeof input.title === 'string'
        ? this.normalizeText(input.title)
        : existing.title;
    const nextExcerpt =
      typeof input.excerpt === 'string'
        ? this.normalizeText(input.excerpt)
        : existing.excerpt;
    const nextContent =
      typeof input.content === 'string'
        ? this.normalizeText(input.content)
        : existing.content;
    this.validateRequiredText({
      title: nextTitle,
      excerpt: nextExcerpt,
      content: nextContent,
    });

    const requestedPublished =
      typeof input.isPublished === 'boolean' ? input.isPublished : existing.isPublished;
    const requestedFeatured =
      typeof input.isFeatured === 'boolean' ? input.isFeatured : existing.isFeatured;

    const isPublished = requestedPublished || requestedFeatured;
    const isFeatured = isPublished ? requestedFeatured : false;

    let publishedAt = existing.publishedAt;
    if (isPublished && !existing.isPublished) {
      publishedAt = new Date();
    }
    if (!isPublished) {
      publishedAt = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const slug =
        nextTitle !== existing.title
          ? await this.ensureUniqueSlug(tx, nextTitle, id)
          : existing.slug;

      if (isFeatured) {
        await tx.actualitePortail.updateMany({
          where: { isFeatured: true, NOT: { id } },
          data: { isFeatured: false },
        });
      }

      return tx.actualitePortail.update({
        where: { id },
        data: {
          slug,
          title: nextTitle,
          excerpt: nextExcerpt,
          content: nextContent,
          category: this.normalizeCategory(input.category, existing.category),
          author:
            this.normalizeText(
              input.author,
              existing.author || 'Equipe POM',
            ) || 'Equipe POM',
          imageUrl:
            typeof input.imageUrl === 'string'
              ? this.normalizeText(input.imageUrl) || null
              : existing.imageUrl,
          isPublished,
          isFeatured,
          publishedAt,
        },
      });
    });

    return {
      item: this.mapItem(updated),
    };
  }

  async deleteActualite(id: number) {
    const existing = await this.prisma.actualitePortail.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Actualite introuvable');
    }

    await this.prisma.actualitePortail.delete({
      where: { id },
    });

    return { success: true };
  }

  async resetActualites() {
    await this.prisma.$transaction(async (tx) => {
      await tx.actualitePortail.deleteMany();
      await tx.actualitePortail.createMany({
        data: this.defaults.map((item) => ({
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          content: item.content,
          category: item.category,
          author: item.author,
          imageUrl: item.imageUrl,
          isPublished: item.isPublished,
          isFeatured: item.isFeatured,
          publishedAt: item.publishedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      });
    });

    return this.getAdminActualites();
  }
}
