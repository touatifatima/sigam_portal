import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CessionBeneficiaryDto {
  @IsNumber()
  id_actionnaire!: number;

  @IsNumber()
  @Min(0)
  taux!: number;
}

export class StartCessionDto {
  @IsNumber()
  permisId!: number;

  @IsNumber()
  cedantActionnaireId!: number;

  @IsNumber()
  @Min(0)
  tauxCede!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CessionBeneficiaryDto)
  beneficiaries!: CessionBeneficiaryDto[];

  @IsOptional()
  @IsString()
  date_demande?: string;

  @IsOptional()
  @IsString()
  motif_cession?: string;
}

