// commune.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommuneDto, UpdateCommuneDto } from '../file.dto';

@Injectable()
export class CommuneService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.communePortail.findMany({
      include: {
        daira: {
          include: {
            wilaya: true,
          },
        },
      },
      orderBy: {
        nom_communeFR: 'asc',
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.communePortail.findUnique({
      where: { id_commune: id },
      include: {
        daira: {
          include: {
            wilaya: true,
          },
        },
      },
    });
  }

/*  async findByCode(code: string) {
    return this.prisma.commune.findUnique({
      where: { code_commune: code },
    });
  }*/

  async findByDaira(idDaira: number) {
    return this.prisma.communePortail.findMany({
      where: { id_daira: idDaira },
      orderBy: {
        nom_communeFR: 'asc',
      },
    });
  }

  async create(createCommuneDto: CreateCommuneDto) {
    return this.prisma.communePortail.create({
      data: {
        ...createCommuneDto,
      },
    });
  }

  async update(id: number, updateCommuneDto: UpdateCommuneDto) {
    return this.prisma.communePortail.update({
      where: { id_commune: id },
      data: updateCommuneDto,
    });
  }

  async remove(id: number) {
    return this.prisma.communePortail.delete({
      where: { id_commune: id },
    });
  }
}