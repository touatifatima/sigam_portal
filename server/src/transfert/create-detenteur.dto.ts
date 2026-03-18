import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateRegistreCommerceDto {
  @IsOptional()
  @IsString()
  numero_rc?: string;

  @IsOptional()
  @IsString()
  date_enregistrement?: string;

  @IsOptional()
  @IsNumber()
  capital_social?: number;

  @IsOptional()
  @IsString()
  nis?: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsString()
  adresse_legale?: string;
}

export class CreatePersonnePhysiqueDto {
  @IsString()
  nomFR!: string;

  @IsString()
  prenomFR!: string;

  @IsOptional()
  @IsString()
  nomAR?: string;

  @IsOptional()
  @IsString()
  prenomAR?: string;

  @IsOptional()
  @IsString()
  date_naissance?: string;

  @IsOptional()
  @IsString()
  lieu_naissance?: string;

  @IsOptional()
  @IsString()
  nationalite?: string;

  @IsOptional()
  @IsString()
  adresse_domicile?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  num_carte_identite?: string;

  @IsOptional()
  @IsString()
  lieu_juridique_soc?: string;

  @IsOptional()
  @IsString()
  ref_professionnelles?: string;

  @IsOptional()
  @IsNumber()
  id_pays?: number;
}

export class CreateFonctionDto {
  @IsNumber()
  id_personne!: number;

  @IsString()
  type_fonction!: string;

  @IsOptional()
  @IsString()
  statut_personne?: string;

  @IsOptional()
  @IsNumber()
  taux_participation?: number;
}

export class CreateDetenteurDto {
  @IsOptional()
  @IsString()
  nom_societeFR?: string;

  @IsOptional()
  @IsString()
  nom_societeAR?: string;

  @IsOptional()
  @IsNumber()
  id_statutJuridique?: number;

  @IsOptional()
  @IsString()
  date_constitution?: string;

  @IsOptional()
  @IsNumber()
  id_pays?: number;

  @IsOptional()
  @IsString()
  adresse_siege?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  site_web?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRegistreCommerceDto)
  registreCommerce?: CreateRegistreCommerceDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePersonnePhysiqueDto)
  personnes?: CreatePersonnePhysiqueDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFonctionDto)
  fonctions?: CreateFonctionDto[];
}
