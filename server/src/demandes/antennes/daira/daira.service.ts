// daira.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDairaDto, UpdateDairaDto } from '../file.dto';

@Injectable()
export class DairaService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.dairaPortail.findMany({
      include: {
        wilaya: true,
      },
      orderBy: {
        nom_dairaFR: 'asc',
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.dairaPortail.findUnique({
      where: { id_daira: id },
      include: {
        wilaya: true,
        communes: true,
      },
    });
  }

  // async findByCode(code: string) {
  //   return this.prisma.daira.findUnique({
  //     where: { code_daira: code },
  //   });
  // }

  async findByWilaya(idWilaya: number) {
    return this.prisma.dairaPortail.findMany({
      where: { id_wilaya: idWilaya },
      orderBy: {
        nom_dairaFR: 'asc',
      },
    });
  }

  async findCommunesByDaira(id: number) {
    return this.prisma.communePortail.findMany({
      where: { id_daira: id },
      orderBy: {
        nom_communeFR: 'asc',
      },
    });
  }

  async create(createDairaDto: CreateDairaDto) {
    return this.prisma.dairaPortail.create({
      data: {
        ...createDairaDto,
      },
    });
  }

  async update(id: number, updateDairaDto: UpdateDairaDto) {
    return this.prisma.dairaPortail.update({
      where: { id_daira: id },
      data: updateDairaDto,
    });
  }

  async remove(id: number) {
    return this.prisma.dairaPortail.delete({
      where: { id_daira: id },
    });
  }
}