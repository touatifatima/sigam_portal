import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProcedureDeclaration } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type DeclarationClient = Prisma.TransactionClient | PrismaService;

type CreateDeclarationInput = {
  typeProcedureId?: number;
  typeProcedure?: string;
  ordre?: number;
  texte: string;
  actif?: boolean;
};

type UpdateDeclarationInput = {
  typeProcedureId?: number;
  typeProcedure?: string;
  ordre?: number;
  texte?: string;
  actif?: boolean;
};

@Injectable()
export class ProcedureDeclarationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTypeProcedureId(typeProcedureParam: string) {
    const raw = decodeURIComponent(typeProcedureParam ?? '').trim();
    if (!raw) {
      throw new BadRequestException('typeProcedure requis');
    }

    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      const found = await this.prisma.typeProcedure.findUnique({
        where: { id: asNumber },
        select: { id: true, libelle: true },
      });
      if (!found) {
        throw new NotFoundException(
          `TypeProcedure introuvable pour id=${asNumber}`,
        );
      }
      return found;
    }

    const exact = await this.prisma.typeProcedure.findFirst({
      where: { libelle: { equals: raw, mode: 'insensitive' } },
      select: { id: true, libelle: true },
    });
    if (exact) return exact;

    const fuzzy = await this.prisma.typeProcedure.findFirst({
      where: { libelle: { contains: raw, mode: 'insensitive' } },
      select: { id: true, libelle: true },
    });
    if (fuzzy) return fuzzy;

    throw new NotFoundException(`TypeProcedure introuvable pour "${raw}"`);
  }

  private normalizeOrdreInput(value?: number | null): number | null {
    if (!Number.isFinite(value)) return null;
    const parsed = Math.trunc(Number(value));
    return parsed > 0 ? parsed : null;
  }

  private async resolveTypeProcedureIdFromInput(
    input: Pick<CreateDeclarationInput, 'typeProcedureId' | 'typeProcedure'>,
  ) {
    if (Number.isFinite(input.typeProcedureId)) {
      const found = await this.prisma.typeProcedure.findUnique({
        where: { id: Number(input.typeProcedureId) },
        select: { id: true, libelle: true },
      });
      if (!found) {
        throw new NotFoundException(
          `TypeProcedure introuvable pour id=${input.typeProcedureId}`,
        );
      }
      return found;
    }
    if (!input.typeProcedure) {
      throw new BadRequestException(
        'typeProcedureId ou typeProcedure est requis',
      );
    }
    return this.resolveTypeProcedureId(input.typeProcedure);
  }

  private async normalizeOrdresForType(
    typeProcedureId: number,
    client: DeclarationClient,
  ) {
    const declarations = await client.procedureDeclaration.findMany({
      where: { typeProcedureId },
      orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
      select: { id: true, ordre: true },
    });

    for (let index = 0; index < declarations.length; index += 1) {
      const expectedOrdre = index + 1;
      if (declarations[index].ordre !== expectedOrdre) {
        await client.procedureDeclaration.update({
          where: { id: declarations[index].id },
          data: { ordre: expectedOrdre },
        });
      }
    }
  }

  private async findDeclarationById(id: number, client: DeclarationClient) {
    const declaration = await client.procedureDeclaration.findUnique({
      where: { id },
    });
    if (!declaration) {
      throw new NotFoundException(`Declaration ${id} introuvable`);
    }
    return declaration;
  }

  private async sanitizeTargetOrdre(
    typeProcedureId: number,
    requestedOrdre: number | null,
    client: DeclarationClient,
  ) {
    const aggregate = await client.procedureDeclaration.aggregate({
      where: { typeProcedureId },
      _max: { ordre: true },
    });
    const maxOrdre = aggregate._max.ordre ?? 0;
    const fallbackOrdre = maxOrdre + 1;
    if (!requestedOrdre) return fallbackOrdre;
    if (requestedOrdre > fallbackOrdre) return fallbackOrdre;
    return requestedOrdre;
  }

  private formatDeclarationEntity(declaration: ProcedureDeclaration) {
    return {
      id: declaration.id,
      typeProcedureId: declaration.typeProcedureId,
      ordre: declaration.ordre,
      texte: declaration.texte,
      actif: declaration.actif,
      createdAt: declaration.createdAt,
      updatedAt: declaration.updatedAt,
    };
  }

  async getActiveDeclarationsByType(typeProcedureParam: string) {
    const typeProcedure = await this.resolveTypeProcedureId(typeProcedureParam);

    const declarations = await this.prisma.procedureDeclaration.findMany({
      where: {
        typeProcedureId: typeProcedure.id,
        actif: true,
      },
      orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        ordre: true,
        texte: true,
        actif: true,
      },
    });

    return {
      typeProcedureId: typeProcedure.id,
      typeProcedure: typeProcedure.libelle ?? null,
      declarations,
    };
  }

  async getAllDeclarationsForAdmin() {
    const typeProcedures = await this.prisma.typeProcedure.findMany({
      orderBy: [{ libelle: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        libelle: true,
        declarations: {
          orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            ordre: true,
            texte: true,
            actif: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return {
      typeProcedures: typeProcedures.map((item) => ({
        id: item.id,
        libelle: item.libelle ?? `Type #${item.id}`,
        declarations: item.declarations,
      })),
    };
  }

  async getDeclarationsByTypeForAdmin(typeProcedureParam: string) {
    const typeProcedure = await this.resolveTypeProcedureId(typeProcedureParam);
    const declarations = await this.prisma.procedureDeclaration.findMany({
      where: { typeProcedureId: typeProcedure.id },
      orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        ordre: true,
        texte: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      typeProcedureId: typeProcedure.id,
      typeProcedure: typeProcedure.libelle ?? null,
      declarations,
    };
  }

  async createDeclaration(input: CreateDeclarationInput) {
    const texte = (input.texte ?? '').trim();
    if (!texte) {
      throw new BadRequestException('Le texte de declaration est requis');
    }

    const typeProcedure = await this.resolveTypeProcedureIdFromInput(input);
    const requestedOrdre = this.normalizeOrdreInput(input.ordre);

    const declaration = await this.prisma.$transaction(async (tx) => {
      const targetOrdre = await this.sanitizeTargetOrdre(
        typeProcedure.id,
        requestedOrdre,
        tx,
      );

      await tx.procedureDeclaration.updateMany({
        where: {
          typeProcedureId: typeProcedure.id,
          ordre: { gte: targetOrdre },
        },
        data: {
          ordre: { increment: 1 },
        },
      });

      const created = await tx.procedureDeclaration.create({
        data: {
          typeProcedureId: typeProcedure.id,
          ordre: targetOrdre,
          texte,
          actif: input.actif ?? true,
        },
      });

      await this.normalizeOrdresForType(typeProcedure.id, tx);
      return created;
    });

    return {
      message: 'Declaration creee avec succes',
      declaration: this.formatDeclarationEntity(declaration),
    };
  }

  async updateDeclaration(id: number, input: UpdateDeclarationInput) {
    const declaration = await this.prisma.$transaction(async (tx) => {
      const existing = await this.findDeclarationById(id, tx);

      const newType =
        Number.isFinite(input.typeProcedureId) || input.typeProcedure
          ? await this.resolveTypeProcedureIdFromInput({
              typeProcedureId: input.typeProcedureId,
              typeProcedure: input.typeProcedure,
            })
          : { id: existing.typeProcedureId };

      const targetTypeId = newType.id;
      const sameType = targetTypeId === existing.typeProcedureId;

      const requestedOrdre = this.normalizeOrdreInput(input.ordre);
      let targetOrdre = requestedOrdre ?? existing.ordre;
      targetOrdre = await this.sanitizeTargetOrdre(targetTypeId, targetOrdre, tx);

      if (sameType && targetOrdre !== existing.ordre) {
        if (targetOrdre < existing.ordre) {
          await tx.procedureDeclaration.updateMany({
            where: {
              typeProcedureId: existing.typeProcedureId,
              ordre: { gte: targetOrdre, lt: existing.ordre },
            },
            data: { ordre: { increment: 1 } },
          });
        } else {
          await tx.procedureDeclaration.updateMany({
            where: {
              typeProcedureId: existing.typeProcedureId,
              ordre: { gt: existing.ordre, lte: targetOrdre },
            },
            data: { ordre: { decrement: 1 } },
          });
        }
      }

      if (!sameType) {
        await tx.procedureDeclaration.updateMany({
          where: {
            typeProcedureId: existing.typeProcedureId,
            ordre: { gt: existing.ordre },
          },
          data: { ordre: { decrement: 1 } },
        });

        await tx.procedureDeclaration.updateMany({
          where: {
            typeProcedureId: targetTypeId,
            ordre: { gte: targetOrdre },
          },
          data: { ordre: { increment: 1 } },
        });
      }

      const updated = await tx.procedureDeclaration.update({
        where: { id },
        data: {
          typeProcedureId: targetTypeId,
          ordre: targetOrdre,
          texte:
            typeof input.texte === 'string'
              ? input.texte.trim() || existing.texte
              : existing.texte,
          actif: typeof input.actif === 'boolean' ? input.actif : existing.actif,
        },
      });

      await this.normalizeOrdresForType(existing.typeProcedureId, tx);
      if (!sameType) {
        await this.normalizeOrdresForType(targetTypeId, tx);
      }

      return updated;
    });

    return {
      message: 'Declaration mise a jour avec succes',
      declaration: this.formatDeclarationEntity(declaration),
    };
  }

  async moveDeclaration(id: number, direction: 'up' | 'down') {
    if (!['up', 'down'].includes(direction)) {
      throw new BadRequestException('Direction invalide (up | down)');
    }

    const declaration = await this.prisma.$transaction(async (tx) => {
      const current = await this.findDeclarationById(id, tx);

      const neighbor = await tx.procedureDeclaration.findFirst({
        where: {
          typeProcedureId: current.typeProcedureId,
          ...(direction === 'up'
            ? { ordre: { lt: current.ordre } }
            : { ordre: { gt: current.ordre } }),
        },
        orderBy:
          direction === 'up'
            ? [{ ordre: 'desc' }, { id: 'desc' }]
            : [{ ordre: 'asc' }, { id: 'asc' }],
      });

      if (!neighbor) {
        return current;
      }

      await tx.procedureDeclaration.update({
        where: { id: current.id },
        data: { ordre: neighbor.ordre },
      });

      await tx.procedureDeclaration.update({
        where: { id: neighbor.id },
        data: { ordre: current.ordre },
      });

      await this.normalizeOrdresForType(current.typeProcedureId, tx);

      return tx.procedureDeclaration.findUniqueOrThrow({
        where: { id: current.id },
      });
    });

    return {
      message: 'Ordre mis a jour avec succes',
      declaration: this.formatDeclarationEntity(declaration),
    };
  }

  async deleteDeclaration(id: number) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const current = await this.findDeclarationById(id, tx);
      await tx.procedureDeclaration.delete({ where: { id } });

      await tx.procedureDeclaration.updateMany({
        where: {
          typeProcedureId: current.typeProcedureId,
          ordre: { gt: current.ordre },
        },
        data: { ordre: { decrement: 1 } },
      });

      await this.normalizeOrdresForType(current.typeProcedureId, tx);
      return current;
    });

    return {
      message: 'Declaration supprimee avec succes',
      declaration: this.formatDeclarationEntity(deleted),
    };
  }
}

