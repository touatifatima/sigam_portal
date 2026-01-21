import {
  demandePortail,
  ProcedureRenouvellement,
  demInitial,
  demModification,
} from '@prisma/client';

type DemandeTypeProcedure = {
  typeProcedure?: {
    libelle?: string | null;
  } | null;
};

type TypeSpecificSection =
  | (demInitial & TypeSpecificFields)
  | (demModification & TypeSpecificFields)
  | (ProcedureRenouvellement & TypeSpecificFields)
  | null
  | undefined;

type TypeSpecificFields = {
  duree_trvx?: number | null;
  date_demarrage_prevue?: Date | null;
  qualite_signataire?: string | null;
  VolumePrevu?: number | null;
  ConResGeo?: number | null;
  ConResExp?: number | null;
  montant_produit?: number | null;
};

export interface TypeSpecificProjection {
  duree_travaux_estimee?: string | null;
  date_demarrage_prevue?: Date | null;
  qualite_signataire?: string | null;
  volume_prevu?: number | null;
  montant_produit?: number | null;
  budget_prevu?: number | null;
  con_res_geo?: number | null;
  con_res_exp?: number | null;
}

export type DemandeWithTypeSpecific = demandePortail &
  DemandeTypeProcedure & {
    demInitial?: demInitial | null;
    modification?: demModification | null;
    renouvellement?: ProcedureRenouvellement | null;
  };

const toNullableNumber = (value: number | null | undefined): number | null =>
  typeof value === 'number' && !Number.isNaN(value) ? value : null;

export function resolveTypeSpecificSection(
  demande: DemandeWithTypeSpecific,
): TypeSpecificSection {
  const label = demande.typeProcedure?.libelle?.toLowerCase() ?? '';

  if (label.includes('renouvel')) {
    return demande.renouvellement;
  }

  if (label.includes('modification')) {
    return demande.modification;
  }

  // Default to initial demande data
  return (
    demande.demInitial ?? demande.modification ?? demande.renouvellement ?? null
  );
}

export function mergeTypeSpecificFields<T extends DemandeWithTypeSpecific>(
  demande: T,
): T & TypeSpecificProjection {
  const section = resolveTypeSpecificSection(demande);

  if (!section) {
    return demande as T & TypeSpecificProjection;
  }

  const projection: TypeSpecificProjection = {
    duree_travaux_estimee:
      section.duree_trvx !== null && section.duree_trvx !== undefined
        ? String(section.duree_trvx)
        : null,
    date_demarrage_prevue: section.date_demarrage_prevue ?? null,
    qualite_signataire: section.qualite_signataire ?? null,
    volume_prevu: toNullableNumber(section.VolumePrevu),
    montant_produit: toNullableNumber(
      (section as TypeSpecificFields).montant_produit,
    ),
    con_res_geo: toNullableNumber((section as TypeSpecificFields).ConResGeo),
    con_res_exp: toNullableNumber((section as TypeSpecificFields).ConResExp),
  };

  projection.budget_prevu = projection.montant_produit ?? null;

  return Object.assign({}, demande, projection);
}
