type DemandeLike = {
  superficie?: number | null;
  date_demande?: string | Date | null;
  wilaya?: { nom_wilayaFR?: string | null } | null;
  commune?: {
    nom_communeFR?: string | null;
    daira?: {
      nom_dairaFR?: string | null;
      wilaya?: { nom_wilayaFR?: string | null } | null;
    } | null;
  } | null;
};

type ProcedureRelation = {
  procedure?: {
    demandes?: DemandeLike[];
  } | null;
  demandes?: DemandeLike[];
};

const extractDemandes = (permis: any): DemandeLike[] => {
  const collections: DemandeLike[][] = [];

  if (Array.isArray(permis?.permisProcedure)) {
    collections.push(
      ...(permis.permisProcedure as ProcedureRelation[]).map(
        (relation) => relation.procedure?.demandes ?? relation.demandes ?? [],
      ),
    );
  }

  if (Array.isArray(permis?.procedures)) {
    collections.push(
      ...permis.procedures.map(
        (procedure: any) => procedure.demandes ?? [],
      ),
    );
  }

  if (Array.isArray(permis?.demandes)) {
    collections.push(permis.demandes);
  }

  if (Array.isArray(permis?.procedure?.demandes)) {
    collections.push(permis.procedure.demandes);
  }

  return collections.flat();
};

const getLatestDemande = (permis: any): DemandeLike | null => {
  const demandes = extractDemandes(permis);
  if (!demandes.length) {
    return null;
  }

  return [...demandes].sort((a, b) => {
    const dateA = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
    const dateB = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
    return dateB - dateA;
  })[0];
};

export const computePermisSuperficie = (permis: any): number | null => {
  if (typeof permis?.superficie === 'number' && !Number.isNaN(permis.superficie)) {
    return permis.superficie;
  }

  const demandes = extractDemandes(permis);
  if (!demandes.length) {
    return null;
  }

  const sorted = [...demandes].sort((a, b) => {
    const dateA = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
    const dateB = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
    return dateB - dateA;
  });

  const surface = sorted.find(
    (demande) =>
      typeof demande?.superficie === 'number' && !Number.isNaN(demande.superficie),
  )?.superficie;

  return surface ?? null;
};

export const getPermisWilayaName = (permis: any): string | null => {
  const demande = getLatestDemande(permis);
  return (
    demande?.wilaya?.nom_wilayaFR ??
    demande?.commune?.daira?.wilaya?.nom_wilayaFR ??
    null
  );
};

export const getPermisCommuneName = (permis: any): string | null => {
  const demande = getLatestDemande(permis);
  return demande?.commune?.nom_communeFR ?? null;
};

export const getPermisDairaName = (permis: any): string | null => {
  const demande = getLatestDemande(permis);
  return demande?.commune?.daira?.nom_dairaFR ?? null;
};

export const getPermisTitulaireName = (permis: any): string | null => {
  // Do not use the direct permis.detenteur relation.
  // Always derive the holder from demandes -> detenteurDemande.
  const demandes = extractDemandes(permis);
  if (!demandes.length) {
    return null;
  }

  const sorted = [...demandes].sort((a: any, b: any) => {
    const dateA = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
    const dateB = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
    return dateB - dateA;
  });

  const latest: any = sorted[0];
  const detRel = Array.isArray(latest?.detenteurdemande)
    ? latest.detenteurdemande[0]
    : null;

  return detRel?.detenteur?.nom_societeFR ?? null;
};

export const getPermisSubstances = (permis: any): string[] => {
  const names = new Set<string>();

  // From permis.permisProcedure[].procedure.SubstanceAssocieeDemande
  if (Array.isArray(permis?.permisProcedure)) {
    permis.permisProcedure.forEach((rel: any) => {
      rel.procedure?.SubstanceAssocieeDemande?.forEach((assoc: any) => {
        const name = assoc?.substance?.nom_subFR;
        if (name) names.add(name);
      });
    });
  }

  // Also from direct permis.procedures[].SubstanceAssocieeDemande if present
  if (Array.isArray(permis?.procedures)) {
    permis.procedures.forEach((proc: any) => {
      proc.SubstanceAssocieeDemande?.forEach((assoc: any) => {
        const name = assoc?.substance?.nom_subFR;
        if (name) names.add(name);
      });
    });
  }

  return Array.from(names);
};
