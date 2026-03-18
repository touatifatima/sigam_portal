'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import router from 'next/router';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import ProgressStepper from '@/components/ProgressStepper';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useStepperPhases } from '@/src/hooks/useStepperPhases';
import { type Coordinate } from '@/components/arcgismap/ArcgisMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FiChevronLeft, FiChevronRight, FiLayers, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-toastify';
import styles from './cadastre5.module.css';
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from '@/src/types/procedure';

const ArcGISMap = dynamic(() => import('@/components/arcgismap/ArcgisMap'), { ssr: false });

type UtmPoint = {
  x: number;
  y: number;
  z?: number;
  zone?: number;
  hemisphere?: 'N' | 'S';
  system?: 'UTM';
};

type PermisLite = {
  id: number;
  code_permis?: string | null;
  detenteur?: { nom_societeFR?: string | null } | null;
  permisProcedure?: Array<{
    procedure?: {
      id_proc?: number;
      coordonnees?: Array<{
        id_coordonnees?: number;
        coordonnee?: {
          id_coordonnees?: number;
          x?: number;
          y?: number;
          z?: number | null;
          zone?: number | null;
          hemisphere?: 'N' | 'S' | null;
          system?: string | null;
        } | null;
      }>;
    } | null;
  }>;
};

type FusionUnionResponse = {
  success: boolean;
  within100?: boolean;
  shared_boundary_m?: number;
  area_ha?: number;
  ring_utm?: UtmPoint[];
  message?: string;
};

const toFinite = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const extractUtmCoordinates = (permis: PermisLite): UtmPoint[] => {
  const rels = Array.isArray(permis?.permisProcedure) ? permis.permisProcedure : [];
  for (const rel of rels) {
    const coords = rel?.procedure?.coordonnees || [];
    if (!Array.isArray(coords) || coords.length < 3) continue;
    const points: UtmPoint[] = [];
    coords.forEach((item) => {
      const c = item?.coordonnee;
      const x = toFinite(c?.x);
      const y = toFinite(c?.y);
      if (x == null || y == null) return;
      points.push({
        x,
        y,
        z: toFinite(c?.z) ?? undefined,
        zone: toFinite(c?.zone) ?? undefined,
        hemisphere: c?.hemisphere === 'S' ? 'S' : 'N',
        system: 'UTM',
      });
    });
    if (points.length >= 3) return points;
  }
  return [];
};

const toMapPoints = (pts: UtmPoint[]): Coordinate[] =>
  pts.map((p, idx) => ({
    id: idx + 1,
    idTitre: 1000 + idx,
    h: 0,
    x: p.x,
    y: p.y,
    system: 'UTM',
    zone: p.zone ?? 31,
    hemisphere: 'N',
  }));

export default function FusionCadastreStep1Page() {
  const searchParams = useSearchParams();
  const idProc = Number(searchParams?.get('id') || 0);
  const permisAId = Number(searchParams?.get('permisA') || 0);
  const permisBId = Number(searchParams?.get('permisB') || 0);
  const principalId = Number(searchParams?.get('principal') || permisAId || 0);

  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const { currentView, navigateTo } = useViewNavigator('operateur_nvl_demande');

  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [permisA, setPermisA] = useState<PermisLite | null>(null);
  const [permisB, setPermisB] = useState<PermisLite | null>(null);
  const [pointsA, setPointsA] = useState<UtmPoint[]>([]);
  const [pointsB, setPointsB] = useState<UtmPoint[]>([]);
  const [unionPoints, setUnionPoints] = useState<UtmPoint[]>([]);
  const [unionArea, setUnionArea] = useState<number>(0);
  const [sharedBoundary, setSharedBoundary] = useState<number>(0);

  const mapRef = useRef<any>(null);
  const { phases, etapeIdForRoute } = useStepperPhases(
    procedureData,
    apiURL,
    'operateur/fusion_permis/step1/page1',
  );
  const fallbackPhases: Phase[] = useMemo(() => {
    if (!procedureData?.ProcedurePhase) return [];
    return (procedureData.ProcedurePhase as ProcedurePhase[])
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map((pp) => ({ ...pp.phase, ordre: pp.ordre }));
  }, [procedureData]);
  const stepperPhases = phases.length ? phases : fallbackPhases;
  const resolvedEtapeId = useMemo(() => {
    if (etapeIdForRoute) return etapeIdForRoute;
    if (!procedureData) return 1;

    const normalize = (value?: string | null) =>
      (value ?? '')
        .replace(/^\/+/, '')
        .replace(/\.(tsx|ts|jsx|js|html)$/i, '')
        .trim()
        .toLowerCase();
    const target = normalize('operateur/fusion_permis/step1/page1');
    const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
    const phaseEtapes = phasesList.flatMap((pp) => pp.phase?.etapes || []);
    const byRoute = phaseEtapes.find((e: any) => {
      const route = normalize(e.page_route);
      return route === target || route.endsWith(target) || route.includes('step1/page1');
    });
    if (byRoute?.id_etape) return byRoute.id_etape;

    const byLabel = phaseEtapes.find((e: any) =>
      String(e?.lib_etape ?? '').toLowerCase().includes('cadastre'),
    );
    return byLabel?.id_etape ?? 1;
  }, [etapeIdForRoute, procedureData]);

  const canProceed = useMemo(
    () => idProc > 0 && permisAId > 0 && permisBId > 0 && unionPoints.length >= 3,
    [idProc, permisAId, permisBId, unionPoints.length],
  );

  const runUnion = useCallback(
    async (persistInProcedure: boolean) => {
      if (!apiURL) throw new Error('API non configurée');
      const payload: any = {
        id_permis_A: permisAId,
        id_permis_B: permisBId,
        id_permis_resultant: principalId || permisAId,
      };
      if (persistInProcedure) {
        payload.id_proc_fusion = idProc;
      }

      const res = await axios.post<FusionUnionResponse>(`${apiURL}/api/fusion-permis/union`, payload, {
        withCredentials: true,
      });
      const data = res.data;
      if (!data?.success || !Array.isArray(data.ring_utm)) {
        throw new Error(data?.message || 'Impossible de calculer la fusion des périmètres.');
      }
      setUnionPoints(data.ring_utm);
      setUnionArea(Number(data.area_ha || 0));
      setSharedBoundary(Number(data.shared_boundary_m || 0));
      return data;
    },
    [apiURL, idProc, permisAId, permisBId, principalId],
  );

  const loadAll = useCallback(async () => {
    if (!apiURL) {
      setError('API non configurée');
      setLoading(false);
      return;
    }
    if (!idProc || !permisAId || !permisBId) {
      setError('Paramètres de fusion manquants (id, permisA, permisB).');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [procRes, permisARes, permisBRes] = await Promise.all([
        axios.get<Procedure>(`${apiURL}/api/procedure-etape/procedure/${idProc}`, { withCredentials: true }),
        axios.get<PermisLite>(`${apiURL}/operateur/permis/${permisAId}`, { withCredentials: true }),
        axios.get<PermisLite>(`${apiURL}/operateur/permis/${permisBId}`, { withCredentials: true }),
      ]);

      setProcedureData(procRes.data);
      setPermisA(permisARes.data);
      setPermisB(permisBRes.data);

      const aPts = extractUtmCoordinates(permisARes.data);
      const bPts = extractUtmCoordinates(permisBRes.data);
      setPointsA(aPts);
      setPointsB(bPts);

      await runUnion(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erreur lors du chargement de la fusion.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [apiURL, idProc, permisAId, permisBId, runUnion]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (unionPoints.length < 3) return;
    const t = window.setTimeout(() => mapRef.current?.zoomToCurrentPolygon?.(), 300);
    return () => window.clearTimeout(t);
  }, [unionPoints]);

  const handleBack = () => {
    router.push(`/operateur/permisdashboard/${permisAId}`);
  };

  const handleNext = async () => {
    if (!canProceed) return;
    if (!apiURL) return;
    setSaving(true);
    setError(null);
    try {
      const unionData = await runUnion(true);
      if (!unionData?.success) {
        throw new Error(unionData?.message || 'Fusion non valide.');
      }
      if (resolvedEtapeId) {
        await axios.post(
          `${apiURL}/api/procedure-etape/finish/${idProc}/${resolvedEtapeId}`,
          undefined,
          { withCredentials: true },
        );
      }
      const demandeRes = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`, {
        withCredentials: true,
      });
      const idDemande = demandeRes?.data?.id_demande;
      const query = new URLSearchParams({
        id: String(idProc),
        permisA: String(permisAId),
        permisB: String(permisBId),
        principal: String(principalId || permisAId),
      });
      if (idDemande) query.set('id_demande', String(idDemande));
      router.push(`/operateur/fusion_permis/step2/page2?${query.toString()}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Impossible d'enregistrer le périmètre fusionné.";
      setError(String(msg));
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const existingPolygons = useMemo(() => {
    const polyA = pointsA.map((p) => [p.x, p.y] as [number, number]);
    const polyB = pointsB.map((p) => [p.x, p.y] as [number, number]);
    return [
      {
        idProc: permisAId,
        num_proc: permisA?.code_permis || `Permis ${permisAId}`,
        coordinates: polyA,
        zone: pointsA[0]?.zone ?? 31,
        hemisphere: pointsA[0]?.hemisphere ?? 'N',
        isWGS: false,
      },
      {
        idProc: permisBId,
        num_proc: permisB?.code_permis || `Permis ${permisBId}`,
        coordinates: polyB,
        zone: pointsB[0]?.zone ?? 31,
        hemisphere: pointsB[0]?.hemisphere ?? 'N',
        isWGS: false,
      },
    ].filter((p) => p.coordinates.length >= 3);
  }, [permisA?.code_permis, permisAId, permisB?.code_permis, permisBId, pointsA, pointsB]);

  const unionMapPoints = useMemo(() => toMapPoints(unionPoints), [unionPoints]);

  if (loading) {
    return (
      <div className={styles['app-container']}>
        <Navbar />
        <div className={styles['app-content']}>
          <Sidebar currentView={currentView} navigateTo={navigateTo} />
          <main className={styles['main-content']}>
            <div className={styles['content-wrapper']}>
              <div className={styles.loadingCard}>Chargement du cadastre de fusion...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['app-container']}>
      <Navbar />
      <div className={styles['app-content']}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles['main-content']}>
          <div className={styles['content-wrapper']}>
            <div className={styles.breadcrumb}>
              <span>POM</span>
              <span className={styles['breadcrumb-arrow']}>{'>'}</span>
              <span>Fusion permis</span>
              <span className={styles['breadcrumb-arrow']}>{'>'}</span>
              <span>Cadastre</span>
            </div>

            {stepperPhases.length > 0 && (
                <ProgressStepper
                  phases={stepperPhases}
                  currentProcedureId={idProc}
                  currentEtapeId={resolvedEtapeId}
                  procedurePhases={procedureData?.ProcedurePhase || []}
                  procedureEtapes={procedureData?.ProcedureEtape || ([] as ProcedureEtape[])}
                  procedureTypeId={procedureData?.demandes?.[0]?.typeProcedure?.id}
              />
            )}

            <div className={styles['cadastre-app']}>
              <div className={styles.cadastreHeader}>
                <div className={styles.cadastreTitle}>
                  <div className={styles.cadastreTitleIcon}>
                    <FiMapPin />
                  </div>
                  <div>
                    <h1>Validez votre fusion de perimetres</h1>
                    <p>
                      Verifiez la geometrie fusionnee ({permisA?.code_permis || permisAId} +{' '}
                      {permisB?.code_permis || permisBId}) avant de continuer.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className={styles.cadastreGrid}>
                <section className={styles.pointsPanel}>
                  <div className={styles.pointsHeader}>
                    <h3>Resume de fusion</h3>
                    <p>Comparaison et validation des donnees fusionnees</p>
                  </div>
                  <div className={styles['panel-content']}>
                    <div className={styles.fusionSummaryCard}>
                      <h3 className={styles.fusionSectionTitle}>Resume fusion</h3>
                      <div className={styles.fusionSummaryGrid}>
                        <div className={styles.fusionSummaryItem}>
                          <span className={styles.fusionSummaryLabel}>Permis A</span>
                          <strong className={styles.fusionSummaryValue}>{permisA?.code_permis || permisAId}</strong>
                        </div>
                        <div className={styles.fusionSummaryItem}>
                          <span className={styles.fusionSummaryLabel}>Permis B</span>
                          <strong className={styles.fusionSummaryValue}>{permisB?.code_permis || permisBId}</strong>
                        </div>
                        <div className={styles.fusionSummaryItem}>
                          <span className={styles.fusionSummaryLabel}>Permis principal</span>
                          <strong className={styles.fusionSummaryValue}>{principalId}</strong>
                        </div>
                        <div className={styles.fusionSummaryItem}>
                          <span className={styles.fusionSummaryLabel}>Frontiere commune</span>
                          <strong className={styles.fusionSummaryValue}>{sharedBoundary.toFixed(2)} m</strong>
                        </div>
                        <div className={styles.fusionSummaryItem}>
                          <span className={styles.fusionSummaryLabel}>Superficie fusionnee</span>
                          <strong className={`${styles.fusionSummaryValue} ${styles.fusionPrimaryValue}`}>
                            {unionArea.toFixed(2)} ha
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className={styles.fusionDivider} />

                    <h4 className={styles.fusionSectionSubtitle}>Points du perimetre fusionne</h4>
                    <div className={styles.fusionTableWrap}>
                      <table className={styles.fusionTable}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>X</th>
                            <th>Y</th>
                            <th>Fuseau</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unionPoints.map((p, idx) => (
                            <tr key={`${p.x}-${p.y}-${idx}`}>
                              <td>{idx + 1}</td>
                              <td>{p.x.toFixed(2)}</td>
                              <td>{p.y.toFixed(2)}</td>
                              <td>{p.zone ?? p.z ?? 31}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className={styles.mapPanel}>
                  <div className={styles.mapHeader}>
                    <h3>
                      <FiMapPin /> Visualisation du perimetre fusionne
                    </h3>
                    <span className={styles.badge}>
                      <FiLayers /> 2 perimetres + union
                    </span>
                  </div>
                  <div className={styles.mapCanvas}>
                    <ArcGISMap
                      ref={mapRef}
                      points={unionMapPoints}
                      superficie={unionArea}
                      isDrawing={false}
                      editable={false}
                      coordinateSystem="UTM"
                      utmZone={unionMapPoints[0]?.zone ?? 31}
                      existingPolygons={existingPolygons}
                      showFuseaux={false}
                    />
                  </div>
                </section>
              </div>

              <div className={styles['navigation-buttons']}>
                <button
                  type="button"
                  className={`${styles['btn']} ${styles['btn-outline']}`}
                  onClick={handleBack}
                >
                  <FiChevronLeft />
                  Precedent
                </button>
                <button
                  type="button"
                  className={`${styles['btn']} ${styles['btn-primary']}`}
                  onClick={handleNext}
                  disabled={!canProceed || saving}
                >
                  {saving ? 'Enregistrement...' : 'Suivant'}
                  <FiChevronRight />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



