import { IsInt, IsISO8601 } from 'class-validator';

export class CreateExtensionDto {
  @IsInt()
  permisId: number;

  @IsISO8601()
  date_demande: string;
}

