// server/src/fusion-permis/dto/fusionner-permis.dto.ts
import { IsNumber, IsString } from 'class-validator';

export class FusionnerPermisDto {
  @IsNumber()
  id_principal: number;

  @IsNumber()
  id_secondaire: number;

  @IsString()
  motif_fusion: string;
}
