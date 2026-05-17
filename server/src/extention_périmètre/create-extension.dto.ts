import { IsInt, IsISO8601, IsOptional } from 'class-validator';

export class CreateExtensionDto {
  @IsInt()
  permisId: number;

  @IsISO8601()
  date_demande: string;

  @IsOptional()
  @IsInt()
  utilisateurId?: number;
}
