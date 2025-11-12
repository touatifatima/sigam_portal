// create-actionnaire.dto.ts
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateActionnaireDto {
  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsNumber()
  id_nationalite: number;

  @IsString()
  qualification: string;

  @IsString()
  numero_carte: string;

  @IsString()
  @IsNotEmpty()
  taux_participation: string;
  lieu_naissance: any;
  id_pays: number
}
import { PersonnePhysiquePortail, FonctionPersonneMoralePortail } from '@prisma/client';

export type ActionnaireResult = {
  personne: PersonnePhysiquePortail;
  lien: FonctionPersonneMoralePortail;
};
