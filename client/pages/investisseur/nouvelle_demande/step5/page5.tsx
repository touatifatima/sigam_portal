'use client';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FiPlus, FiTrash2, FiCheckCircle, FiAlertTriangle, FiMapPin, FiEdit2, FiRefreshCw, FiChevronLeft, FiDownload, FiUpload, FiChevronRight, FiLayers, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import * as turf from '@turf/turf';
import styles from './cadastre5.module.css';
import { useRouter } from 'next/router';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import axios from 'axios';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import { useViewNavigator } from '../../../../src/hooks/useViewNavigator';
import ProgressStepper from '../../../../components/ProgressStepper';
import { useStepperPhases } from '@/src/hooks/useStepperPhases';
import { STEP_LABELS } from '../../../../src/constants/steps';
import { useActivateEtape } from '@/src/hooks/useActivateEtape';
import dynamic from 'next/dynamic';
import { Phase, Procedure, ProcedureEtape, ProcedurePhase, StatutProcedure } from '@/src/types/procedure';
import proj4 from 'proj4';

const ArcGISMap = dynamic(() => import('@/components/arcgismap/ArcgisMap'), { ssr: false });

export type CoordinateSystem = 'UTM';

type Point = {
  id: number;
  idTitre: number;
  h: number;
  x: number;
  y: number;
  system: CoordinateSystem;
  zone?: number;
  hemisphere?: 'N';
};

// Nord Sahara -> WGS84 7-parameter transformation (JO 30/11/2022).
// Published parameters are WGS84 -> Nord Sahara; signs inverted for +towgs84.
const NORD_SAHARA_TOWGS84 = {
  dx: -267.407,
  dy: -47.068,
  dz: 446.357,
  rx: -0.179423,
  ry: 5.577661,
  rz: -1.277620,
  ds: 1.204866,
};

// Same empirical UTM offsets as ArcGIS map (meters), per fuseau
const getUtmShift = (zone: number) => {
  switch (zone) {
    case 29:
      return { x: 0, y: 0 };
    case 30:
      return { x: 0, y: 0 };
    case 31:
       return { x: 0, y: 0 };
    case 32:
      return { x: 0, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
};

const coerceUtmZone = (value: unknown, fallback: number) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 29 && num <= 32) {
    return Math.trunc(num);
  }
  return fallback;
};

type PermitData = {
  code: string;
  type: string;
  holder: string;
  wilaya: string;
  daira: string;
  commune: string;
};

type ExistingPolygon = {
  idProc: number;
  num_proc: string;
  coordinates: [number, number][];
  zone?: number;
  hemisphere?: 'N' | 'S';
  isWGS?: boolean;
  typeLabel?: string;
  codeDemande?: string;
};

export default function CadastrePage() {
  const DEFAULT_PROC_LABEL = 'Procédure';
  const [idDemande, setIdDemande] = useState<number | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [superficie, setSuperficie] = useState(0);
  const [superficieDeclaree, setSuperficieDeclaree] = useState<number | null>(null);
  const [superficieCadastrale, setSuperficieCadastrale] = useState<number | null>(null);
  const [minDistanceM, setMinDistanceM] = useState<number | null>(null);
  const [nearestTitle, setNearestTitle] = useState<{ code?: string | null; label?: string | null; distance?: number | null } | null>(null);
  const [sitGeoOk, setSitGeoOk] = useState<boolean>(false);
  const [empietOk, setEmpietOk] = useState<boolean>(false);
  const [geomOk, setGeomOk] = useState<boolean>(false);
  const [superfOk, setSuperfOk] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTab, setActiveTab] = useState('coordinates');
  const [comment, setComment] = useState('');
  const [overlapDetected, setOverlapDetected] = useState(false);
  const [overlapPermits, setOverlapPermits] = useState<string[]>([]);
  const [miningTitleOverlaps, setMiningTitleOverlaps] = useState<any[]>([]);
  const [isCheckingOverlaps, setIsCheckingOverlaps] = useState(false);
  const [lastOverlapCheckInfo, setLastOverlapCheckInfo] = useState<{
    at: string;
    layersLabel: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const idProcStr = searchParams?.get('id');
  const idProc = idProcStr ? parseInt(idProcStr, 10) : undefined;
  const [error, setError] = useState<string | null>(null);
  const [savingEtape, setSavingEtape] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { auth, isLoaded, hasPermission } = useAuthStore();
  const isCadastre = auth.role === 'cadastre';
  const [isPolygonValid, setIsPolygonValid] = useState(true);
  const hasUniqueCoords = new Set(points.map(p => `${p.x},${p.y}`)).size === points.length;
  const [demandeSummary, setDemandeSummary] = useState<any>(null);
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const currentStep = 5;
  const [isLoading, setIsLoading] = useState(false);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [permitData, setPermitData] = useState<PermitData>({
    code: '',
    type: '',
    holder: '',
    wilaya: '',
    daira: '',
    commune: ''
  });
  const mapRef = useRef<any>(null);
  const [statutProc, setStatutProc] = useState<string | undefined>(undefined);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [currentEtape, setCurrentEtape] = useState<{ id_etape: number } | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>();
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [hasActivatedStep5, setHasActivatedStep5] = useState(false);
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('UTM');
  const [utmZone, setUtmZone] = useState<number>(31);
  const [utmHemisphere, setUtmHemisphere] = useState<'N'>('N');
  const [activatedSteps, setActivatedSteps] = useState<Set<number>>(new Set());
  const [editableRowId, setEditableRowId] = useState<number | null>(null);
  const lockPerimeter = useMemo(() => {
    const code = (demandeSummary?.typePermis?.code_type || '').toUpperCase();
    return code.startsWith('TX');
  }, [demandeSummary]);
  // Source des coordonnées: inscription provisoire vs coordonnées validées
  // Source des coordonnées: inscription provisoire vs coordonnées validées
  const [coordSource, setCoordSource] = useState<'provisoire' | 'validees'>('provisoire');
  const [provisionalPoints, setProvisionalPoints] = useState<Point[]>([]);
  const [validatedPoints, setValidatedPoints] = useState<Point[]>([]);
	  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
	  const [existingPolygons, setExistingPolygons] = useState<ExistingPolygon[]>([]);
  const [showFuseaux, setShowFuseaux] = useState(false);
  const [historyProcedures, setHistoryProcedures] = useState<{ procId: number; typeLabel: string; codeDemande?: string }[]>([]);
  const [selectedHistoryProcId, setSelectedHistoryProcId] = useState<number | null>(null);
  const historyProcCacheRef = useRef<Map<number, { typeLabel: string; codeDemande?: string }>>(new Map());
  const [historyMetaVersion, setHistoryMetaVersion] = useState(0);
  const [searchTitreCode, setSearchTitreCode] = useState('');
  const [searchPerimetreCode, setSearchPerimetreCode] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const handleSearchPerimetre = useCallback(async () => {
    const code = (searchPerimetreCode || '').trim();
    if (!code) return;
    try {
      const ok = await mapRef.current?.searchPerimetreByPermisCode?.(code);
      if (!ok) {
        await mapRef.current?.searchTitreByCode?.(code);
      }
      // setSearchMessage('Recherche périmètre terminée (cycle si plusieurs résultats).');
    } catch {
      // Keep silent to avoid noisy popups in fullscreen
    }
  }, [searchPerimetreCode]);
  const [detectedLieu, setDetectedLieu] = useState<{ wilaya?: string; commune?: string; ville?: string }>({});
  const handleAdminDetected = useCallback((loc: { wilaya?: string; commune?: string; ville?: string }) => {
    setDetectedLieu(loc || {});
  }, []);
  const refreshDetectedLieu = useCallback(async () => {
    if (!points || points.length === 0) return;
    try {
      const payloadPoints = points.map((p) => ({
        x: p.x,
        y: p.y,
        system: p.system,
        zone: p.zone ?? utmZone,
        hemisphere: p.hemisphere ?? utmHemisphere,
      }));
      const resp = await axios.post(`${apiURL}/gis/admin-location`, {
        points: payloadPoints,
      });
      const data = resp.data || {};
      setDetectedLieu({
        wilaya: data.wilaya ?? detectedLieu.wilaya,
        commune: data.commune ?? detectedLieu.commune,
        ville: data.ville ?? detectedLieu.ville,
      });
    } catch (e) {
      console.warn('Failed to refresh detected lieu via backend', e);
    }
  }, [apiURL, points, utmZone, utmHemisphere, detectedLieu]);

  // Helper: shallow-equality of arrays of points on key geometry/admin fields
  const equalPoints = (a: Point[] = [], b: Point[] = []) => {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const p = a[i], q = b[i];
      if (!q) return false;
      if (p.x !== q.x || p.y !== q.y) return false;
      if ((p.zone ?? null) !== (q.zone ?? null)) return false;
      if ((p.hemisphere ?? null) !== (q.hemisphere ?? null)) return false;
      if (p.system !== q.system) return false;
    }
    return true;
  };

  // Helper: apply selected dataset to UI in one pass (no reactive ping-pong)
  const applySourceFromArrays = (
    prov: Point[],
    val: Point[],
    source: 'provisoire' | 'validees'
  ) => {
    const data = source === 'provisoire' ? prov : val;
    if (data && data.length > 0) {
      if (!equalPoints(points, data)) setPoints(data);
      const first = data[0];
      if (first?.system) {
        setCoordinateSystem(first.system);
        const zoneHint = coerceUtmZone(first.zone, utmZone);
        if (zoneHint !== utmZone) setUtmZone(zoneHint);
        if (first.hemisphere) setUtmHemisphere(first.hemisphere);
      }
    } else {
      if (points.length) setPoints([]);
    }
  };

  const dedupeTitles = (titles: any[] = []) => {
    const seen = new Set<string>();
    return titles.filter((t) => {
      const key = [
        t.idtitre ?? '',
        t.code ?? '',
        t.objectid ?? '',
        t.codetype ?? '',
        t.typetitre ?? '',
        t.tnom ?? '',
        t.tprenom ?? ''
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Stable signature of current displayed points to avoid re-applying same dataset
  
  const router = useRouter();

  // When a title/perimeter polygon is clicked on the ArcGIS map:
  // - Extract `code_permis` from layer attributes
  // - Resolve the permit in SIGAM (Postgres) and load all related procedures + their coordinates
  // - Populate the dropdown (historique) and show coordinates on the map
  const handleTitreSelected = useCallback(
    async (attrs: any) => {
      if (!attrs) {
        setExistingPolygons([]);
        setHistoryProcedures([]);
        setSelectedHistoryProcId(null);
        return;
      }

      // Attributes coming from ArcGIS FeatureServer can vary by layer.
      // Prefer permit code (permis_code / code / code_permis) over internal ids.
      const lower: Record<string, any> = Object.fromEntries(
        Object.entries(attrs || {}).map(([k, v]) => [String(k).toLowerCase(), v]),
      );
      const rawZone =
        lower['zone'] ??
        lower['utm_zone'] ??
        lower['zoneutm'] ??
        lower['zone_utm'] ??
        lower['idzone'] ??
        lower['fuseau'] ??
        lower['__utm_zone'];
      const parsedZone = Number(rawZone);
      const zoneFallback = Number.isFinite(parsedZone) ? parsedZone : undefined;
      if (zoneFallback !== undefined) {
        setUtmZone(zoneFallback);
      }
      const rawHem =
        lower['hemisphere'] ??
        lower['hemi'] ??
        lower['hem'] ??
        lower['__utm_hemisphere'];
      if (rawHem) {
        const hemi = String(rawHem).toUpperCase().startsWith('S') ? 'S' : 'N';
        if (hemi === 'N') {
          setUtmHemisphere('N');
        }
      }
      const rawPermisCode =
        lower['code_permis'] ??
        lower['permis_code'] ??
        lower['permiscode'] ??
        lower['codepermis'] ??
        lower['code'] ??
        lower['titre_code'];
      const permisCode = rawPermisCode !== undefined && rawPermisCode !== null ? String(rawPermisCode).trim() : '';

      if (!permisCode) {
        setExistingPolygons([]);
        setHistoryProcedures([]);
        setSelectedHistoryProcId(null);
        return;
      }

      try {
        const res = await axios.get(`${apiURL}/coordinates/permis-code/${encodeURIComponent(permisCode)}`);
        const rawPolygons = Array.isArray(res.data?.polygons) ? res.data.polygons : [];

        const polygons: ExistingPolygon[] = rawPolygons
          .map((p: any) => {
            const idProcNum = Number(p?.idProc ?? p?.id_proc ?? p?.id_proc ?? p?.procId);
            if (!Number.isFinite(idProcNum)) return null;

            const coords = Array.isArray(p?.coordinates)
              ? (p.coordinates
                  .map((c: any) => [Number(c?.[0]), Number(c?.[1])] as [number, number])
                  .filter((c: any) => Number.isFinite(c[0]) && Number.isFinite(c[1])) as [number, number][])
              : ([] as [number, number][]);

            const zoneVal = p?.zone;
            const zone = zoneVal !== undefined && zoneVal !== null && zoneVal !== '' ? Number(zoneVal) : undefined;
            const hemRaw = (p?.hemisphere ?? 'N').toString().toUpperCase();
            const hemisphere = (hemRaw.startsWith('S') ? 'S' : 'N') as 'N' | 'S';

            return {
              idProc: idProcNum,
              num_proc: String(p?.num_proc ?? p?.numProc ?? idProcNum),
              typeLabel: p?.typeLabel ?? undefined,
              codeDemande: p?.codeDemande ?? undefined,
              coordinates: coords,
              zone: Number.isFinite(zone as any) ? (zone as number) : zoneFallback,
              hemisphere,
              isWGS: Boolean(p?.isWGS),
            };
          })
          .filter((p: any): p is ExistingPolygon => !!p);

        setExistingPolygons(polygons);
        const detectedZone = polygons.find((p) => p.zone)?.zone;
        const detectedHemisphere = polygons.find((p) => p.hemisphere)?.hemisphere;
        if (Number.isFinite(detectedZone as any)) {
          setUtmZone(detectedZone as number);
        }
        if (detectedHemisphere === 'N') {
          setUtmHemisphere('N');
        }
        if (polygons.length > 0) {
          const metaMap = new Map<number, { typeLabel?: string; codeDemande?: string }>();
          polygons.forEach((p) => {
            metaMap.set(p.idProc, { typeLabel: p.typeLabel, codeDemande: p.codeDemande });
            if (p.typeLabel || p.codeDemande) {
              historyProcCacheRef.current.set(p.idProc, {
                typeLabel: p.typeLabel || DEFAULT_PROC_LABEL,
                codeDemande: p.codeDemande,
              });
            }
          });
          const baseList = Array.from(new Set(polygons.map((p) => p.idProc))).map((pid) => ({
            procId: pid,
            typeLabel: metaMap.get(pid)?.typeLabel || DEFAULT_PROC_LABEL,
            codeDemande: metaMap.get(pid)?.codeDemande,
          }));
          setHistoryProcedures(baseList);
        } else {
          setHistoryProcedures([]);
        }
        setSelectedHistoryProcId(null);
      } catch (e) {
        console.error('Failed to load SIGAM procedure history for permis', permisCode, e);
        setExistingPolygons([]);
        setHistoryProcedures([]);
        setSelectedHistoryProcId(null);
      }
    },
    [apiURL],
  );

  const fetchProcedureData = async () => {
    if (!idProc) return;
    try {
      const response = await axios.get<Procedure>(`${apiURL}/api/procedure-etape/procedure/${idProc}`);
      setProcedureData(response.data);
      if (response.data.demandes && response.data.demandes.length > 0) {
        setProcedureTypeId(response.data.demandes[0].typeProcedure?.id);
      }
      const activeEtape = response.data.ProcedureEtape.find((pe: ProcedureEtape) => pe.statut === 'EN_COURS');
      if (activeEtape) {
        setCurrentEtape({ id_etape: activeEtape.id_etape });
      }
    } catch (error) {
      console.error('Error fetching procedure data:', error);
      setError('Failed to fetch procedure data');
      setTimeout(() => setError(null), 4000);
    }
  };

  useEffect(() => {
    fetchProcedureData();
  }, [idProc, refetchTrigger]);

  // Charger les périmètres existants (désactivé : on ne lit plus depuis /coordinates/existing ici)
  useEffect(() => {
    // On part d'aucun historique au chargement.
    setExistingPolygons([]);
  }, [apiURL]);

  // Historique des procedures : construire la liste a partir des perimetres existants
  useEffect(() => {
    if (!existingPolygons || existingPolygons.length === 0) {
      setHistoryProcedures([]);
      return;
    }

    const uniqueIds = Array.from(
      new Set(
        existingPolygons
          .map((p) => p.idProc)
          .filter((v) => typeof v === 'number' && !Number.isNaN(v)),
      ),
    ) as number[];

    const baseList = uniqueIds
      .map((pid) => ({
        procId: pid,
        typeLabel: 'Procédure',
        codeDemande: undefined as string | undefined,
      }))
      .sort((a, b) => a.procId - b.procId);

    setHistoryProcedures((prev) => {
      const prevMap = new Map(prev.map((p) => [p.procId, p]));
      return baseList.map((b) => {
        const prevItem = prevMap.get(b.procId);
        const cached = historyProcCacheRef.current.get(b.procId);
        return {
          procId: b.procId,
          typeLabel: cached?.typeLabel || prevItem?.typeLabel || b.typeLabel,
          codeDemande: cached?.codeDemande ?? prevItem?.codeDemande ?? b.codeDemande,
        };
      });
    });
  }, [existingPolygons]);

  // Précharger les métadonnées pour toutes les procédures listées (pas seulement la sélection)
  useEffect(() => {
    const idsToLoad = historyProcedures
      .map((h) => h.procId)
      .filter((pid) => !historyProcCacheRef.current.has(pid));

    const applyCachedMeta = () => {
      setHistoryProcedures((prev) => {
        let changed = false;
        const next = prev.map((p) => {
          const cached = historyProcCacheRef.current.get(p.procId);
          if (!cached) return p;
          const typeLabel = cached.typeLabel || p.typeLabel;
          const codeDemande = cached.codeDemande ?? p.codeDemande;
          if (typeLabel !== p.typeLabel || codeDemande !== p.codeDemande) {
            changed = true;
            return { ...p, typeLabel, codeDemande };
          }
          return p;
        });
        return changed ? next : prev;
      });
    };

    // Even if everything is already cached, re-apply cached labels to the UI list.
    // (The list can be reset when existingPolygons is refreshed/selected.)
    if (!idsToLoad.length) {
      applyCachedMeta();
      return;
    }

    const loadAll = async () => {
      await Promise.all(
        idsToLoad.map(async (pid) => {
          try {
            const res = await axios.get(`${apiURL}/api/procedures/${pid}/demande`, {
              withCredentials: true,
            });
            const d = res.data;
            const info = {
              typeLabel:
                d?.typeProcedure?.libelle ||
                d?.typeProcedure?.Libelle ||
                d?.typeProcedure?.label ||
                'Procédure',
              codeDemande: d?.code_demande as string | undefined,
            };
            historyProcCacheRef.current.set(pid, info);
          } catch (e) {
            console.error('Failed to load procedure meta for history id', pid, e);
          }
        }),
      );

      // Appliquer les métadonnées récupérées
      applyCachedMeta();
    };

    loadAll();
  }, [historyProcedures, apiURL]);

  // Historique des procedures : enrichir la procedure selectionnee via l'API
  useEffect(() => {
    const pid = selectedHistoryProcId;
    if (!pid) return;

    // Deje en cache ?
    if (historyProcCacheRef.current.has(pid)) {
      const cached = historyProcCacheRef.current.get(pid)!;
      setHistoryProcedures((prev) =>
        prev.map((p) =>
          p.procId === pid ? { ...p, ...cached } : p,
        ),
      );
      return;
    }

    const loadMeta = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${pid}/demande`, {
          withCredentials: true,
        });
        const d = res.data;
        const info = {
          typeLabel:
            d?.typeProcedure?.libelle ||
            d?.typeProcedure?.Libelle ||
            d?.typeProcedure?.label ||
            'Procédure',
          codeDemande: d?.code_demande as string | undefined,
        };

        historyProcCacheRef.current.set(pid, info);

        setHistoryProcedures((prev) =>
          prev.map((p) =>
            p.procId === pid ? { ...p, ...info } : p,
          ),
        );
      } catch (e) {
        console.error('Failed to load procedure meta for history id', pid, e);
      }
    };

    loadMeta();
  }, [selectedHistoryProcId, apiURL]);

  // Load coordinates for the selected historic procedure (ProcedureCoord table)
  useEffect(() => {
    const pid = selectedHistoryProcId;
    if (!pid) return;
    const loadCoords = async () => {
      try {
        const res = await axios.get(`${apiURL}/coordinates/procedure/${pid}`);
        const coordsRaw = Array.isArray(res.data) ? res.data : [];
        const mapped = coordsRaw
          .map((c: any) => {
            const cx = c?.coordonnee?.x ?? c?.x;
            const cy = c?.coordonnee?.y ?? c?.y;
            const zone = c?.coordonnee?.zone ?? c?.zone;
            const hemisphere = c?.coordonnee?.hemisphere ?? c?.hemisphere ?? 'N';
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
            return {
              coord: [Number(cx), Number(cy)] as [number, number],
              zone: zone ? Number(zone) : undefined,
              hemisphere: hemisphere === 'S' ? 'S' : 'N',
            };
          })
          .filter((v: any): v is { coord: [number, number]; zone?: number; hemisphere?: 'N' | 'S' } => !!v);

        const coords: [number, number][] = mapped.map((m) => m!.coord);

        const detectedZone = mapped.find((m) => m?.zone)?.zone;
        const detectedHemisphere = mapped.find((m) => m?.hemisphere)?.hemisphere as 'N' | 'S' | undefined;

        if (coords.length >= 3) {
          setExistingPolygons((prev) => {
            const others = (prev || []).filter((p) => p.idProc !== pid);
            return [
              ...others,
              {
                idProc: pid,
                num_proc: String(pid),
                coordinates: coords,
                zone: detectedZone,
                hemisphere: detectedHemisphere,
              },
            ];
          });
          if (Number.isFinite(detectedZone as any)) {
            setUtmZone(detectedZone as number);
          }
          if (detectedHemisphere === 'N') {
            setUtmHemisphere('N');
          }
        } else {
          console.warn('No valid coordinates found for procedure', pid);
        }
      } catch (e) {
        console.error('Failed to load coordinates for historic procedure', pid, e);
        setExistingPolygons([]);
      }
    };
    loadCoords();
  }, [selectedHistoryProcId, apiURL]);

  // (historique de procédures chargé à la demande via selectedHistoryProcId)

  // Charger les deux jeux de coordonnées (provisoires et validées)
  useEffect(() => {
  if (!idProc) return;
  const load = async () => {
    let provArr: Point[] = [];
    let valArr: Point[] = [];
    let fallbackZone = 31;
    let fallbackHemisphere: 'N' = 'N';
    // Provisoires
    try {
      const provRes = await axios.get(`${apiURL}/inscription-provisoire/procedure/${idProc}`);
      const rec = provRes.data;
      const pts = Array.isArray(rec?.points) ? rec.points : [];
      const zoneVal = coerceUtmZone(pts[0]?.zone ?? rec?.zone, 31);
      fallbackZone = zoneVal;
      let baseId = generateId();
      provArr = pts.map((p: any, i: number) => ({
        id: baseId + i,
        idTitre: 1007,
        h: 32,
        x: Number(p.x),
        y: Number(p.y),
        system: p.system || 'UTM',
        zone: coerceUtmZone(p?.zone, zoneVal),
        hemisphere: fallbackHemisphere,
      }));
      if (typeof rec?.superficie_declaree === 'number') setSuperficieDeclaree(rec.superficie_declaree);
    } catch {}
    setProvisionalPoints(provArr);

    // Validées
    try {
      const res = await axios.get(`${apiURL}/coordinates/procedure/${idProc}`);
      const coords = (res.data ?? []).filter((c: any) => c?.coordonnee?.x !== undefined && c?.coordonnee?.y !== undefined);
      let baseId = generateId();
      valArr = coords.map((c: any, i: number) => {
        const coord = c?.coordonnee ?? c;
        const zoneVal = coerceUtmZone(coord?.zone, fallbackZone);
        return {
          id: coord?.id_coordonnees ?? coord?.id ?? (baseId + i),
          idTitre: coord?.idTitre || 1007,
          h: coord?.h || 32,
          x: Number(coord?.x),
          y: Number(coord?.y),
          system: coord?.system || 'UTM',
          zone: zoneVal,
          hemisphere: (coord?.hemisphere as 'N' | undefined) ?? fallbackHemisphere,
        } as Point;
      });
    } catch {}
    setValidatedPoints(valArr);

    // Apply selection once from freshly loaded arrays
    applySourceFromArrays(provArr, valArr, coordSource);
  };
  load();
}, [idProc, apiURL, refetchTrigger]);

  // Reflect selected source (provisoire/validées) into displayed points
  useEffect(() => {
    applySourceFromArrays(provisionalPoints, validatedPoints, coordSource);
  }, [coordSource, provisionalPoints, validatedPoints]);

  


  useActivateEtape({
    idProc,
    etapeNum: 5,
    shouldActivate: currentStep === 5 && !activatedSteps.has(5),
    onActivationSuccess: (stepStatus: string) => {
      if (stepStatus === 'TERMINEE') {
        setActivatedSteps(prev => new Set(prev).add(5));
        setHasActivatedStep5(true);
        return;
      }

      setActivatedSteps(prev => new Set(prev).add(5));
      setHasActivatedStep5(true);
      setTimeout(() => setRefetchTrigger(prev => prev + 1), 500);
    }
  });

  const { phases: stepperPhases, etapeIdForRoute } = useStepperPhases(procedureData, apiURL, 'investisseur/nouvelle_demande/step5/page5');
  const fallbackPhases: Phase[] = procedureData?.ProcedurePhase
    ? procedureData.ProcedurePhase.slice().sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre).map((pp: ProcedurePhase) => ({ ...pp.phase, ordre: pp.ordre }))
    : [];
  const phases: Phase[] = stepperPhases.length > 0 ? stepperPhases : fallbackPhases;

  const etapeIdForThisPage = useMemo(() => {
    if (etapeIdForRoute) return etapeIdForRoute;
    if (!procedureData) return null;
    const pathname = 'investisseur/nouvelle_demande/step5/page5';
    const normalize = (value?: string | null) =>
      (value ?? '')
        .replace(/^\/+/, '')
        .replace(/\.(tsx|ts|jsx|js|html)$/i, '')
        .trim()
        .toLowerCase();
    const target = normalize(pathname);
    const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
    const phaseEtapes = phasesList.flatMap((pp) => pp.phase?.etapes || []);
    const byRoute = phaseEtapes.find((e: any) => {
      const route = normalize(e.page_route);
      return route === target || route.endsWith(target) || route.includes('step5/page5');
    });
    if (byRoute) return byRoute.id_etape;
    const allEtapes = [
      ...phaseEtapes,
      ...((procedureData.ProcedureEtape || []).map((pe: any) => pe.etape).filter(Boolean) as any[]),
    ];
    const byLabel = allEtapes.find((e: any) =>
      String(e?.lib_etape ?? '').toLowerCase().includes('cadastre'),
    );
    return byLabel?.id_etape ?? 5;
  }, [etapeIdForRoute, procedureData]);

  const isStepSaved = useMemo(() => {
    if (!procedureData || !etapeIdForThisPage) return false;
    return (procedureData.ProcedureEtape || []).some(
      (pe) => pe.id_etape === etapeIdForThisPage && pe.statut === 'TERMINEE',
    );
  }, [procedureData, etapeIdForThisPage]);

  useEffect(() => {
    if (!idDemande) return;
    const fetchSummary = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/demande/${idDemande}/summary`);
        setDemandeSummary(res.data);
      } catch (error) {
        console.error("? Failed to fetch summary", error);
        setError('Failed to fetch demande summary');
        setTimeout(() => setError(null), 4000);
      }
    };
    fetchSummary();
  }, [idDemande]);

  useEffect(() => {
    if (demandeSummary) {
      setPermitData({
        code: demandeSummary.code_demande || '',
        type: demandeSummary.typePermis?.lib_type || '',
        holder:
          demandeSummary.detenteur?.nom_societeFR ||
          demandeSummary.detenteurdemande?.[0]?.detenteur?.nom_societeFR ||
          '',
        wilaya: demandeSummary.wilaya?.nom_wilayaFR || '',
        daira: demandeSummary.daira?.nom_dairaFR || '',
        commune: demandeSummary.commune?.nom_communeFR || ''
      });
      // Try to fill declared surface from summary if available
      try {
        const sd = (demandeSummary.superficie_declaree ?? demandeSummary.superficieDeclaree ?? demandeSummary.superficie_declaree_ha ?? null);
        if (typeof sd === 'number') setSuperficieDeclaree(sd);
      } catch {}
    }
  }, [demandeSummary]);

  const generateId = () => {
    return Math.max(...points.map(p => p.id), 0) + 1;
  };

  const addPoint = useCallback((coords?: { x: number, y: number }) => {
    const last = points.length > 0 ? points[points.length - 1] : undefined;
    // Avoid defaulting to (0,0) which draws a long line on the map (Gulf of Guinea).
    const fallbackX = last ? last.x : 500000;   // typical UTM easting in Algeria
    const fallbackY = last ? last.y : 3000000;  // typical UTM northing in Algeria
    const newPoint: Point = {
      id: generateId(),
      idTitre: points.length > 0 ? points[0].idTitre : 1007,
      h: points.length > 0 ? points[0].h : 32,
      x: coords ? coords.x : fallbackX,
      y: coords ? coords.y : fallbackY,
      system: coordinateSystem,
      zone: coordinateSystem === 'UTM' ? utmZone : undefined,
      hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined
    };
    setPoints(prev => [...prev, newPoint]);
    return newPoint;
  }, [points, coordinateSystem, utmZone, utmHemisphere]);

  const insertPointAfter = (index: number) => {
    const base = points[index];
    const newPoint: Point = {
      id: generateId(),
      idTitre: base?.idTitre ?? (points[0]?.idTitre ?? 1007),
      h: base?.h ?? (points[0]?.h ?? 32),
      x: base ? base.x : 0,
      y: base ? base.y : 0,
      system: coordinateSystem,
      zone: coordinateSystem === 'UTM' ? (base?.zone ?? utmZone) : undefined,
      hemisphere: coordinateSystem === 'UTM' ? (base?.hemisphere ?? utmHemisphere) : undefined,
    };
    const next = [...points];
    next.splice(index + 1, 0, newPoint);
    setPoints(next);
  };

  const movePointUp = (index: number) => {
    if (index <= 0) return;
    const next = [...points];
    const [p] = next.splice(index, 1);
    next.splice(index - 1, 0, p);
    setPoints(next);
  };

  const movePointDown = (index: number) => {
    if (index >= points.length - 1) return;
    const next = [...points];
    const [p] = next.splice(index, 1);
    next.splice(index + 1, 0, p);
    setPoints(next);
  };
  const getSelectedOverlapLayers = useCallback(() => {
    const defaults = {
      titres: true,
      perimetresSig: false,
      promotion: false,
      modifications: false,
      exclusions: false,
    };

    const layerState = mapRef.current?.getActiveLayers?.();
    if (layerState && typeof layerState === 'object') {
      return {
        titres: !!(layerState as any).titres,
        perimetresSig: !!(layerState as any).perimetresSig,
        promotion: !!(layerState as any).promotion,
        modifications: !!(layerState as any).modifications,
        exclusions: !!(layerState as any).exclusions,
      };
    }

    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('sigam_arcgis_active_layers');
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return {
            titres: !!parsed.titres,
            perimetresSig: !!parsed.perimetresSig,
            promotion: !!parsed.promotion,
            modifications: !!parsed.modifications,
            exclusions: !!parsed.exclusions,
          };
        }
      }
    } catch {
      // ignore
    }

    return defaults;
  }, []);
  const lastOverlapStatusRef = useRef<'none' | 'overlap' | 'unreachable' | null>(
    null,
  );

  // Load demande info (idDemande, statut) from procedure id
  useEffect(() => {
    if (!router.isReady) return;
    const id_proc = router.query.id as string;
    if (!id_proc) return;
    const fetchDemande = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${id_proc}/demande`);
        setIdDemande(res.data.id_demande);
        setStatutProc(res.data.procedure.statut_proc);
      } catch (error) {
        console.error('Failed to fetch demande:', error);
        // keep UI usable even if this fails
      }
    };
    fetchDemande();
  }, [router.isReady, router.query.id, apiURL]);

  // Ensure re-fetch on repeated navigations even to same URL
  useEffect(() => {
    const id_proc = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') ?? '' : '';
    if (!id_proc) return;
    const fetchDemande = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${id_proc}/demande`);
        setIdDemande(res.data.id_demande);
        setStatutProc(res.data.procedure.statut_proc);
      } catch (error) {
        // swallow duplicate errors
      }
    };
    fetchDemande();
  }, [router.asPath, apiURL]);

  // Removed legacy initial points loader to avoid ping-pong with source selection

  // Load existing verification (cadastral) status for the demande
  useEffect(() => {
    if (!idDemande) return;
    const fetchVerification = async () => {
      try {
        const res = await axios.get(`${apiURL}/verification-geo/demande/${idDemande}`);
        const v = res.data || {};
        if (typeof v.sit_geo_ok === 'boolean') setSitGeoOk(v.sit_geo_ok);
        if (typeof v.empiet_ok === 'boolean') setEmpietOk(v.empiet_ok);
        if (typeof v.geom_ok === 'boolean') setGeomOk(v.geom_ok);
        if (typeof v.superf_ok === 'boolean') setSuperfOk(v.superf_ok);
        if (typeof v.superficie_cadastrale === 'number') setSuperficieCadastrale(v.superficie_cadastrale);
      } catch (e) {
        // If not found yet, keep defaults; avoid noisy errors
      }
    };
    fetchVerification();
  }, [idDemande, apiURL]);
  // Add new function to check mining title overlaps
  const checkMiningTitleOverlaps = async () => {
    if (!points || points.length < 3) {
      setError("Dessinez d'abord un polygone valide");
      setTimeout(() => setError(null), 4000);
      return;
    }

    const selectedLayers = getSelectedOverlapLayers();
    const anyLayerActive = Object.values(selectedLayers).some(Boolean);
    if (!anyLayerActive) {
      setOverlapDetected(false);
      setMiningTitleOverlaps([]);
      setOverlapPermits([]);
      setMinDistanceM(null);
      setNearestTitle(null);
      setError('Veuillez sélectionner au moins une couche à vérifier.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setIsCheckingOverlaps(true);
      setError(null);
      setSuccess(null);
      lastOverlapStatusRef.current = null;

      const layerLabels: Record<string, string> = {
        titres: 'Titres miniers',
        perimetresSig: 'Périmètres SIG',
        promotion: 'Promotion',
        modifications: 'Modifications',
        exclusions: "Zones d'exclusion",
      };
      const layersLabel = Object.entries(selectedLayers)
        .filter(([, v]) => !!v)
        .map(([k]) => layerLabels[k] || k)
        .join(', ');
      setLastOverlapCheckInfo({
        at: new Date().toLocaleTimeString('fr-DZ'),
        layersLabel,
      });

      const payloadPoints = points.map((p) => ({
        x: p.x,
        y: p.y,
        system: p.system,
        zone: p.zone ?? utmZone,
        hemisphere: p.hemisphere ?? utmHemisphere,
      }));

      const res = await axios.post(`${apiURL}/gis/analyze-perimeter`, {
        points: payloadPoints,
        layers: selectedLayers,
      });

      const areaHa = res.data?.areaHa;
      const overlapsRaw = Array.isArray(res.data?.overlaps) ? res.data.overlaps : [];
      const baseAreaHa =
        typeof areaHa === 'number' && !Number.isNaN(areaHa)
          ? areaHa
          : Number.isFinite(superficie) && superficie > 0
            ? superficie
            : null;
      const baseAreaM2 = baseAreaHa != null ? baseAreaHa * 10000 : null;
      const overlapToleranceM2 =
        baseAreaM2 != null ? Math.min(100, Math.max(10, baseAreaM2 * 0.0001)) : 10;
      const overlaps = overlapsRaw.filter((o: any) => {
        const m2 =
          typeof o?.overlap_area_m2 === 'number'
            ? o.overlap_area_m2
            : typeof o?.overlap_area_ha === 'number'
              ? o.overlap_area_ha * 10000
              : 0;
        return m2 > overlapToleranceM2;
      });
      const dist = res.data?.minDistanceM;
      const nearest = res.data?.nearestTitle ?? null;

      if (typeof areaHa === 'number' && !Number.isNaN(areaHa)) {
        const rounded = parseFloat(areaHa.toFixed(2));
        if (!Number.isFinite(superficie) || superficie <= 0) {
          setSuperficie(rounded);
        }
        const displayArea = Number.isFinite(superficie) && superficie > 0 ? superficie : rounded;
        setSuperficieCadastrale(displayArea);
      }

      if (nearest && typeof nearest.distance === 'number' && !Number.isNaN(nearest.distance)) {
        setMinDistanceM(nearest.distance);
        setNearestTitle(nearest);
      } else if (typeof dist === 'number' && !Number.isNaN(dist)) {
        setMinDistanceM(dist);
        setNearestTitle(null);
      } else {
        setMinDistanceM(null);
        setNearestTitle(null);
      }

      const getLayerType = (o: any) =>
        String(o?.layerType ?? o?.layer_type ?? o?.__layerType ?? '').trim();

      // Keep detailed cards for titles only; other couches are listed in the summary.
      const titleOverlapsRaw = overlaps.filter((o: any) => getLayerType(o) === 'titres');
      const titleOverlaps = dedupeTitles(titleOverlapsRaw);
      setMiningTitleOverlaps(titleOverlaps);

      if (overlaps.length > 0) {
        setOverlapDetected(true);
        setEmpietOk(false);

        const formatted = overlaps.map((o: any) => {
          const lt = getLayerType(o);
          const overlapAreaM =
            typeof o?.overlap_area_m2 === 'number'
              ? o.overlap_area_m2
              : typeof o?.overlap_area_ha === 'number'
                ? o.overlap_area_ha * 10000
                : null;
          const overlapText = overlapAreaM ? ` (chevauchement ~${overlapAreaM.toFixed(0)} m²)` : '';

          if (lt === 'titres') {
            const typ = o.typetitre || o.codetype || 'Titre';
            const code = o.code ?? o.idtitre ?? o.objectid ?? '';
            const titulaire = [o.tnom, o.tprenom].filter(Boolean).join(' ').trim();
            const locationParts = [o.wilaya, o.daira, o.commune].filter(Boolean);
            const location = locationParts.length ? ` — ${locationParts.join(' / ')}` : '';
            const holder = titulaire ? ` — ${titulaire}` : '';
            return `Titres miniers: ${typ} ${o.codetype || ''} ${code}${holder}${location}${overlapText}`
              .replace(/\s+/g, ' ')
              .trim();
          }

          if (lt === 'perimetresSig') {
            const code = o.permis_code ?? o.permisCode ?? '';
            const label = o.permis_type_label ?? o.permisTypeLabel ?? 'Périmètre SIG';
            const src = o.source ? ` — ${o.source}` : '';
            const codePart = code ? ` (${code})` : o.id ? ` (#${o.id})` : '';
            return `Périmètres SIG: ${label}${codePart}${src}${overlapText}`.replace(/\s+/g, ' ').trim();
          }

          if (lt === 'promotion') {
            const name = o.nom || o.Nom || 'Promotion';
            const id = o.objectid ?? o.OBJECTID ?? '';
            const idPart = id ? ` (#${id})` : '';
            return `Promotion: ${name}${idPart}${overlapText}`.replace(/\s+/g, ' ').trim();
          }

          if (lt === 'modifications') {
            const modType = o.typemodification || 'Modification';
            const code = o.code ?? o.idtitre ?? '';
            const codePart = code ? ` (${code})` : '';
            const typeTitre = o.typetitre ? ` — ${o.typetitre}` : '';
            return `Modifications: ${modType}${typeTitre}${codePart}${overlapText}`.replace(/\s+/g, ' ').trim();
          }

          if (lt === 'exclusions') {
            const name = o.nom || o.Nom || "Zone d'exclusion";
            const id = o.objectid ?? o.OBJECTID ?? '';
            const idPart = id ? ` (#${id})` : '';
            return `Zones d'exclusion: ${name}${idPart}${overlapText}`.replace(/\s+/g, ' ').trim();
          }

          return `Chevauchement: ${lt || 'couche'}${overlapText}`.replace(/\s+/g, ' ').trim();
        });

        setOverlapPermits(Array.from(new Set(formatted)));
        if (lastOverlapStatusRef.current !== 'overlap') {
          lastOverlapStatusRef.current = 'overlap';
          setError(`Chevauchement détecté avec ${overlaps.length} élément(s) (couches sélectionnées)`);
          setTimeout(() => setError(null), 5000);
        }
      } else {
        setOverlapDetected(false);
        setEmpietOk(true);
        setOverlapPermits([]);
        if (lastOverlapStatusRef.current !== 'none') {
          lastOverlapStatusRef.current = 'none';
          setSuccess('Aucun chevauchement détecté (couches sélectionnées)');
          setTimeout(() => setSuccess(null), 2000);
        }
      }
    } catch (error) {
      console.error('Error checking mining title overlaps:', error);
      setError('Erreur lors de la vérification des chevauchements');
      setTimeout(() => setError(null), 4000);
    }
    setIsCheckingOverlaps(false);
  };



  const removePoint = (id: number) => {
    if (points.length <= 3) return;
    setPoints(points.filter(p => p.id !== id));
  };

  const requestPolygonZoom = useCallback(() => {
    setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
  }, []);

  const handleChange = (id: number, key: keyof Point, value: string) => {
    const parsedValue =
      key === 'id' || key === 'idTitre' || key === 'h' || key === 'zone'
        ? parseInt(value, 10) || 0
        : parseFloat(value) || 0;
    setPoints(prev =>
      prev.map(p =>
        p.id === id ? { ...p, [key]: parsedValue } : p
      )
    );
    if (key === 'zone') {
      const nextZone = parseInt(value, 10);
      if (Number.isFinite(nextZone)) {
        setUtmZone(nextZone);
      }
      requestPolygonZoom();
    }
  };

  const saveCoordinatesToBackend = async () => {
    if (lockPerimeter) {
      setError("Le périmètre d’exploitation doit rester identique au titre précédent.");
      setTimeout(() => setError(null), 4000);
      return;
    }
    if (!idProc) {
      setError("ID procedure manquant !");
      setTimeout(() => setError(null), 4000);
      return;
    }
    if (!points || points.length < 3) {
      setError("Le polygone doit contenir au moins 3 points.");
      setTimeout(() => setError(null), 4000);
      return;
    }
    try {
      const payloadPoints = points.map(p => {
        let x = p.x;
        let y = p.y;
        if (p.system === 'UTM') {
          const shift = getUtmShift(p.zone || utmZone);
          x = x + shift.x;
          y = y + shift.y;
        }
        return {
          x: x.toString(),
          y: y.toString(),
          z: "0",
          system: p.system,
          zone: p.zone ?? utmZone,
          hemisphere: p.hemisphere ?? utmHemisphere,
        };
      });
      await axios.post(`${apiURL}/coordinates/update`, {
        id_proc: idProc,
        id_zone_interdite: null,
        points: payloadPoints,
        superficie
      });
      setSuccess("Coordonnées sauvegardées avec succès !");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde des coordonnées:", err);
      setError("Échec de la sauvegarde des coordonnées.");
      setTimeout(() => setError(null), 4000);
    }
  };

  // If perimeter should be locked (exploitation), ensure drawing is disabled
  useEffect(() => {
    if (lockPerimeter) {
      try { setIsDrawing(false); } catch {}
    }
  }, [lockPerimeter]);

  const validateCoordinate = (point: Point): boolean => {
    switch (point.system) {
      case 'UTM':
        // Use globally selected UTM fuseau for validation
        const hemisphere = point.hemisphere ?? utmHemisphere;
        if (!hemisphere) return false;
        const easting = point.x;
        const northing = point.y;
        if (easting < 100000 || easting > 999999) return false;
        if (hemisphere === 'N') {
          return northing >= 0 && northing <= 10000000;
        } else {
          return northing >= 1000000 && northing <= 10000000;
        }
    
      default:
        return false;
    }
  };

  const calculateArea = useCallback(() => {
    const validPoints = points.filter(p => !isNaN(p.x) && !isNaN(p.y) && validateCoordinate(p));
    if (validPoints.length < 3) {
      setSuperficie(0);
      setIsPolygonValid(false);
      return 0;
    }
    try {
      let area: number;
      if (coordinateSystem === 'UTM' || coordinateSystem === 'LAMBERT') {
        const coordinates = validPoints.map(p => [p.x, p.y]);
        const cleanedCoordinates = coordinates.filter((coord, index) => 
          index === 0 || !(coord[0] === coordinates[index-1][0] && coord[1] === coordinates[index-1][1])
        );
        if (cleanedCoordinates.length < 3) {
          setIsPolygonValid(false);
          setSuperficie(0);
          return 0;
        }
        const first = cleanedCoordinates[0];
        const last = cleanedCoordinates[cleanedCoordinates.length - 1];
        const finalCoordinates = [...cleanedCoordinates];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          finalCoordinates.push([...first]);
        }
        let shoelaceArea = 0;
        const n = finalCoordinates.length;
        for (let i = 0; i < n - 1; i++) {
          shoelaceArea += finalCoordinates[i][0] * finalCoordinates[i + 1][1] - finalCoordinates[i + 1][0] * finalCoordinates[i][1];
        }
        area = Math.abs(shoelaceArea) / 2;
      } else {
        const wgs84Coordinates = validPoints.map(point => {
        
            return convertToWGS84(point);
          
        });
        const cleanedCoordinates = wgs84Coordinates.filter((coord, index) => 
          index === 0 || !(coord[0] === wgs84Coordinates[index-1][0] && coord[1] === wgs84Coordinates[index-1][1])
        );
        if (cleanedCoordinates.length < 3) {
          setIsPolygonValid(false);
          setSuperficie(0);
          return 0;
        }
        const first = cleanedCoordinates[0];
        const last = cleanedCoordinates[cleanedCoordinates.length - 1];
        const finalCoordinates = [...cleanedCoordinates];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          finalCoordinates.push([...first]);
        }
        const polygon = turf.polygon([finalCoordinates]);
        if (!turf.booleanValid(polygon)) {
          console.warn('Invalid polygon geometry');
          setIsPolygonValid(false);
          setSuperficie(0);
          return 0;
        }
        area = turf.area(polygon);
      }
      const areaHectares = area / 10000;
      setIsPolygonValid(true);
      setSuperficie(parseFloat(areaHectares.toFixed(2)));
      return areaHectares;
    } catch (err) {
      console.error('Area calculation error:', err);
      setIsPolygonValid(false);
      setSuperficie(0);
      setError('Failed to calculate area');
      setTimeout(() => setError(null), 4000);
      return 0;
    }
  }, [points, coordinateSystem, utmZone, utmHemisphere]);

  const convertToWGS84 = (point: Point): [number, number] => {
    try {
     if (point.system === "UTM") {
        // Always use the globally selected fuseau for transformation
        const zone = point.zone ?? utmZone;
        const hemisphere = point.hemisphere ?? utmHemisphere;
        if (!zone || !hemisphere) {
          console.warn(`UTM coordinate missing zone or hemisphere for point ${point.id}, using defaults: zone=${utmZone}, hemisphere=${utmHemisphere}`);
        }
        const shift = getUtmShift(zone);
        const xCorr = point.x + shift.x;
        const yCorr = point.y + shift.y;
        const sourceProj =
          `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +units=m ` +
          `+k=0.9996 +x_0=500000 +y_0=0 ` +
          `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
          `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
          `+no_defs`;
        const converted = proj4(sourceProj, "EPSG:4326", [xCorr, yCorr]);
        return [converted[0], converted[1]];
      } else if (point.system === "LAMBERT") {
        let lambertZone = 'EPSG:30491';
        if (point.x > 1000000 && point.x < 2000000) {
          lambertZone = 'EPSG:30492';
        } else if (point.x >= 2000000) {
          lambertZone = 'EPSG:30493';
        }
        const converted = proj4(lambertZone, "EPSG:4326", [point.x, point.y]);
        return [converted[0], converted[1]];
      }
      throw new Error("Invalid coordinate system");
    } catch (error) {
      console.error("Coordinate conversion error:", error);
      return [0, 0];
    }
  };

  const handleCoordinateSystemChange = (system: CoordinateSystem) => {
    setCoordinateSystem(system);
    if (system !== 'UTM') {
      setUtmZone(31);
      setUtmHemisphere('N');
    }
    setPoints(points.map(p => ({
      ...p,
      system,
      zone: system === 'UTM' ? utmZone : undefined,
      hemisphere: system === 'UTM' ? utmHemisphere : undefined
    })));
  };

  const handleUtmZoneSelect = (value: string) => {
    const nextZone = parseInt(value, 10);
    if (!Number.isFinite(nextZone)) return;
    setUtmZone(nextZone);
    setPoints(prev => prev.map(p => ({ ...p, zone: nextZone })));
    requestPolygonZoom();
  };

  const polygonValid = points.length >= 4 && hasUniqueCoords;
  const allFilled = points.every(p => !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.h));
  const hasValidatedPerimeter = validatedPoints.length >= 3;
  const isFormComplete = hasValidatedPerimeter;

 const handleNext = async () => {
    if (!idProc) {
      setError("ID procedure manquant");
      setTimeout(() => setError(null), 4000);
      return;
    }

    if (!isFormComplete && !isStepSaved) {
      setError("Veuillez valider le p?rim?tre avant de continuer");
      setTimeout(() => setError(null), 4000);
      return;
    }

    setSavingEtape(true);

    try {
      let etapeId = 5;

      try {
        if (procedureData?.ProcedurePhase) {
          const pathname = window.location.pathname.replace(/^\/+/, '');
          const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
          const allEtapes = phasesList.flatMap(pp => pp.phase?.etapes ?? []);
          const match = allEtapes.find((e: any) => e.page_route === pathname);
          if (match?.id_etape != null) {
            etapeId = match.id_etape;
          }
        }
      } catch {
        // fallback to default etapeId
      }

      etapeId = etapeIdForThisPage ?? etapeId;
      await axios.post(`${apiURL}/api/procedure-etape/finish/${idProc}/${etapeId}`);
      setRefetchTrigger((prev) => prev + 1);
      setSuccess("?tape 5 enregistr?e avec succ?s !");
      setTimeout(() => setSuccess(null), 3000);
      router.push(`/investisseur/nouvelle_demande/step4/page4?id=${idProc}`);
    } catch (err) {
      console.error("Erreur ?tape", err);
      setError("Erreur lors de l'enregistrement de l'?tape");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSavingEtape(false);
    }
  };

  const handleBack = () => {
    if (!idProc) {
      setError("ID procedure manquant");
      setTimeout(() => setError(null), 4000);
      return;
    }
    router.push(`/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis?id=${idProc}`);
  };

  const exportData = () => {
    const data = { points, superficie, permitData, createdAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perimeter-${permitData.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.points && Array.isArray(data.points)) {
          const importedPoints = data.points.map((p: any) => ({
            id: p.id,
            idTitre: p.idTitre || 1007,
            h: p.h || 32,
            x: p.x,
            y: p.y,
            system: p.system || 'UTM',
            zone: p.system === 'UTM' ? (p.zone || utmZone) : undefined,
            hemisphere: p.system === 'UTM' ? (p.hemisphere || utmHemisphere) : undefined
          }));
          setPoints(importedPoints);
          if (data.superficie) setSuperficie(data.superficie);
          if (data.permitData) setPermitData(data.permitData);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        setError('Failed to import data');
        setTimeout(() => setError(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  const handleMapClick = useCallback((x: number, y: number) => {
    if (lockPerimeter) return; // Disable drawing for exploitation titles
    if (isDrawing) {
      addPoint({ x, y });
    }
  }, [isDrawing, addPoint, lockPerimeter]);

  // Recalculate local area when geometry changes.
  useEffect(() => {
    calculateArea();
    if (points.length < 3) {
      setOverlapDetected(false);
      setOverlapPermits([]);
      setMiningTitleOverlaps([]);
      setMinDistanceM(null);
      setNearestTitle(null);
    }
  }, [points, calculateArea]);

  // Add function to calculate area using ArcGIS
  const calculateAreaWithArcGIS = () => {
    if (mapRef.current) {
      const area = mapRef.current.calculateArea();
      setSuperficie(parseFloat(area.toFixed(2)));
      setSuccess('Superficie calculée avec ArcGIS');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      calculateArea(); // fallback to existing method
    }
  };

  // Update the map section in your return statement
  return (
    <div className={styles['app-container']}>
      <Navbar />
      <div className={styles['app-content']}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles['main-content']}>
          <div className={styles['breadcrumb']}>
            <span>SIGAM</span>
            <FiChevronRight className={styles['breadcrumb-arrow']} />
            <span>Cadastre</span>
          </div>
          <div className={styles['content-wrapper']}>
            {procedureData && (
              <ProgressStepper
                 phases={phases}
                 currentProcedureId={idProc}
                 currentEtapeId={etapeIdForRoute ?? currentEtape?.id_etape ?? currentStep}
                 procedurePhases={procedureData.ProcedurePhase || []}
                 procedureTypeId={procedureTypeId}
                 procedureEtapes={procedureData.ProcedureEtape || []}
               />
            )}
            <div className={styles['cadastre-app']}>
 {historyProcedures.length > 0 && (
                      <div style={{ marginBottom: 8, padding: '4px 8px' }}>
                        <span style={{ marginRight: 8 }}>
                          Historique des procedures (toutes demandes)&nbsp;
                        </span>
                        <select
                          value={selectedHistoryProcId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedHistoryProcId(v ? Number(v) : null);
                          }}
                          style={{ minWidth: 260, marginRight: 8 }}
                        >
                          <option value="">-- choisir une procedure --</option>
                          {historyProcedures.map((p) => (
                            <option key={p.procId} value={p.procId}>
                              {(p.typeLabel || 'Procédure')}{p.codeDemande ? ` (${p.codeDemande})` : ''} - {p.procId}
                            </option>
                          ))}
                        </select>
                        <span style={{ fontSize: 12, color: '#4b5563' }}>
                          La procédure selectionnee sera affichee en pointilles
                          (les autres perimetres historiques restent visibles).
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      
                      <input
                        value={searchPerimetreCode}
                        onChange={(e) => setSearchPerimetreCode(e.target.value)}
                        placeholder="permis_code (layer 0)"
                        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6 }}
                      />
                      <button
                        type="button"
                        onClick={handleSearchPerimetre}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #4b5563', background: '#111827', color: '#fff' }}
                      >
                        Chercher Périmètre
                      </button>
                      {searchMessage && (
                        <span style={{ fontSize: 12, color: '#4b5563' }}>{searchMessage}</span>
                      )}
                    </div>
              <div className={`${styles['app-layout']} ${isMapFullscreen ? styles['appLayoutFullscreen'] : ''}`}>
                {/* UPDATED MAP SECTION */}
                <section className={`${styles['map-container']} ${isMapFullscreen ? styles['mapContainerFullscreen'] : ''}`}>
                  <div className={styles['map-header']}>
                    <h2>
                      <FiMapPin /> Carte ANAM ArcGIS Enterprise
                      <span className={styles['badge']}>{points.length} points</span>
                    </h2>
                    <div className={styles['map-controls-group']}>
                      <div className={styles['coordinate-system-controls']}>
                        <select
                          value={coordinateSystem}
                          onChange={(e) => handleCoordinateSystemChange(e.target.value as CoordinateSystem)}
                          className={styles['system-select']}
                        >
                          <option value="UTM">UTM</option>
                        </select>
                        {coordinateSystem === 'UTM' && (
                          <>
                            <select
                              value={utmZone}
                              onChange={(e) => handleUtmZoneSelect(e.target.value)}
                              className={styles['zone-select']}
                            >
                              {Array.from({ length: 4 }, (_, i) => i + 29).map(zone => (
                                <option key={zone} value={zone}>{zone}</option>
                              ))}
                            </select>
                            <select
                              value={utmHemisphere}
                              onChange={(e) => setUtmHemisphere(e.target.value as 'N')}
                              className={styles['hemisphere-select']}
                            >
                              <option value="N">Nord (N)</option>
                            </select>
                          </>
                        )}
                      </div>
                      <div className={styles['map-controls']}>
                        <button
                          className={`${styles['map-btn']} ${isDrawing ? styles['active'] : ''}`}
                          onClick={() => isCadastre && setIsDrawing(!isDrawing)}
                        >
                          <FiEdit2 /> {isDrawing ? 'Dessin Actif' : 'Dessiner'}
                        </button>
                        <button 
                          className={styles['map-btn']} 
                          onClick={calculateAreaWithArcGIS}
                        >
                          <FiRefreshCw /> Calculer
                        </button>
                        <button 
                          className={styles['map-btn']}
                          onClick={checkMiningTitleOverlaps}
                          disabled={points.length < 3 || isCheckingOverlaps}
                        >
                          <FiAlertTriangle /> Vérifier Chevauchements
                        </button>
                        <button
                          className={styles['map-btn']}
                          onClick={() => mapRef.current?.toggleLayerPanel?.()}
                          type="button"
                        >
                          <FiLayers /> Couches
                        </button>
                        <label className={styles['map-toggle']}>
                          <input
                            type="checkbox"
                            checked={showFuseaux}
                            onChange={(e) => setShowFuseaux(e.target.checked)}
                          />
                          Fuseaux UTM (29-32)
                        </label>
                        <button 
                          className={styles['map-btn']}
                          onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                        >
                          {isMapFullscreen ? 'Quitter plein écran' : 'Plein écran'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {!isMapFullscreen && (
                    <div className={styles['map-viewport']} style={{ height: '60vh' }}>
                      <ArcGISMap
                        key={`map-${coordSource}`}
                        ref={mapRef}
                        points={points}
                        superficie={superficie}
                        isDrawing={isDrawing}
                        onMapClick={handleMapClick}
                        onTitreSelected={handleTitreSelected}
                        showFuseaux={showFuseaux}
                        onPolygonChange={(polygon) => {
                          // Do not let a simple click on the map overwrite
                          // the coordinates loaded from the database.
                          if (!isDrawing) return;
                          if (polygon && polygon.length >= 3) {
                            const baseId = generateId();
                            const next = polygon.map((coord, index) => ({
                              id: baseId + index,
                              idTitre: points.length > 0 ? points[0].idTitre : 1007,
                              h: points.length > 0 ? points[0].h : 32,
                              x: coord[0],
                              y: coord[1],
                              system: coordinateSystem,
                              zone: coordinateSystem === 'UTM' ? utmZone : undefined,
                              hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined,
                            }));
                            // Ignore any polygon that would introduce non-finite coordinates
                            const allFinite = next.every(
                              (p) =>
                                Number.isFinite(p.x) &&
                                Number.isFinite(p.y) &&
                                Number.isFinite(p.h) &&
                                Number.isFinite(p.idTitre),
                            );
                            if (!allFinite) {
                              console.warn(
                                'Ignoring polygon update with non-finite coordinates',
                              );
                              return;
                            }
                            const sameLen = next.length === points.length;
                            const sameGeom =
                              sameLen &&
                              next.every(
                                (p, i) =>
                                  p.x === points[i].x && p.y === points[i].y,
                              );
                            if (!sameGeom) {
                              setPoints(next);
                            }
                          }
                        }}
                        existingPolygons={existingPolygons}
                        selectedExistingProcId={selectedHistoryProcId}
                        coordinateSystem={coordinateSystem}
                        utmZone={utmZone}
                        utmHemisphere={utmHemisphere}
                        labelText={
                          permitData.code || (demandeSummary?.code_demande ?? '')
                        }
                        adminInfo={{
                          codeDemande:
                            permitData.code || (demandeSummary?.code_demande ?? ''),
                          typePermis: permitData.type,
                          titulaire: permitData.holder,
                          wilaya: permitData.wilaya,
                          daira: permitData.daira,
                          commune: permitData.commune,
                        }}
                        declaredAreaHa={
                          typeof superficieDeclaree === 'number'
                            ? superficieDeclaree
                            : undefined
                        }
                        validationSummary={{
                          sitGeoOk,
                          empietOk,
                          geomOk,
                          superfOk,
                        }}
                        overlapTitles={miningTitleOverlaps}
                        enableSelectionTools
                      />
                    </div>
                  )}
                  
                  <div className={styles['map-footer']}>
                    <div className={styles['area-display']}>
                      <span>Superficie calculée:</span>
                      <strong>{Number.isFinite(superficie) ? superficie.toFixed(2) : '0.00'} ha</strong>
                      
                      
                      
                      {typeof minDistanceM === 'number' && (
                        <>
                          <span style={{ marginLeft: 16 }}> | Dist. min. au titre le plus proche:</span>
                          <strong> {minDistanceM.toFixed(0)} m</strong>
                          {nearestTitle?.code && (
                            <>
                              <span style={{ marginLeft: 6 }}>({nearestTitle.code})</span>
                              {nearestTitle?.label && <span style={{ marginLeft: 4 }}>- {nearestTitle.label}</span>}
                            </>
                          )}
                        </>
                      )}
                      
                      {miningTitleOverlaps.length > 0 && (
                        <>
                          <span style={{ marginLeft: 16 }}> | Chevauchements:</span>
                          <strong style={{ color: '#dc2626' }}>
                            {' '}
                            {miningTitleOverlaps.length} titre(s) minier(s)
                          </strong>
                          {(() => {
                            const totalOverlapM = miningTitleOverlaps.reduce((acc, t) => {
                              if (typeof t.overlap_area_m2 === 'number') return acc + t.overlap_area_m2;
                              if (typeof t.overlap_area_ha === 'number') return acc + t.overlap_area_ha * 10000;
                              return acc;
                            }, 0);
                            return totalOverlapM > 0 ? (
                              <span style={{ marginLeft: 6 }}>({totalOverlapM.toFixed(0)} m²)</span>
                            ) : null;
                          })()}
                        </>
                      )}
                    </div>
                    {/* <div className={styles['map-export']}>
                      <button className={styles['export-btn']} onClick={exportData}>
                        <FiDownload /> Exporter
                      </button>
                      <label className={styles['import-btn']}>
                        <FiUpload /> Importer
                        <input type="file" accept=".json" onChange={importData} hidden />
                      </label>
                    </div> */}
                  </div>
                </section>

                <section className={styles['data-panel']}>
                  <div className={styles['panel-tabs']}>
                    <button
                      className={`${styles['tab-btn']} ${activeTab === 'coordinates' ? styles['active'] : ''}`}
                      onClick={() => setActiveTab('coordinates')}
                    >
                      Coordonnées
                    </button>
                    <button
                      className={`${styles['tab-btn']} ${activeTab === 'validation' ? styles['active'] : ''}`}
                      onClick={() => setActiveTab('validation')}
                    >
                      Validation
                    </button>
                    <button
                      className={`${styles['tab-btn']} ${activeTab === 'summary' ? styles['active'] : ''}`}
                      onClick={() => setActiveTab('summary')}
                    >
                      Résumé
                    </button>
                  </div>
                  
                  <div className={styles['panel-content']}>
                    {activeTab === 'coordinates' && (
                      <>
                        <div className={styles['table-header']}>
                          <h3>Points du périmètre</h3>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={coordSource}
                              onChange={(e) => setCoordSource(e.target.value as 'provisoire' | 'validees')}
                              className={styles['system-select']}
                              title="Source des coordonnées"
                            >
                              <option value="provisoire">Inscription provisoire</option>
                              <option value="validees">Coordonnées validées</option>
                            </select>
                            <button className={styles['add-btn']} onClick={() => addPoint()} disabled={lockPerimeter}>
                              <FiPlus /> Ajouter
                            </button>
                            <button className={styles['add-btn']} onClick={() => setRefetchTrigger(prev => prev + 1)}>
                              <FiRefreshCw /> Recharger
                            </button>
                          </div>
                        </div>
                        <div className={styles['coordinates-table']}>
                          <div className={`${styles['table-row']} ${styles['header']}`}>
                            <div>Fuseau</div>
                            <div>Easting (X)</div>
                            <div>Northing (Y)</div>
                            <div>Actions</div>
                          </div>
                          {points.map((point, index) => (
                            <div className={styles['table-row']} key={point.id}>
                              <div>
                                <input
                                  type="number"
                                  value={Number.isFinite(point.zone ?? utmZone) ? (point.zone ?? utmZone) : utmZone}
                                  onChange={(e) => handleChange(point.id, 'zone', e.target.value)}
                                  disabled={editableRowId !== point.id}
                                  min={29}
                                  max={32}
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={Number.isFinite(point.x) ? point.x : 0}
                                  onChange={(e) => handleChange(point.id, 'x', e.target.value)}
                                  disabled={editableRowId !== point.id}
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={Number.isFinite(point.y) ? point.y : 0}
                                  onChange={(e) => handleChange(point.id, 'y', e.target.value)}
                                  disabled={editableRowId !== point.id}
                                />
                              </div>
                              <div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <button
                                    className={styles['delete-btn']}
                                    style={{ display: 'none' }}
                                    onClick={() => movePointUp(index)}
                                    disabled={index === 0}
                                    title={index === 0 ? "Premier point" : "Monter"}
                                  >
                                    <FiArrowUp />
                                  </button>
                                  <button
                                    className={styles['delete-btn']}
                                    style={{ display: 'none' }}
                                    onClick={() => movePointDown(index)}
                                    disabled={index === points.length - 1}
                                    title={index === points.length - 1 ? "Dernier point" : "Descendre"}
                                  >
                                    <FiArrowDown />
                                  </button>
                                  <button
                                    className={styles['delete-btn']}
                                    style={{ display: 'none' }}
                                    onClick={() => insertPointAfter(index)}
                                    title="Insérer après"
                                  >
                                    <FiPlus />
                                  </button>
                                  <button
                                    className={styles['delete-btn']}
                                    onClick={() => setEditableRowId(prev => prev === point.id ? null : point.id)}
                                    title={editableRowId === point.id ? "Terminer la modification" : "Modifier"}
                                  >
                                    <FiEdit2 />
                                  </button>
                                  <button
                                    className={styles['delete-btn']}
                                    onClick={() => removePoint(point.id)}
                                    disabled={points.length <= 3 }
                                    title={points.length <= 3 ? "Un polygone doit avoir au moins 3 points" : "Supprimer ce point"}
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    
                    {activeTab === 'validation' && (
                      <div className={styles['validation-section']}>
                        {/* Enhanced Overlap Detection Card */}
                        <div className={`${styles['validation-card']} ${overlapDetected ? styles['error'] : styles['success']}`}>
                          <div className={styles['card-header']}>
                            {overlapDetected ? <FiAlertTriangle /> : <FiCheckCircle />}
                            <h3>Vérification des chevauchements (couches sélectionnées)</h3>
                          </div>
                          {lastOverlapCheckInfo && (
                            <p style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>
                              Dernière vérification: {lastOverlapCheckInfo.at} — Couches: {lastOverlapCheckInfo.layersLabel}
                            </p>
                          )}
                          {overlapDetected ? (
                            <>
                              <p>Empiètements détectés avec :</p>
                              <ul>
                                {overlapPermits.map((permit, idx) => (
                                  <li key={idx}>{permit}</li>
                                ))}
                              </ul>
                              
                              {miningTitleOverlaps.length > 0 && (
                                <div className={styles['mining-overlaps']}>
                                  <h4>Détails des titres miniers chevauchants :</h4>
                                  {miningTitleOverlaps.map((title: any, idx: number) => {
                                    const typ = title.typetitre || title.codetype || 'Titre minier';
                                    const code = title.code ?? title.idtitre ?? title.objectid ?? '';
                                    const titulaire = [title.tnom, title.tprenom].filter(Boolean).join(' ').trim();
                                    const locationParts = [title.wilaya, title.daira, title.commune].filter(Boolean);
                                    const location = locationParts.join(' / ');
                                    const formatDate = (v: any) => {
                                      if (!v && v !== 0) return null;
                                      try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-DZ'); } catch {}
                                      return null;
                                    };
                                    const dOctroi = formatDate(title.dateoctroi);
                                    const dExp = formatDate(title.dateexpiration);
                                    return (
                                      <div key={idx} className={styles['mining-title-detail']}>
                                        <strong>{`${typ} ${title.codetype || ''} ${code}`.replace(/\s+/g,' ').trim()} {titulaire ? `— ${titulaire}` : ''}</strong>
                                        <div className={styles['title-details']}>
                                          {location && <span>Localisation: {location}</span>}
                                          {(dOctroi || dExp) && <span>Dates: {dOctroi ? `Octroi ${dOctroi}` : ''}{dOctroi && dExp ? ' — ' : ''}{dExp ? `Expiration ${dExp}` : ''}</span>}
                                          {(title.substance1 || title.substances) && <span>Substance: {title.substance1 || title.substances}</span>}
                                          {title.sig_area && <span>Superficie: {title.sig_area} ha</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              <textarea
                                placeholder="Ajouter une remarque sur ces empiétements..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className={styles['overlap-comment']}
                              />
                            </>
                          ) : (
                            <p>Aucun chevauchement détecté (couches sélectionnées)</p>
                          )}
                          
                          <div className={styles['validation-actions']}>
                            <button
                              className={styles['map-btn']}
                              onClick={checkMiningTitleOverlaps}
                              disabled={points.length < 3 || isCheckingOverlaps}
                            >
                          <FiRefreshCw /> Re-vérifier
                            </button>
                          </div>
                        </div>

                        {/* Keep your existing validation cards */}
                        <div className={`${styles['validation-card']} ${!polygonValid || !allFilled || !isPolygonValid ? styles['warning'] : styles['success']}`}>
                          <div className={styles['card-header']}>
                            {!polygonValid || !allFilled || !isPolygonValid ? <FiAlertTriangle /> : <FiCheckCircle />}
                            <h3>Validation du polygone</h3>
                          </div>
                          {!polygonValid && <p>• Au moins 4 points requis pour former un polygone</p>}
                          {!allFilled && <p>• Toutes les coordonnées doivent être renseignées</p>}
                          {!isPolygonValid && <p>• Le polygone est géométriquement invalide</p>}
                          {polygonValid && allFilled && isPolygonValid && <p>Le polygone est valide</p>}
                        </div>

                        <div className={styles['validation-card']}>
                          <div className={styles['card-header']}>
                            <h3>Vérification cadastrale</h3>
                          </div>
                          <div className={styles['info-grid']}>
                            <div>
                              <label>Situation géographique OK</label>
                              <input type="checkbox" checked={sitGeoOk} onChange={(e) => setSitGeoOk(e.target.checked)} />
                            </div>
                            <div>
                              <label>Absence d'empiétements</label>
                              <input type="checkbox" checked={empietOk} onChange={(e) => setEmpietOk(e.target.checked)} />
                            </div>
                            <div>
                              <label>Géométrie correcte</label>
                              <input type="checkbox" checked={geomOk} onChange={(e) => setGeomOk(e.target.checked)} />
                            </div>
                            <div>
                              <label>Superficie conforme</label>
                              <input type="checkbox" checked={superfOk} onChange={(e) => setSuperfOk(e.target.checked)} />
                            </div>
                            <div>
                              <label>Superficie déclarée (ha)</label>
                              <input value={superficieDeclaree ?? ''} onChange={() => {}} disabled />
                            </div>
                            <div>
                              <label>Superficie cadastrale (ha)</label>
                              <input
                                type="number"
                                value={(superficieCadastrale ?? superficie) || 0}
                                onChange={(e) => setSuperficieCadastrale(parseFloat(e.target.value))}
                              />
                            </div>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <button
                              className={styles['map-btn']}
                              onClick={async () => {
                                if (!apiURL) {
                                  setError('API URL manquant (NEXT_PUBLIC_API_URL).');
                                  setTimeout(() => setError(null), 4000);
                                  return;
                                }
                                if (!idDemande) {
                                  setError("ID demande manquant: impossible d'enregistrer la verification.");
                                  setTimeout(() => setError(null), 4000);
                                  return;
                                }
                                try {
                                  const res = await axios.post(`${apiURL}/verification-geo/demande/${idDemande}`, {
                                    sit_geo_ok: sitGeoOk,
                                    empiet_ok: empietOk,
                                    geom_ok: geomOk,
                                    superf_ok: superfOk,
                                    superficie_cadastrale: Number.isFinite(superficieCadastrale) ? superficieCadastrale : superficie,
                                  });
                                  const v = res.data || {};
                                  if (typeof v.sit_geo_ok === 'boolean') setSitGeoOk(v.sit_geo_ok);
                                  if (typeof v.empiet_ok === 'boolean') setEmpietOk(v.empiet_ok);
                                  if (typeof v.geom_ok === 'boolean') setGeomOk(v.geom_ok);
                                  if (typeof v.superf_ok === 'boolean') setSuperfOk(v.superf_ok);
                                  if (typeof v.superficie_cadastrale === 'number' && Number.isFinite(v.superficie_cadastrale)) {
                                    setSuperficieCadastrale(v.superficie_cadastrale);
                                  }
                                  setSuccess('Vérification cadastrale enregistrée');
                                  setTimeout(() => setSuccess(null), 3000);
                                } catch (e) {
                                  setError("Erreur lors de l'enregistrement de la vérification cadastrale");
                                  setTimeout(() => setError(null), 4000);
                                }
                              }}
                            >
                              Enregistrer la vérification
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'summary' && (
                      <div className={styles['summary-section']}>
                        <div className={styles['summary-card']}>
                          <h3>Informations administratives</h3>
                          <div className={styles['info-grid']}>
                            <div>
                              <label>Code demande</label>
                              <input
                                value={permitData.code}
                                onChange={(e) => setPermitData({ ...permitData, code: e.target.value })}
                               // disabled={!isCadastre}
                              />
                            </div>
                            <div>
                              <label>Type permis</label>
                              <input
                                value={permitData.type}
                                onChange={(e) => setPermitData({ ...permitData, type: e.target.value })}
                              //  disabled={!isCadastre}
                              />
                            </div>
                            <div>
                              <label>Titulaire</label>
                              <input
                                value={permitData.holder}
                                onChange={(e) => setPermitData({ ...permitData, holder: e.target.value })}
                              //  disabled={!isCadastre}
                              />
                            </div>
                            <div>
                              <label>Wilaya</label>
                              <input
                                value={permitData.wilaya}
                                onChange={(e) => setPermitData({ ...permitData, wilaya: e.target.value })}
                             //   disabled={!isCadastre}
                              />
                            </div>
                            <div>
                              <label>Daira</label>
                              <input
                                value={permitData.daira}
                                onChange={(e) => setPermitData({ ...permitData, daira: e.target.value })}
                               // disabled={!isCadastre}
                              />
                            </div>
                            <div>
                              <label>Commune</label>
                              <input
                                value={permitData.commune}
                                onChange={(e) => setPermitData({ ...permitData, commune: e.target.value })}
                               // disabled={!isCadastre}
                              />
                            </div>
                            <div>
                              <label>Lieu détecté - Wilaya</label>
                              <p>{detectedLieu.wilaya || 'Non détecté'}</p>
                            </div>
                            <div>
                              <label>Lieu détecté - Commune</label>
                              <p>{detectedLieu.commune || 'Non détecté'}</p>
                            </div>
                            <div>
                              <label>Lieu détecté - Ville</label>
                              <p>{detectedLieu.ville || 'Non détecté'}</p>
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                              <button
                                type="button"
                                className={styles['secondary-btn']}
                                onClick={() => {
                                  mapRef.current?.detectAdminForCurrent?.();
                                  refreshDetectedLieu();
                                }}
                              >
                                Rafraîchir lieu détecté
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className={styles['summary-card']}>
                          <h3>Caractéristiques techniques</h3>
                          <div className={styles['info-grid']}>
                            <div>
                              <label>Nombre de points</label>
                              <p>{points.length}</p>
                            </div>
                            <div>
                              <label>Superficie</label>
                              <p>{Number.isFinite(superficie) ? superficie.toFixed(2) : '0.00'} ha</p>
                            </div>
                            <div>
                              <label>Statut validation</label>
                              <p className={polygonValid && allFilled ? styles['valid'] : styles['invalid']}>
                                {polygonValid && allFilled ? 'Valide' : 'Non valide'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles['panel-actions']}>
                    <button className={styles['secondary-btn']} 
                   // disabled={!isCadastre || statutProc === 'TERMINEE' || !statutProc}
                    >
                      <FiChevronLeft /> Retour
                    </button>
                    <div className={styles['action-group']}>
                      <button className={styles['secondary-btn']} 
                     // disabled={!isCadastre || statutProc === 'TERMINEE' || !statutProc}
                      >
                        Enregistrer brouillon
                      </button>
                      <button
                              className={styles['map-btn']}
                              style={{ marginLeft: 8 }}
                              onClick={async () => {
                                if (!idProc) return;
                                try {
                                  // Save current edited points into inscription provisoire first,
                                  // because the promotion reads from this table.
                                  const provisionalPayloadPoints = (points || [])
                                    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
                                    .map((p) => ({
                                      x: Number(p.x),
                                      y: Number(p.y),
                                      z: 0,
                                      system: p.system,
                                      zone: p.zone ?? utmZone,
                                      hemisphere: p.hemisphere ?? utmHemisphere,
                                    }));
                                  if (provisionalPayloadPoints.length < 3) {
                                    setError("Le polygone doit contenir au moins 3 points.");
                                    setTimeout(() => setError(null), 4000);
                                    return;
                                  }

                                  await axios.post(`${apiURL}/inscription-provisoire`, {
                                    id_proc: idProc,
                                    points: provisionalPayloadPoints,
                                    system: coordinateSystem,
                                    zone: utmZone,
                                    hemisphere: utmHemisphere,
                                    superficie_declaree:
                                      typeof superficieDeclaree === 'number' ? superficieDeclaree : undefined,
                                  });

                                  // Persist superficie cadastrale into Demande before promotion
                                  if (idDemande && Number.isFinite(superficieCadastrale)) {
                                    await axios.post(`${apiURL}/verification-geo/demande/${idDemande}`, {
                                      superficie_cadastrale: superficieCadastrale,
                                    });
                                  }
                                  await axios.post(`${apiURL}/inscription-provisoire/promote/${idProc}`);
                                  // Reload definitive coordinates
                                  const res = await axios.get(`${apiURL}/coordinates/procedure/${idProc}`);
                                  const coords = res.data;
                                  const safeCoords = (coords ?? []).filter((c: any) => c?.coordonnee?.x !== undefined && c?.coordonnee?.y !== undefined);
                                  const mappedPoints = safeCoords.map((c: any) => {
                                    const point = c.coordonnee;
                                    return {
                                      id: point.id,
                                      idTitre: point.idTitre || 1007,
                                      h: point.h || 32,
                                      x: point.x,
                                      y: point.y,
                                      system: point.system || 'UTM',
                                      zone: point.system === 'UTM' ? (point.zone || utmZone) : undefined,
                                      hemisphere: point.system === 'UTM' ? (point.hemisphere || utmHemisphere) : undefined
                                    };
                                  });
                                  setPoints(mappedPoints);
                                  setCoordSource('validees');
                                  setValidatedPoints(mappedPoints);
                                  setSuccess('perimetres validés et promus');
                                  setTimeout(() => setSuccess(null), 3000);
                                } catch (e) {
                                  setError('Échec de la promotion des perimetres');
                                  setTimeout(() => setError(null), 4000);
                                }
                              }}
                            //  disabled={!statutProc}
                            >
                              Valider les perimetres
                            </button>
                    </div>
                  </div>
                </section>
              </div>
              {auth.role !== 'cadastre' && (
                <>
                  <div className={`${styles['navigation-buttons']} ${styles['top-buttons']}`}>
                    <button className={`${styles['btn']} ${styles['btn-outline']}`} onClick={handleBack}>
                      <FiChevronLeft className={styles['btn-icon']} />
                      Précédent
                    </button>
                    <button
                      className={`${styles['btn']} ${styles['btn-primary']}`}
                      onClick={handleNext}
                      disabled={isLoading || savingEtape || (!isFormComplete && !isStepSaved)}
                    >
                      Suivant
                      <FiChevronRight className={styles['btn-icon']} />
                    </button>
                  </div>
                  <div className={styles['etapeSaveSection']}>
                    {success && (
                      <div className={`${styles['etapeMessage']} ${styles['success']}`}>
                        {success}
                      </div>
                    )}
                    {error && (
                      <div className={`${styles['etapeMessage']} ${styles['error']}`}>
                        {error}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {isMapFullscreen && (
            <div className={styles['mapFullscreenOverlay']}>
              <div className={styles['mapFullscreenHeader']}>
                <div className={styles['mapFullscreenHeaderTop']}>
                  <span>Carte ANAM - Plein écran</span>
                  <button
                    type="button"
                    className={styles['mapFullscreenClose']}
                    onClick={() => setIsMapFullscreen(false)}
                  >
                    Fermer
                  </button>
                </div>
                <div className={styles['mapFullscreenToolbar']}>
                  <div className={styles['mapFullscreenControls']}>
                    <select
                      value={coordinateSystem}
                      onChange={(e) => handleCoordinateSystemChange(e.target.value as CoordinateSystem)}
                      className={styles['system-select']}
                    >
                      <option value="UTM">UTM</option>
                    </select>
                    {coordinateSystem === 'UTM' && (
                      <>
                        <select
                          value={utmZone}
                          onChange={(e) => handleUtmZoneSelect(e.target.value)}
                          className={styles['zone-select']}
                        >
                          {Array.from({ length: 4 }, (_, i) => i + 29).map(zone => (
                            <option key={zone} value={zone}>{zone}</option>
                          ))}
                        </select>
                        <select
                          value={utmHemisphere}
                          onChange={(e) => setUtmHemisphere(e.target.value as 'N')}
                          className={styles['hemisphere-select']}
                        >
                          <option value="N">Nord (N)</option>
                        </select>
                      </>
                    )}
                  </div>
                  <button
                    className={styles['map-btn']}
                    onClick={checkMiningTitleOverlaps}
                    disabled={points.length < 3 || isCheckingOverlaps}
                    type="button"
                  >
                    <FiAlertTriangle /> Vérifier Chevauchements
                  </button>
                  <label className={styles['map-toggle']}>
                    <input
                      type="checkbox"
                      checked={showFuseaux}
                      onChange={(e) => setShowFuseaux(e.target.checked)}
                    />
                    Fuseaux UTM (29-32)
                  </label>
                  <div className={styles['mapFullscreenSearch']}>
                    <input
                      value={searchPerimetreCode}
                      onChange={(e) => setSearchPerimetreCode(e.target.value)}
                      placeholder="permis_code (layer 0)"
                      className={styles['mapFullscreenSearchInput']}
                    />
                    <button
                      type="button"
                      className={styles['map-btn']}
                      onClick={handleSearchPerimetre}
                    >
                      Chercher Périmètre
                    </button>
                    {searchMessage && (
                      <span className={styles['mapFullscreenSearchHint']}>{searchMessage}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles['mapFullscreenBody']}>
                <ArcGISMap
                  ref={isMapFullscreen ? mapRef : null}
                  points={points}
                  superficie={superficie}
                  isDrawing={false}
                  overlapTitles={miningTitleOverlaps}
                  existingPolygons={existingPolygons}
                  selectedExistingProcId={selectedHistoryProcId}
                  coordinateSystem={coordinateSystem}
                  utmZone={utmZone}
                  utmHemisphere={utmHemisphere}
                  onAdminDetected={handleAdminDetected}
                  showFuseaux={showFuseaux}
                  enableSelectionTools
                />
                <button
                  className={`${styles['secondary-btn']} ${styles['mapFullscreenAction']}`}
                  onClick={() => mapRef.current?.detectAdminForCurrent?.()}
                  type="button"
                >
                  Rafraîchir lieu détecté
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className={`${styles.toast} ${styles.toastSuccess}`}>
              <FiCheckCircle className={styles.toastIcon} />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className={`${styles.toast} ${styles.toastError}`}>
              <FiAlertTriangle className={styles.toastIcon} />
              <span>{error}</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
  
}

