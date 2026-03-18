type DetenteurRelation = {
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
  } | null;
};

type DemandeLike = {
  id_demande?: number | null;
  statut_demande?: string | null;
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
  detenteurdemande?: DetenteurRelation[] | null;
};

type ProcedureLike = {
  id_proc?: number | null;
  id?: number | null;
  statut_proc?: string | null;
  date_fin_proc?: string | Date | null;
  date_debut_proc?: string | Date | null;
  created_at?: string | Date | null;
  demandes?: DemandeLike[] | null;
  SubstanceAssocieeDemande?: Array<{
    substance?: {
      nom_subFR?: string | null;
      nom_subAR?: string | null;
    } | null;
  }> | null;
};

type ProcedureRelation = {
  id_proc?: number | null;
  date_octroi_proc?: string | Date | null;
  procedure?: ProcedureLike | null;
};

const normalizeStatus = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const isProcedureFinished = (procedure: ProcedureLike | null | undefined): boolean =>
  normalizeStatus(procedure?.statut_proc) === "TERMINEE";

const isDemandeAccepted = (demande: DemandeLike | null | undefined): boolean => {
  const status = normalizeStatus(demande?.statut_demande);
  return (
    status === "ACCEPTEE" ||
    status === "ACCEPTE" ||
    status === "VALIDEE" ||
    status === "VALIDE"
  );
};

const toDateScore = (value?: string | Date | null): number => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getProcedureEntries = (
  permis: any,
): Array<{ procedure: ProcedureLike; relation: ProcedureRelation | null }> => {
  const entries: Array<{ procedure: ProcedureLike; relation: ProcedureRelation | null }> = [];

  if (Array.isArray(permis?.permisProcedure)) {
    (permis.permisProcedure as ProcedureRelation[]).forEach((relation) => {
      const procedure = relation?.procedure;
      if (procedure) {
        entries.push({ procedure, relation });
      }
    });
  }

  if (Array.isArray(permis?.procedures)) {
    permis.procedures.forEach((procedure: ProcedureLike) => {
      if (procedure) {
        entries.push({ procedure, relation: null });
      }
    });
  }

  return entries;
};

const getProcedureSortScore = (
  procedure: ProcedureLike | null | undefined,
  relation?: ProcedureRelation | null,
): number => {
  const fromDates =
    toDateScore(procedure?.date_fin_proc) ||
    toDateScore(procedure?.date_debut_proc) ||
    toDateScore(procedure?.created_at) ||
    toDateScore(relation?.date_octroi_proc);

  if (fromDates > 0) {
    return fromDates;
  }

  const id =
    Number(relation?.id_proc ?? procedure?.id_proc ?? procedure?.id ?? 0) || 0;
  return Number.isFinite(id) ? id : 0;
};

const getLatestAcceptedDemande = (
  procedure: ProcedureLike | null | undefined,
): DemandeLike | null => {
  const demandes = Array.isArray(procedure?.demandes) ? procedure?.demandes : [];
  const accepted = demandes.filter((demande) => isDemandeAccepted(demande));
  if (!accepted.length) return null;
  const sorted = [...accepted].sort(
    (a, b) => toDateScore(b?.date_demande) - toDateScore(a?.date_demande),
  );
  return sorted[0] ?? null;
};

const getOfficialProcedure = (permis: any): ProcedureLike | null => {
  if (permis?.procedure_officielle) {
    return permis.procedure_officielle as ProcedureLike;
  }

  const entries = getProcedureEntries(permis);
  const official = entries
    .filter(({ procedure }) => {
      if (!isProcedureFinished(procedure)) return false;
      return !!getLatestAcceptedDemande(procedure);
    })
    .sort(
      (a, b) =>
        getProcedureSortScore(b.procedure, b.relation) -
        getProcedureSortScore(a.procedure, a.relation),
    );

  return official[0]?.procedure ?? null;
};

const getOfficialDemande = (permis: any): DemandeLike | null => {
  if (permis?.demande_officielle) {
    return permis.demande_officielle as DemandeLike;
  }
  const procedure = getOfficialProcedure(permis);
  return getLatestAcceptedDemande(procedure);
};

export const computePermisSuperficie = (permis: any): number | null => {
  if (
    typeof permis?.superficie_officielle === "number" &&
    !Number.isNaN(permis.superficie_officielle)
  ) {
    return permis.superficie_officielle;
  }

  const officialDemande = getOfficialDemande(permis);
  if (
    typeof officialDemande?.superficie === "number" &&
    !Number.isNaN(officialDemande.superficie)
  ) {
    return officialDemande.superficie;
  }

  if (typeof permis?.superficie === "number" && !Number.isNaN(permis.superficie)) {
    return permis.superficie;
  }

  return null;
};

export const getPermisWilayaName = (permis: any): string | null => {
  const explicit = permis?.localisation_officielle?.wilaya?.nom_wilayaFR;
  if (explicit) return explicit;
  const demande = getOfficialDemande(permis);
  return (
    demande?.wilaya?.nom_wilayaFR ??
    demande?.commune?.daira?.wilaya?.nom_wilayaFR ??
    null
  );
};

export const getPermisCommuneName = (permis: any): string | null => {
  const explicit = permis?.localisation_officielle?.commune?.nom_communeFR;
  if (explicit) return explicit;
  const demande = getOfficialDemande(permis);
  return demande?.commune?.nom_communeFR ?? null;
};

export const getPermisDairaName = (permis: any): string | null => {
  const explicit = permis?.localisation_officielle?.daira?.nom_dairaFR;
  if (explicit) return explicit;
  const demande = getOfficialDemande(permis);
  return demande?.commune?.daira?.nom_dairaFR ?? null;
};

export const getPermisTitulaireName = (permis: any): string | null => {
  const demande = getOfficialDemande(permis);
  const detRel = Array.isArray(demande?.detenteurdemande)
    ? demande?.detenteurdemande?.[0]
    : null;

  return (
    detRel?.detenteur?.nom_societeFR ??
    detRel?.detenteur?.nom_societeAR ??
    permis?.detenteur?.nom_societeFR ??
    permis?.detenteur?.nom_societeAR ??
    null
  );
};

export const getPermisSubstances = (permis: any): string[] => {
  const names = new Set<string>();

  if (Array.isArray(permis?.substances_officielles)) {
    permis.substances_officielles.forEach((name: unknown) => {
      const normalized = typeof name === "string" ? name.trim() : "";
      if (normalized) names.add(normalized);
    });
  }

  if (names.size > 0) {
    return Array.from(names);
  }

  const officialProcedure = getOfficialProcedure(permis);
  const list = Array.isArray(officialProcedure?.SubstanceAssocieeDemande)
    ? officialProcedure.SubstanceAssocieeDemande
    : [];

  list.forEach((assoc: any) => {
    const name =
      assoc?.substance?.nom_subFR ??
      assoc?.substance?.nom_subAR ??
      null;
    if (name) names.add(name);
  });

  return Array.from(names);
};

