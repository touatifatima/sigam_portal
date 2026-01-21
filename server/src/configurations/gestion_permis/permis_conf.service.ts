// src/permis/permis.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePermisDto } from './create-permis.dto';
import { UpdatePermisDto } from './update-permis.dto';
import { FilterPermisDto } from './filter-permis.dto';
import { Prisma } from '@prisma/client';
@Injectable()
export class PermisService {
  constructor(private prisma: PrismaService) {}

  async create(createPermisDto: CreatePermisDto) {
    return this.prisma.permisPortail.create({
      data: createPermisDto as unknown as Prisma.PermisPortailUncheckedCreateInput,
      include: {
        typePermis: true,
        antenne: true,
        detenteur: true,
        statut: true,
      },
    });
  }

  async findAll(filters: FilterPermisDto) {
    const { search, status, type, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { code_permis: { contains: search, mode: 'insensitive' } },
        { lieu_ditFR: { contains: search, mode: 'insensitive' } }, // Fixed field name
        {
          detenteur: {
            nom_societeFR: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (status) {
      where.id_statut = status;
    }

    if (type) {
      where.id_typePermis = type;
    }

    const [data, total] = await Promise.all([
      this.prisma.permisPortail.findMany({
        where,
        skip,
        take: limit,
        include: {
          typePermis: true,
          antenne: true,
          detenteur: true,
          statut: true,
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.permisPortail.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id },
      include: {
        typePermis: true,
        antenne: true,
        detenteur: true,
        statut: true,
        permisProcedure: {
          include: {
            procedure: true,
          },
        },
        RapportActivite: true,
        CahierCharge: true,
        ObligationFiscale: true,
        PermisTemplate: true,
      },
    });

    if (!permis) {
      throw new NotFoundException(`Permis with ID ${id} not found`);
    }

    return permis;
  }

  /*async findByCode(code: string) {
    const permis = await this.prisma.permis.findUnique({
      where: { code_permis: code },
      include: {
        typePermis: true,
        commune: { // Changed from antenne to commune
          include: {
            daira: {
              include: {
                wilaya: {
                  include: {
                    antenne: true // Include antenne through the chain
                  }
                }
              }
            }
          }
        },
        detenteur: true,
        statut: true,
      },
    });

    if (!permis) {
      throw new NotFoundException(`Permis with code ${code} not found`);
    }

    return permis;
  }
*/
  async update(id: number, updatePermisDto: UpdatePermisDto) {
    try {
      return await this.prisma.permisPortail.update({
        where: { id },
        data: updatePermisDto as Prisma.PermisPortailUpdateInput,
        include: {
          typePermis: true,
          antenne: true,
          detenteur: true,
          statut: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Permis with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.permisPortail.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Permis with ID ${id} not found`);
      }
      throw error;
    }
  }

  // Helper method to get antenne from permis
  async getAntenneFromPermis(permisId: number) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        antenne: true,
      },
    });

    if (!permis) {
      return null;
    }

    return permis.antenne ?? null;
  }

  async getStats() {
    const total = await this.prisma.permisPortail.count();
    const active = await this.prisma.permisPortail.count({
      where: { statut: { lib_statut: 'En vigueur' } },
    });

    // Count expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoon = await this.prisma.permisPortail.count({
      where: {
        date_expiration: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
      },
    });

    return {
      total,
      active,
      expiringSoon,
    };
  }
}
