import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Phase, Procedure, ProcedurePhase } from '@/src/types/procedure';

type UseStepperPhasesResult = {
  phases: Phase[];
  etapeIdForRoute: number | null;
  relations: any[];
};

/**
 * Construit les phases/étapes du stepper à partir de relation_phase_typeprocedure (ManyEtape).
 * Fallback : phases issues de ProcedurePhase si aucune relation trouvée.
 */
export function useStepperPhases(
  procedureData: Procedure | null,
  apiURL?: string,
  pageRoute?: string,
): UseStepperPhasesResult {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [relations, setRelations] = useState<any[]>([]);

  useEffect(() => {
    const loadRelations = async () => {
      if (!apiURL || !procedureData) return;
      const demande = (procedureData as any)?.demandes?.[0];
      const typeProcId = demande?.typeProcedure?.id;
      const typePermisId =
        demande?.permis?.id_typePermis ??
        demande?.id_typePermis ??
        demande?.typePermis?.id;
      if (!typeProcId || !typePermisId) return;

      const routeNamespace = pageRoute
        ? pageRoute.replace(/^\/+/, '').split('/')[0] ?? null
        : null;

      try {
        const combosResp = await axios.get(`${apiURL}/phases-etapes/combinaisons`, {
          withCredentials: true,
        });
        const combos = combosResp.data || [];
        const match = combos.find(
          (c: any) => c.id_typePermis === typePermisId && c.id_typeProc === typeProcId,
        );
        if (!match?.id_combinaison) return;

        const relResp = await axios.get(
          `${apiURL}/phases-etapes/relations/${match.id_combinaison}`,
          { withCredentials: true },
        );
        const rels = relResp.data || [];

        // Ne garder que les Étapes dont la route correspond au namespace courant
        const filteredRels =
          routeNamespace && Array.isArray(rels)
            ? rels.filter((rel: any) => {
                const route =
                  rel?.manyEtape?.page_route ??
                  rel?.manyEtape?.etape?.page_route ??
                  '';
                if (typeof route !== 'string' || route.length === 0) return false;
                const cleaned = route.replace(/^\/+/, '');
                return cleaned.startsWith(routeNamespace);
              })
            : rels;

        const relsToUse =
          Array.isArray(filteredRels) && filteredRels.length > 0 ? filteredRels : rels;

        setRelations(relsToUse);

        const phaseMap = new Map<number, any>();
        relsToUse.forEach((rel: any) => {
          const me = rel?.manyEtape;
          if (!me?.phase || !me?.etape) return;
          const phaseId = me.id_phase;
          if (!phaseMap.has(phaseId)) {
            phaseMap.set(phaseId, {
              ...me.phase,
              ordre: rel.ordre ?? me.phase.ordre ?? 0,
              etapes: [] as any[],
            });
          }
          const p = phaseMap.get(phaseId);
          p.etapes.push({
            ...me.etape,
            ordre_etape: me.ordre_etape ?? p.etapes.length + 1,
            page_route: me.page_route ?? me.etape.page_route ?? null,
          });
        });
        const orderedPhases = Array.from(phaseMap.values()).map((p: any) => ({
          ...p,
          etapes: p.etapes.sort(
            (a: any, b: any) => (a.ordre_etape ?? 0) - (b.ordre_etape ?? 0),
          ),
        }));
        orderedPhases.sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0));
        setPhases(orderedPhases);
      } catch (err) {
        console.warn('useStepperPhases: impossible de charger les relations', err);
      }
    };

    loadRelations();
  }, [apiURL, procedureData, pageRoute]);

  const fallbackPhases: Phase[] = useMemo(() => {
    if (!procedureData?.ProcedurePhase) return [];
    return (procedureData.ProcedurePhase as ProcedurePhase[])
      .slice()
      .sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre)
      .map((pp: ProcedurePhase) => ({
        ...pp.phase,
        ordre: pp.ordre,
      }));
  }, [procedureData]);

  const chosenPhases = phases.length > 0 ? phases : fallbackPhases;

  const etapeIdForRoute = useMemo(() => {
    if (pageRoute) {
      for (const rel of relations) {
        const me = rel?.manyEtape;
        if (me?.etape?.page_route === pageRoute || me?.page_route === pageRoute) {
          return me.etape?.id_etape ?? null;
        }
      }
      for (const phase of fallbackPhases) {
        const match = (phase as any).etapes?.find((e: any) => e.page_route === pageRoute);
        if (match) return match.id_etape;
      }
    }
    return null;
  }, [relations, fallbackPhases, pageRoute]);

  return { phases: chosenPhases, etapeIdForRoute, relations };
}
