import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateDetenteurDto } from './create-detenteur.dto';

export class StartTransfertDto {
  @IsNumber()
  permisId!: number;

  @IsOptional()
  @IsNumber()
  utilisateurId?: number;

  @IsOptional()
  @IsString()
  date_demande?: string;

  @IsOptional()
  @IsString()
  motif_transfert?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  // either existingDetenteurId OR newDetenteur
  @IsOptional()
  @IsNumber()
  existingDetenteurId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDetenteurDto)
  newDetenteur?: CreateDetenteurDto;

  @IsOptional()
  @IsBoolean()
  applyTransferToPermis?: boolean;
}
