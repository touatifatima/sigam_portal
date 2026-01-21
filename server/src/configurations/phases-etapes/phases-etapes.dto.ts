import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePhaseDto {
  @ApiProperty({
    description: 'Libellé de la phase',
    example: 'Instruction technique',
  })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiProperty({ description: 'Ordre global de la phase', example: 1 })
  @IsInt()
  @Min(0)
  ordre: number;

  @ApiProperty({ description: 'Description de la phase', required: false })
  @IsString()
  @IsOptional()
  description?: string | null;
}

export class UpdatePhaseDto extends PartialType(CreatePhaseDto) {}

export class CreateEtapeDto {
  @ApiProperty({
    description: "Libellé de l'étape",
    example: 'Réception du dossier',
  })
  @IsString()
  @IsNotEmpty()
  lib_etape: string;

  // Infos d'affectation (ManyEtape)
  @ApiProperty({ description: 'Identifiant de la phase parente', example: 1 })
  @IsInt()
  @IsNotEmpty()
  id_phase: number;

  @ApiProperty({
    description: "Ordre de l'étape dans la phase",
    example: 1,
  })
  @IsInt()
  @Min(0)
  ordre_etape: number;

  @ApiProperty({
    description: "Durée estimée de l'étape (jours)",
    required: false,
    example: 10,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  duree_etape?: number | null;

  @ApiProperty({
    description: 'Route de la page front associée (ex: "demande/step1/page1")',
    required: false,
    example: 'demande/step1/page1',
  })
  @IsString()
  @IsOptional()
  page_route?: string | null;
}

export class UpdateEtapeDto extends PartialType(CreateEtapeDto) {}

export class CreateRelationPhaseTypeProcDto {
  @ApiProperty({ description: 'Identifiant du lien phase/étape (ManyEtape)', example: 1 })
  @IsInt()
  @IsNotEmpty()
  id_manyEtape: number;

  @ApiProperty({
    description: 'Identifiant de la combinaison type permis / type procédure',
    example: 3,
  })
  @IsInt()
  @IsNotEmpty()
  id_combinaison: number;

  @ApiProperty({
    description: 'Durée estimée totale de la phase (jours)',
    required: false,
    example: 30,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  dureeEstimee?: number | null;
}

export class UpdateRelationPhaseTypeProcDto extends PartialType(
  CreateRelationPhaseTypeProcDto,
) {}

export class CreateCombinaisonPermisProcDto {
  @ApiProperty({
    description: 'Identifiant du type de permis',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  id_typePermis: number;

  @ApiProperty({
    description: 'Identifiant du type de procédure',
    example: 2,
  })
  @IsInt()
  @IsNotEmpty()
  id_typeProc: number;
}

export class UpdateCombinaisonPermisProcDto extends PartialType(
  CreateCombinaisonPermisProcDto,
) {}
