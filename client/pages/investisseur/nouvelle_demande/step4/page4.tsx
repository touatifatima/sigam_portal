'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import axios from 'axios';
import {
  FiChevronLeft, FiChevronRight, FiMapPin, FiFileText, FiX, FiPlus,
  FiMap, FiGlobe, FiHash, FiEdit2, FiSearch,
  FiRefreshCw, FiCheck, FiUpload,
  FiArrowUp, FiArrowDown
} from 'react-icons/fi';
import styles from './substances.module.css';
import Navbar from '../../../navbar/Navbar';
import Sidebar from '../../../sidebar/Sidebar';
import ConfirmReplaceModal from './ConfirmReplaceModal';
import SummaryModal from '../popup/page6_popup';
import ProgressStepper from '../../../../components/ProgressStepper';
import { useStepperPhases } from '@/src/hooks/useStepperPhases';
import { STEP_LABELS } from '../../../../src/constants/steps';
import { useViewNavigator } from '../../../../src/hooks/useViewNavigator';
import { toast } from 'react-toastify';
import { useActivateEtape } from '@/src/hooks/useActivateEtape';
import router from 'next/router';
import { Phase, Procedure, ProcedureEtape, ProcedurePhase, StatutProcedure } from '@/src/types/procedure';
import { CoordinateConverter } from '../../../../utils/coordinateConverter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import proj4 from 'proj4';
import * as XLSX from 'xlsx';
import * as turf from '@turf/turf';
import * as RW from 'react-window';

// Types
type CoordinateSystem = 'WGS84' | 'UTM' | 'LAMBERT' | 'MERCATOR';

type ImportedPoint = {
  id: string;
  x: string;
  y: string;
  z: string;
  system: CoordinateSystem;
  zone?: number;
  hemisphere?: 'N';
};

type Point = {
  id: string;
  x: string;
  y: string;
  z: string;
  system: CoordinateSystem;
  zone?: number;
  hemisphere?: 'N' ;
};

type CoordinateConversion = {
  from: CoordinateSystem;
  to: CoordinateSystem;
  zone?: number;
  hemisphere?: 'N';
};

type SubstanceWithPriority = {
  id_sub: number;
  nom_subFR: string;
  nom_subAR: string;
  categorie_sub: string;
  priorite: 'principale' | 'secondaire';
};

type Wilaya = {
  id_wilaya: number;
  id_antenne: number;
  code_wilaya: string;
  nom_wilayaFR: string;
};

type Daira = {
  id_daira: number;
  id_wilaya: number;
  code_daira: string;
  nom_dairaFR: string;
};

type Commune = {
  id_commune: number;
  id_daira: number;
  code_commune: string;
  nom_communeFR: string;
};

type ZoneSelection = {
  id: string;
  wilayaId: string;
  dairaId: string;
  communeId: string;
};

type SecondaryRow = {
  id: string;
  substanceId: number | null;
};

export default function Step4_Substances() {
  const searchParams = useSearchParams();
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const [idDemande, setIdDemande] = useState<number | null>(null);
  const [codeDemande, setCodeDemande] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentStep] = useState(4);
  const [activatedSteps, setActivatedSteps] = useState<Set<number>>(new Set());
  const [isPageReady, setIsPageReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Chargement des paramétres...');

  // Site Information State
  const [points, setPoints] = useState<Point[]>([]);
  const [polygonArea, setPolygonArea] = useState<number | null>(null);
  const [lieuDitFr, setLieuDitFr] = useState('');
  const [lieuDitAr, setLieuDitAr] = useState('');
  const [statutJuridique, setStatutJuridique] = useState('');
  const [occupantLegal, setOccupantLegal] = useState('');
  const [superficie, setSuperficie] = useState('');
  const [superficieDeclaree, setSuperficieDeclaree] = useState('');
  const [travaux, setTravaux] = useState('');
  const [dureeTravaux, setDureeTravaux] = useState('');
  const [dateDebutPrevue, setDateDebutPrevue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Substances State
  const [allSubstances, setAllSubstances] = useState<SubstanceWithPriority[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [famille, setFamille] = useState('');
  const [savingEtape, setSavingEtape] = useState(false);
  const [etapeMessage, setEtapeMessage] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [superficiermax, setSuperficiermax] = useState(0);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);

  const lockPerimeter = useMemo(() => {
    try {
      const code = (procedureData?.demandes?.[0]?.typePermis?.code_type || '').toUpperCase();
      return code.startsWith('TX');
    } catch { return false; }
  }, [procedureData]);
  // Missing docs alert for first-phase reminder
  const [missingDocsAlert, setMissingDocsAlert] = useState<{ missing: string[]; deadline?: string | null } | null>(null);
  const [tick, setTick] = useState(0);

  // Administrative divisions state
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [dairasByWilaya, setDairasByWilaya] = useState<Record<string, Daira[]>>({});
  const [communesByDaira, setCommunesByDaira] = useState<Record<string, Commune[]>>({});
  const createZoneRow = (overrides: Partial<ZoneSelection> = {}): ZoneSelection => ({
    id: Math.random().toString(36).substring(2, 9),
    wilayaId: '',
    dairaId: '',
    communeId: '',
    ...overrides,
  });
  const createSecondaryRow = (substanceId: number | null = null): SecondaryRow => ({
    id: Math.random().toString(36).substring(2, 9),
    substanceId,
  });
  const [zoneSelections, setZoneSelections] = useState<ZoneSelection[]>([
    createZoneRow(),
  ]);
  const [selectedPriority, setSelectedPriority] = useState<'principale' | 'secondaire'>('secondaire');
  const [selectedSubstances, setSelectedSubstances] = useState<SubstanceWithPriority[]>([]);
  const [principalSubstanceId, setPrincipalSubstanceId] = useState<number | null>(null);
  const [secondaryRows, setSecondaryRows] = useState<SecondaryRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [existingCoords, setExistingCoords] = useState<{ x: number; y: number; z: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedCoordinates, setHasSavedCoordinates] = useState(false);
  const [statutProc, setStatutProc] = useState<string | undefined>(undefined);

  // Coordinate system state
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('UTM');
  const [utmZone, setUtmZone] = useState<number>(31);
  const [utmHemisphere, setUtmHemisphere] = useState<'N'>('N');
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [coordinateErrors, setCoordinateErrors] = useState<{ [key: string]: string }>({});

  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [currentEtape, setCurrentEtape] = useState<{ id_etape: number } | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>();
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [hasActivatedStep4, setHasActivatedStep4] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const computeRemaining = (deadline?: string | null) => {
    if (!deadline) return null;
    const d = new Date(deadline).getTime();
    const now = Date.now();
    const diff = d - now;
    if (diff <= 0) return 'Délai expiré';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}j ${hours}h restants`;
  };

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!idDemande) { setMissingDocsAlert(null); return; }
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/procedure/${idDemande}/documents`, { signal: controller.signal });
        const miss = (res.data?.missingSummary?.requiredMissing ?? []).map((d: any) => d.nom_doc);
        const deadline = res.data?.deadlines?.miseEnDemeure ?? null;
        if (Array.isArray(miss) && miss.length > 0) {
          setMissingDocsAlert({ missing: miss, deadline });
        } else {
          setMissingDocsAlert(null);
        }
      } catch (e) {
        if (!axios.isCancel(e)) setMissingDocsAlert(null);
      }
    };
    load();
    return () => controller.abort();
  }, [idDemande, apiURL, tick]);

const [idProc, setIdProc] = useState<number | undefined>(undefined);

const filteredSubstances = useMemo(() => {
    return allSubstances.filter((s) => {
      const matchesFamille = famille ? s.categorie_sub === famille : true;
      const matchesSearch = s.nom_subFR.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFamille && matchesSearch;
    });
  }, [allSubstances, famille, searchTerm]);

const secondarySubstanceIds = useMemo(
  () =>
    secondaryRows
      .map((row) => row.substanceId)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  [secondaryRows],
);

// Helper: normalize numeric coordinate strings written with
// French-style thousands/decimal separators into a JS number.
const parseCoordinateValue = (value: string): number => {
  if (!value) return NaN;
  const clean = value
    .toString()
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/,/g, '.');
  return parseFloat(clean);
};

useEffect(() => {
  if (points.length >= 3 && points.every((coord) => coord.x && coord.y)) {
    try {
      const cleanedPoints = points.map((p) => ({
        x: parseCoordinateValue(p.x),
        y: parseCoordinateValue(p.y),
        z: parseCoordinateValue(p.z || '0') || 0,
        system: (p.system || coordinateSystem || 'UTM') as CoordinateSystem,
        zone: p.zone,
        hemisphere: p.hemisphere,
      }));

      const primarySystem: CoordinateSystem =
        (cleanedPoints[0]?.system as CoordinateSystem) || coordinateSystem || 'UTM';

      let area = 0;

      if (primarySystem === 'UTM') {
        area = CoordinateConverter.calculateUTMArea(cleanedPoints);
      } else {
        const pointsForCalculation = cleanedPoints.map((point) => {
          if (point.system !== 'WGS84') {
            return CoordinateConverter.convertCoordinate(point, 'WGS84');
          }
          return point;
        });

        const polygon = turf.polygon([[
          ...pointsForCalculation.map((coord) => [coord.x, coord.y]),
          [pointsForCalculation[0].x, pointsForCalculation[0].y],
        ]]);
        area = turf.area(polygon);

        // Fallback: if the numbers look comme UTM mais l'aire est énorme, recalculer en UTM
        const looksUTM = cleanedPoints.every((p) => Math.abs(p.x) > 1000 && Math.abs(p.y) > 1000);
        if (looksUTM && area / 10000 > 1_000_000) {
          area = CoordinateConverter.calculateUTMArea(cleanedPoints);
        }
      }

      setPolygonArea(area);
      setSuperficie((area / 10000).toFixed(2));
    } catch (err) {
      setPolygonArea(null);
    }
  } else {
    setPolygonArea(null);
  }
}, [points, coordinateSystem]);

const validateCoordinate = (value: string, field: 'x' | 'y', system: CoordinateSystem): boolean => {
  const numValue = parseCoordinateValue(value);
  if (isNaN(numValue)) {
    return false;
  }

  try {
    // Si on est censé être en WGS84 mais qu'on voit des valeurs de type UTM (très grandes),
    // on bascule la validation en mode UTM pour éviter les faux positifs.
    let effectiveSystem: CoordinateSystem = system;
    if (system === 'WGS84' && Math.abs(numValue) > 1000) {
      effectiveSystem = 'UTM';
    }

    switch (effectiveSystem) {
      case 'WGS84':
        return CoordinateConverter.validateWGS84(field === 'x' ? numValue : 0, field === 'y' ? numValue : 0);
      case 'UTM':
        if (field === 'x') {
          return numValue >= 100000 && numValue <= 999999;
        }
        return numValue >= 0 && numValue <= 10000000;
      default:
        return true;
    }
  } catch {
    return false;
  }
};
  
const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const sub = filteredSubstances[index];
    return (
      <li key={sub.id_sub} style={style} className={styles['substance-item']}>
        <label className={styles['substance-label']}>
          <input
            disabled={statutProc === 'TERMINEE'}
            type="checkbox"
            className={styles['substance-checkbox']}
            checked={isChecked(sub.id_sub)}
            onChange={() => handleSelect(sub)}
          />
          <span className={styles['custom-checkbox']} />
          <span className={styles['substance-name']}>
            {sub.nom_subAR ? `${sub.nom_subAR} (${sub.nom_subFR || sub.nom_subAR})` : sub.nom_subFR}
          </span>
          <span className={styles['substance-category']}>{sub.categorie_sub}</span>
        </label>
      </li>
    );
  };


// Get idProc from URL parameters and store it in state
useEffect(() => {
  const idProcStr = searchParams?.get('id');
  if (!idProcStr) {
    setError('ID de procédure non trouvé dans les paramétres');
    setLoadingMessage('ID de procédure non trouvé dans les paramétres');
    return;
  }

  const parsedId = parseInt(idProcStr, 10);
  if (isNaN(parsedId)) {
    setError('ID de procédure invalide');
    setLoadingMessage('ID de procédure invalide');
    return;
  }

  setIdProc(parsedId);
}, [searchParams]);

// Check for required data every millisecond
useEffect(() => {
  const checkInterval = setInterval(() => {
    if (idProc && procedureData && idDemande) {
      setIsPageReady(true);
      setIsLoading(false);
      clearInterval(checkInterval);
    } else {
      if (!idProc) {
        setLoadingMessage("En attente de l'ID de procédure...");
      } else if (!procedureData) {
        setLoadingMessage('Chargement des données de procédure...');
      } else if (!idDemande) {
        setLoadingMessage('Chargement des données de demande...');
      }
    }
  }, 1); // Check every millisecond

  return () => clearInterval(checkInterval);
}, [idProc, procedureData, idDemande]);

// Fetch all required data when idProc is available
useEffect(() => {
  if (!idProc) return;

  const fetchAllData = async () => {
    try {
      setLoadingMessage('Chargement des données de procédure...');

      // Fetch procedure data
      const procedureRes = await axios.get<Procedure>(
        `${apiURL}/api/procedure-etape/procedure/${idProc}`,
        { withCredentials: true }
      );
      setProcedureData(procedureRes.data);

      if (procedureRes.data.demandes && procedureRes.data.demandes.length > 0) {
        const demandeLite = procedureRes.data.demandes[0];
        setProcedureTypeId(demandeLite.typeProcedure?.id);
        setIdDemande(demandeLite.id_demande);
        setCodeDemande(demandeLite.code_demande);
        setStatutProc(procedureRes.data.statut_proc);
        setSuperficiermax(demandeLite.typePermis?.superficie_max || 0);

        const rawZones = Array.isArray(demandeLite.communes) && demandeLite.communes.length > 0
          ? demandeLite.communes
              .map((dc: any) => {
                const communeId = dc?.id_commune ?? dc?.commune?.id_commune;
                const dairaId = dc?.commune?.id_daira ?? dc?.daira?.id_daira;
                return {
                  communeId: communeId != null ? String(communeId) : '',
                  dairaId: dairaId != null ? String(dairaId) : '',
                  wilayaId: '',
                };
              })
              .filter((zone: any) => zone.communeId)
          : demandeLite.id_commune
          ? [
              {
                communeId: String(demandeLite.id_commune),
                dairaId: demandeLite.id_daira ? String(demandeLite.id_daira) : '',
                wilayaId: demandeLite.id_wilaya ? String(demandeLite.id_wilaya) : '',
              },
            ]
          : [];

        const uniqueZones = new Map<string, { communeId: string; dairaId: string; wilayaId: string }>();
        rawZones.forEach((zone: any) => {
          if (!uniqueZones.has(zone.communeId)) {
            uniqueZones.set(zone.communeId, zone);
          }
        });
        let zonesList = Array.from(uniqueZones.values());

        const fallbackWilayaId = demandeLite.id_wilaya ? String(demandeLite.id_wilaya) : '';
        const fallbackDairaId = demandeLite.id_daira ? String(demandeLite.id_daira) : '';
        zonesList = zonesList.map((zone) => ({
          communeId: zone.communeId,
          dairaId: zone.dairaId || fallbackDairaId,
          wilayaId: zone.wilayaId || fallbackWilayaId,
        }));

        if (zonesList.length > 0) {
          try {
            const dairaIds = Array.from(
              new Set(zonesList.map((zone) => zone.dairaId).filter((value) => value)),
            );
            if (dairaIds.length > 0) {
              const dairaResults = await Promise.all(
                dairaIds.map((id) =>
                  axios
                    .get(`${apiURL}/api/dairas/${id}`, { withCredentials: true })
                    .catch(() => null),
                ),
              );
              const dairaWilayaMap = new Map<string, string>();
              dairaResults.forEach((res, index) => {
                const daira = res?.data;
                if (daira?.id_wilaya != null) {
                  dairaWilayaMap.set(dairaIds[index], String(daira.id_wilaya));
                }
              });
              zonesList = zonesList.map((zone) => ({
                ...zone,
                wilayaId: zone.wilayaId || (zone.dairaId ? dairaWilayaMap.get(zone.dairaId) ?? '' : ''),
              }));
            }
          } catch {}
        }

        setZoneSelections(
          zonesList.length > 0 ? zonesList.map((zone) => createZoneRow(zone)) : [createZoneRow()],
        );
        setLieuDitFr(demandeLite.lieu_ditFR || '');
        setLieuDitAr(demandeLite.lieu_dit_ar || '');
        setStatutJuridique(demandeLite.statut_juridique_terrain || '');
        setOccupantLegal(demandeLite.occupant_terrain_legal || '');
        setSuperficie(demandeLite.superficie?.toString() || '');
        // Initialize declared area from demande if no provisional value yet
        if (demandeLite.superficie != null) {
          setSuperficieDeclaree(demandeLite.superficie.toString());
        }
        setTravaux(demandeLite.description_travaux || '');
        setDureeTravaux(demandeLite.duree_travaux_estimee?.toString() || '');
        setDateDebutPrevue(demandeLite.date_demarrage_prevue?.split('T')[0] || '');
      }

      const activeEtape = procedureRes.data.ProcedureEtape.find(
        (pe: ProcedureEtape) => pe.statut === 'EN_COURS'
      );
      if (activeEtape) {
        setCurrentEtape({ id_etape: activeEtape.id_etape });
      }

      // Fetch wilayas
      setLoadingMessage('Chargement des wilayas...');
      const wilayasRes = await axios.get(`${apiURL}/api/wilayas`, { withCredentials: true });
      setWilayas(wilayasRes.data);

      // Fetch provisional coordinates first, fallback to legacy coordinates
      setLoadingMessage('Chargement des coordonnées...');
      try {
        const provRes = await axios.get(`${apiURL}/inscription-provisoire/procedure/${idProc}`, { withCredentials: true });
        const rec = provRes.data;
        const pts = Array.isArray(rec?.points) ? rec.points : [];
        if (typeof rec?.superficie_declaree === 'number') {
          setSuperficieDeclaree(rec.superficie_declaree.toString());
        }

        if (pts.length > 0) {
          const sys = pts[0]?.system || 'UTM';
          const zoneVal = pts[0]?.zone || 31;
          const hemiVal = pts[0]?.hemisphere || 'N';
          setPoints(
            pts.map((p: any) => ({
              id: generateId(),
              x: p.x?.toString() ?? '',
              y: p.y?.toString() ?? '',
              z: p.z?.toString() ?? '0',
              system: p.system || sys,
              zone: p.zone || zoneVal,
              hemisphere: p.hemisphere || hemiVal,
            }))
          );
          try {
            console.log('Step4: loaded coords', {
              source: 'provisional',
              count: pts.length,
              system: pts[0]?.system,
              zone: pts[0]?.zone,
              hemisphere: pts[0]?.hemisphere,
            });
          } catch {}
          setCoordinateSystem(sys);
          setUtmZone(zoneVal);
          setUtmHemisphere(hemiVal);
          setHasSavedCoordinates(true);
        } else {
          // Fallback to definitive coordinates if no provisional points
          const coordsRes = await axios.get(`${apiURL}/coordinates/procedure/${idProc}`, { withCredentials: true });
          const coords = coordsRes.data.filter(
            (c: any) => c?.coordonnee?.x && c?.coordonnee?.y
          );
          const sys = coords[0]?.coordonnee?.system || 'UTM';
          const zoneVal = coords[0]?.coordonnee?.zone || 31;
          const hemiVal = coords[0]?.coordonnee?.hemisphere || 'N';
          setPoints(
            coords.map((c: any) => ({
              id: generateId(),
              x: c.coordonnee.x.toString(),
              y: c.coordonnee.y.toString(),
              z: c.coordonnee.z?.toString() || '0',
              system: c.coordonnee.system || sys,
              zone: c.coordonnee.zone || zoneVal,
              hemisphere: c.coordonnee.hemisphere || hemiVal,
            }))
          );
          try {
            console.log('Step4: loaded coords', {
              source: 'definitive',
              count: coords.length,
              system: coords[0]?.coordonnee?.system,
              zone: coords[0]?.coordonnee?.zone,
              hemisphere: coords[0]?.coordonnee?.hemisphere,
            });
          } catch {}
          setCoordinateSystem(sys);
          setUtmZone(zoneVal);
          setUtmHemisphere(hemiVal);
          setHasSavedCoordinates(coords.length > 0);
        }
      } catch {
        const coordsRes = await axios.get(`${apiURL}/coordinates/procedure/${idProc}`, { withCredentials: true });
        const coords = coordsRes.data.filter(
          (c: any) => c?.coordonnee?.x && c?.coordonnee?.y
        );
        const sys = coords[0]?.coordonnee?.system || 'UTM';
        const zoneVal = coords[0]?.coordonnee?.zone || 31;
        const hemiVal = coords[0]?.coordonnee?.hemisphere || 'N';
        setPoints(
          coords.map((c: any) => ({
            id: generateId(),
            x: c.coordonnee.x.toString(),
            y: c.coordonnee.y.toString(),
            z: c.coordonnee.z?.toString() || '0',
            system: c.coordonnee.system || sys,
            zone: c.coordonnee.zone || zoneVal,
            hemisphere: c.coordonnee.hemisphere || hemiVal,
          }))
        );
        try { console.log('Step4: loaded coords', { source: 'definitive-fallback', count: coords.length, system: sys, zone: zoneVal, hemisphere: hemiVal }); } catch {}
        setCoordinateSystem(sys);
        setUtmZone(zoneVal);
        setUtmHemisphere(hemiVal);
        setHasSavedCoordinates(coords.length > 0);
      }

      // Ensure perimeter is present for exploitation by copying from prior if missing
      try {
        const typeCode = (procedureRes.data?.demandes?.[0]?.typePermis?.code_type || '').toUpperCase();
        if (typeCode.startsWith('TX')) {
          const check = await axios.get(`${apiURL}/coordinates/procedure/${idProc}`, { withCredentials: true });
          const hasCoords = Array.isArray(check.data) && check.data.some((c: any) => c?.coordonnee?.x && c?.coordonnee?.y);
          const contextMatches = true; // ignore client cache; rely on server links
            if (!hasCoords && contextMatches) {
            let srcProcId: number | null = null;
            const storedSrc = null; // disable client cache
            // Server-side persisted source procedure id on the Demande
            if (!srcProcId && contextMatches) {
              try {
                const dres = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`, { withCredentials: true });
                const srvSrc = dres.data?.id_sourceProc;
                if (srvSrc && !isNaN(parseInt(String(srvSrc)))) srcProcId = parseInt(String(srvSrc));
              } catch {}
            }
            // skip local cache; rely on server linkage only
            if (srcProcId && contextMatches) {
              // Try definitive coordinates first
              let payloadPoints: any[] = [];
              try {
                const coordsRes2 = await axios.get(`${apiURL}/coordinates/procedure/${srcProcId}`, { withCredentials: true });
                const links2: any[] = coordsRes2.data || [];
                payloadPoints = links2
                  .filter((l: any) => l?.coordonnee?.x && l?.coordonnee?.y)
                  .map((l: any) => ({
                    x: String(l.coordonnee.x),
                    y: String(l.coordonnee.y),
                    z: String(l.coordonnee.z ?? '0'),
                    system: l.coordonnee.system || 'UTM',
                    zone: l.coordonnee.zone ?? 31,
                    hemisphere: l.coordonnee.hemisphere ?? 'N',
                  }));
              } catch {}

              // If none found, try provisional coordinates on the source procedure
              if (payloadPoints.length < 3) {
                try {
                  const prov = await axios.get(`${apiURL}/inscription-provisoire/procedure/${srcProcId}`, { withCredentials: true });
                  const pts = Array.isArray(prov.data?.points) ? prov.data.points : [];
                  if (pts.length >= 3) {
                    payloadPoints = pts.map((p: any) => ({
                      x: String(p.x),
                      y: String(p.y),
                      z: String(p.z ?? '0'),
                      system: p.system || 'UTM',
                      zone: p.zone ?? 31,
                      hemisphere: p.hemisphere ?? 'N',
                    }));
                  }
                } catch {}
              }

              if (payloadPoints.length >= 3) {
                try {
                  await axios.post(`${apiURL}/coordinates/update`, {
                    id_proc: idProc,
                    id_zone_interdite: null,
                    points: payloadPoints,
                  }, { withCredentials: true });
                } catch {}

                // Re-fetch to ensure points are saved and rendered consistently
                try {
                  const saved = await axios.get(`${apiURL}/coordinates/procedure/${idProc}`, { withCredentials: true });
                  const coords = (saved.data || []).filter((c: any) => c?.coordonnee?.x && c?.coordonnee?.y);
                  if (coords.length >= 3) {
                    setPoints(coords.map((c: any) => ({
                      id: generateId(),
                      x: String(c.coordonnee.x),
                      y: String(c.coordonnee.y),
                      z: String(c.coordonnee.z ?? '0'),
                      system: c.coordonnee.system || 'WGS84',
                      zone: c.coordonnee.zone ?? undefined,
                      hemisphere: c.coordonnee.hemisphere ?? undefined,
                    })));
                    try { console.log('Step4: loaded coords', { source: 'prior-definitive', count: coords.length, system: coords[0]?.coordonnee?.system, zone: coords[0]?.coordonnee?.zone, hemisphere: coords[0]?.coordonnee?.hemisphere }); } catch {}
                  } else {
                    setPoints(payloadPoints.map((p: any) => ({
                      id: generateId(),
                      x: p.x,
                      y: p.y,
                      z: p.z ?? '0',
                      system: p.system || 'UTM',
                      zone: p.zone ?? 31,
                      hemisphere: p.hemisphere ?? 'N',
                    })));
                    try { console.log('Step4: loaded coords', { source: 'prior-provisional', count: payloadPoints.length }); } catch {}
                  }
                } catch {
                  setPoints(payloadPoints.map((p: any) => ({
                    id: generateId(),
                    x: p.x,
                    y: p.y,
                    z: p.z ?? '0',
                    system: p.system || 'UTM',
                    zone: p.zone ?? 31,
                    hemisphere: p.hemisphere ?? 'N',
                  })));
                  try { console.log('Step4: loaded coords', { source: 'prior-fallback', count: payloadPoints.length }); } catch {}
                }
              }
            }
          }
        }
      } catch {}

      // Fetch substances
      setLoadingMessage('Chargement des substances...');
      const substancesRes = await axios.get(
        `${apiURL}/api/substances/demande/${procedureRes.data.demandes[0].id_demande}`,
        { withCredentials: true }
      );
      const substancesWithPriority = substancesRes.data.map((item: any) => ({
        id_sub: item.id_sub,
        nom_subFR: item.nom_subFR || '',
        nom_subAR: item.nom_subAR || '',
        categorie_sub: item.categorie_sub,
        priorite: item.priorite || 'secondaire',
      }));
      setSelectedSubstances(substancesWithPriority);
      setSelectedIds(substancesWithPriority.map((item: any) => item.id_sub));
      const principal = substancesWithPriority.find((s: SubstanceWithPriority) => s.priorite === 'principale');
      setPrincipalSubstanceId(principal?.id_sub ?? null);
      const secondaryIds = substancesWithPriority
        .filter((s: SubstanceWithPriority) => s.priorite === 'secondaire')
        .map((s: SubstanceWithPriority) => s.id_sub)
        .filter((id: unknown): id is number => typeof id === 'number');
      const uniqueSecondaryIds = Array.from(new Set<number>(secondaryIds));
      setSecondaryRows(uniqueSecondaryIds.map((id: number) => createSecondaryRow(id)));

      setLoadingMessage('Données chargées avec succés');
    } catch (err) {
      
      setError('Erreur lors du chargement des données');
      setLoadingMessage('Erreur lors du chargement des données');
    }
  };

  fetchAllData();
}, [idProc, apiURL, refetchTrigger]);


  
  const loadDairasForWilaya = useCallback(
    async (wilayaId: string) => {
      if (!wilayaId || !apiURL) return;
      if (dairasByWilaya[wilayaId]) return;
      try {
        const res = await axios.get(`${apiURL}/api/wilayas/${wilayaId}/dairas`, {
          withCredentials: true,
        });
        setDairasByWilaya((prev) => ({ ...prev, [wilayaId]: res.data }));
      } catch (err) {
        setError('Erreur lors du chargement des dairas');
      }
    },
    [apiURL, dairasByWilaya],
  );

  const loadCommunesForDaira = useCallback(
    async (dairaId: string) => {
      if (!dairaId || !apiURL) return;
      if (communesByDaira[dairaId]) return;
      try {
        const res = await axios.get(`${apiURL}/api/dairas/${dairaId}/communes`, {
          withCredentials: true,
        });
        setCommunesByDaira((prev) => ({ ...prev, [dairaId]: res.data }));
      } catch (err) {
        setError('Erreur lors du chargement des communes');
      }
    },
    [apiURL, communesByDaira],
  );

  const handleZoneChange = (
    zoneId: string,
    field: 'wilayaId' | 'dairaId' | 'communeId',
    value: string,
  ) => {
    setZoneSelections((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) return zone;
        if (field === 'wilayaId') {
          return { ...zone, wilayaId: value, dairaId: '', communeId: '' };
        }
        if (field === 'dairaId') {
          return { ...zone, dairaId: value, communeId: '' };
        }
        return { ...zone, communeId: value };
      }),
    );

    if (field === 'wilayaId' && value) {
      loadDairasForWilaya(value);
    }
    if (field === 'dairaId' && value) {
      loadCommunesForDaira(value);
    }
  };

  const addZoneRow = () => {
    setZoneSelections((prev) => [...prev, createZoneRow()]);
  };

  const removeZoneRow = (zoneId: string) => {
    setZoneSelections((prev) => (prev.length > 1 ? prev.filter((zone) => zone.id !== zoneId) : prev));
  };

  useEffect(() => {
    zoneSelections.forEach((zone) => {
      if (zone.wilayaId) {
        loadDairasForWilaya(zone.wilayaId);
      }
      if (zone.dairaId) {
        loadCommunesForDaira(zone.dairaId);
      }
    });
  }, [zoneSelections, loadDairasForWilaya, loadCommunesForDaira]);

// Activate Step 4 if needed
  useActivateEtape({
    idProc,
    etapeNum: 4,
    shouldActivate: currentStep === 4 && !activatedSteps.has(4) && isPageReady,
    onActivationSuccess: (stepStatus: string) => {
      if (stepStatus === 'TERMINEE') {
        setActivatedSteps(prev => new Set(prev).add(4));
        setHasActivatedStep4(true);
        return;
      }

      setActivatedSteps(prev => new Set(prev).add(4));
      setHasActivatedStep4(true);
      setTimeout(() => setRefetchTrigger(prev => prev + 1), 500);
    },
  });

  // Fetch substances when famille or idDemande changes
  useEffect(() => {
    if (!idDemande) return;
    const fetchSubstances = async () => {
      try {
        setIsLoading(true);
        const res = await axios.get(`${apiURL}/api/substances`, { params: { famille } });
        setAllSubstances(res.data);
      } catch (err) {
        
        setError('Erreur lors du chargement des substances');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubstances();
  }, [idDemande, famille, apiURL]);

  const { phases: stepperPhases, etapeIdForRoute } = useStepperPhases(procedureData, apiURL, 'investisseur/nouvelle_demande/step4/page4');
  const fallbackPhases: Phase[] = procedureData?.ProcedurePhase
    ? procedureData.ProcedurePhase.slice().sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre).map((pp: ProcedurePhase) => ({ ...pp.phase, ordre: pp.ordre }))
    : [];
  const phases: Phase[] = stepperPhases.length > 0 ? stepperPhases : fallbackPhases;

  const etapeIdForThisPage = useMemo(() => {
    if (etapeIdForRoute) return etapeIdForRoute;
    if (!procedureData) return null;
    const pathname = 'investisseur/nouvelle_demande/step4/page4';
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
      return route === target || route.endsWith(target) || route.includes('step4/page4');
    });
    if (byRoute) return byRoute.id_etape;
    const allEtapes = [
      ...phaseEtapes,
      ...((procedureData.ProcedureEtape || []).map((pe: any) => pe.etape).filter(Boolean) as any[]),
    ];
    const byLabel = allEtapes.find((e: any) =>
      String(e?.lib_etape ?? '').toLowerCase().includes('substance'),
    );
    return byLabel?.id_etape ?? 4;
  }, [etapeIdForRoute, procedureData]);

  const isStepSaved = useMemo(() => {
    if (!procedureData || !etapeIdForThisPage) return false;
    return (procedureData.ProcedureEtape || []).some(
      (pe) => pe.id_etape === etapeIdForThisPage && pe.statut === 'TERMINEE',
    );
  }, [procedureData, etapeIdForThisPage]);

  const hasCompleteZones = useMemo(
    () =>
      zoneSelections.length > 0 &&
      zoneSelections.every((zone) => zone.wilayaId && zone.dairaId && zone.communeId),
    [zoneSelections],
  );

  const normalizedZones = useMemo(() => {
    const parsed = zoneSelections
      .map((zone) => ({
        wilayaId: Number(zone.wilayaId),
        dairaId: Number(zone.dairaId),
        communeId: Number(zone.communeId),
      }))
      .filter(
        (zone) =>
          Number.isFinite(zone.wilayaId) &&
          Number.isFinite(zone.dairaId) &&
          Number.isFinite(zone.communeId),
      );
    const uniqueByCommune = new Map<number, (typeof parsed)[number]>();
    parsed.forEach((zone) => {
      if (!uniqueByCommune.has(zone.communeId)) {
        uniqueByCommune.set(zone.communeId, zone);
      }
    });
    return Array.from(uniqueByCommune.values());
  }, [zoneSelections]);

  const isFormComplete = useMemo(() => {
    const superficieDecl =
      superficieDeclaree &&
      superficieDeclaree.trim() !== '' &&
      !isNaN(Number(superficieDeclaree)) &&
      Number(superficieDeclaree) > 0;
    const hasAdmin = hasCompleteZones;
    const hasLocation = lieuDitFr.trim() !== '' && lieuDitAr.trim() !== '';
    const hasTerrain = statutJuridique.trim() !== '' && occupantLegal.trim() !== '';
    const hasPrincipalSubstance = principalSubstanceId !== null;

    return (
      superficieDecl &&
      hasAdmin &&
      hasLocation &&
      hasTerrain &&
      hasPrincipalSubstance
    );
  }, [
    superficieDeclaree,
    hasCompleteZones,
    lieuDitFr,
    lieuDitAr,
    statutJuridique,
    occupantLegal,
    principalSubstanceId,
  ]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

const checkButtonConditions = () => {
  const disabled = isSaving || !statutProc || 
                  (polygonArea !== null && polygonArea / 10000 > superficiermax) || 
                  Object.keys(coordinateErrors).length > 0;
  
  return disabled;
};
  const convertCoordinate = (point: Point, conversion: CoordinateConversion): Point => {
    const { from, to, zone, hemisphere } = conversion;
    if (from === to) return point;

    const numericPoint = {
      x: parseCoordinateValue(point.x),
      y: parseCoordinateValue(point.y),
      z: parseCoordinateValue(point.z || '0') || 0,
      system: from,
      zone: point.zone,
      hemisphere: point.hemisphere,
    };

    try {
      const converted = CoordinateConverter.convertCoordinate(numericPoint, to, zone || point.zone, hemisphere || point.hemisphere);
      return {
        ...point,
        x: converted.x.toString(),
        y: converted.y.toString(),
        system: to,
        zone: converted.zone,
        hemisphere: converted.hemisphere,
      };
    } catch (error) {
      
      toast.error('Erreur de conversion des coordonnées');
      return point;
    }
  };

  const submitCoordinates = async (statutCoord: 'DEMANDE_INITIALE' = 'DEMANDE_INITIALE') => {
    if (!idProc) {
      toast.error('ID de procédure introuvable');
      return;
    }

    setIsSaving(true);
      const payload = {
        id_proc: idProc,
        id_demande: idDemande ?? undefined,
        points: points.map((p) => ({
          x: parseCoordinateValue(p.x),
          y: parseCoordinateValue(p.y),
          z: parseCoordinateValue(p.z || '0') || 0,
          system: p.system,
          zone: p.zone,
          hemisphere: p.hemisphere,
      })),
      system: coordinateSystem,
      zone: coordinateSystem === 'UTM' ? utmZone : undefined,
      hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined,
      // Persist superficie déclarée as well when provided to avoid losing previously saved value
      superficie_declaree:
        superficieDeclaree && superficieDeclaree.trim() !== ''
          ? parseFloat(
              superficieDeclaree
                .replace(/[\s\u00A0\u202F]/g, '')
                .replace(/,/g, '.')
            )
          : undefined,
    };

    try {
      const res = await fetch(`${apiURL}/inscription-provisoire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erreur lors de la mise a jour');
      const saved = await res.json();
      if (saved && Array.isArray(saved.points)) {
        const newPts: Point[] = saved.points.map((p: any) => ({
          id: generateId(),
          x: String(p.x),
          y: String(p.y),
          z: String(p.z ?? '0'),
          system: (p.system as CoordinateSystem) || coordinateSystem,
          zone: p.zone ?? undefined,
          hemisphere: (p.hemisphere as 'N' | undefined) ?? undefined,
        }));
        setPoints(newPts);
        setHasSavedCoordinates(true);
      }
      if (typeof saved?.superficie_declaree === 'number') {
        setSuperficieDeclaree(String(saved.superficie_declaree));
      }
      toast.success('Coordonnées provisoires enregistrées avec succés');

    } catch (err) {
      
      toast.error("Erreur lors de l'enregistrement des coordonnées");
    } finally {
      setIsSaving(false);
      setShowModal(false);
    }
  };

  const saveCoordinatesToBackend = async () => {
    if (!idProc) {
      toast.error('ID de procédure introuvable');
      return;
    }

    const errors: { [key: string]: string } = {};
    points.forEach((point, index) => {
      if (!validateCoordinate(point.x, 'x', coordinateSystem)) {
        errors[`x-${index}`] = `Coordonnée X invalide pour le point ${index + 1}`;
      }
      if (!validateCoordinate(point.y, 'y', coordinateSystem)) {
        errors[`y-${index}`] = `Coordonnée Y invalide pour le point ${index + 1}`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setCoordinateErrors(errors);
      toast.error('Veuillez corriger les erreurs de coordonnées');
      return;
    }

    setCoordinateErrors({});
    if (polygonArea !== null && polygonArea / 10000 > superficiermax) {
      toast.warning(` La superficie calculée (${(polygonArea / 10000).toFixed(2)} Ha) dépasse la limite autorisée (${superficiermax} Ha)`);
      return;
    }

      const newPoints = points.map((p) => ({
        x: parseCoordinateValue(p.x),
        y: parseCoordinateValue(p.y),
        z: parseCoordinateValue(p.z || '0') || 0,
      }));

    try {
      let existingPoints: { x: number; y: number; z: number }[] = [];
      try {
        const existingRes = await axios.get(`${apiURL}/inscription-provisoire/procedure/${idProc}`);
        const existing = existingRes?.data;
        if (existing) {
            existingPoints = Array.isArray(existing?.points)
              ? existing.points.map((p: any) => ({
                  x: typeof p.x === 'number' ? p.x : parseCoordinateValue(String(p.x)),
                  y: typeof p.y === 'number' ? p.y : parseCoordinateValue(String(p.y)),
                  z: typeof p.z === 'number' ? p.z : parseCoordinateValue(String(p.z ?? '0')) || 0,
                }))
              : [];
        }
      } catch (err: any) {
        if (!(err?.response?.status === 404)) {
          throw err;
        }
      }

      setExistingCoords(existingPoints);
      const areEqual = newPoints.length === existingPoints.length &&
        newPoints.every((np, index) => {
          const ep = existingPoints[index];
          return Math.abs(np.x - ep.x) < 0.00001 && Math.abs(np.y - ep.y) < 0.00001 && Math.abs(np.z - ep.z) < 0.00001;
        });
      if (areEqual) {
        toast.info('Coordonnées identiques déjé enregistrées');
        return;
      }

      if (existingPoints.length > 0) {
        setShowReplaceModal(true);
      } else {
        await submitCoordinates();
      }
    } catch (error) {
      
      toast.error('Erreur de vérification des coordonnées existantes');
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let importedPoints: ImportedPoint[] = [];
      if (file.name.endsWith('.csv')) {
        importedPoints = await importCSV(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        importedPoints = await importExcel(file);
      } else {
        toast.error('Format de fichier non supporté. Veuillez utiliser CSV ou Excel.');
        return;
      }

      if (importedPoints.length > 0) {
        setPoints(importedPoints);
        setCoordinateErrors({});
        toast.success(`${importedPoints.length} points importés avec succés!`);
      } else {
        toast.error('Aucune donnée valide trouvée dans le fichier.');
      }
    } catch (error) {
      
      toast.error('Erreur lors de limportation du fichier.');
    } finally {
      event.target.value = '';
    }
  };

  const detectCsvDelimiter = (line: string) => {
    const tab = (line.match(/\t/g) || []).length;
    const comma = (line.match(/,/g) || []).length;
    const semi = (line.match(/;/g) || []).length;
    if (tab > 0) return '\t';
    return semi > comma ? ';' : ',';
  };

  const normalizeHeader = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const normalizeNumberCell = (value: string) => value.trim().replace(',', '.');

  const normalizeSystem = (value?: string): CoordinateSystem => {
    const upper = (value || '').trim().toUpperCase();
    return ['WGS84', 'UTM', 'LAMBERT', 'MERCATOR'].includes(upper)
      ? (upper as CoordinateSystem)
      : coordinateSystem;
  };

  const importCSV = (file: File): Promise<ImportedPoint[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result;
          if (typeof content !== 'string') {
            reject(new Error('Le contenu du fichier est invalide'));
            return;
          }

          const lines = content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (!lines.length) {
            resolve([]);
            return;
          }

          const delimiter = detectCsvDelimiter(lines[0]);
          const rows = lines.map((line) =>
            line
              .split(delimiter)
              .map((v) => v.trim().replace(/"/g, '')),
          );
          const header = rows[0].map(normalizeHeader);
          const hasHeader =
            header.includes('x') ||
            header.includes('y') ||
            header.includes('easting') ||
            header.includes('northing');
          const headerIndex = (keys: string[]) =>
            keys
              .map((key) => header.indexOf(key))
              .find((idx) => idx !== -1) ?? -1;
          const idxId = hasHeader ? headerIndex(['id', 'point', 'numero', 'num']) : 0;
          const idxX = hasHeader ? headerIndex(['x', 'easting']) : 1;
          const idxY = hasHeader ? headerIndex(['y', 'northing']) : 2;
          const idxZ = hasHeader ? headerIndex(['z', 'alt', 'altitude', 'elevation']) : 3;
          const idxSystem = hasHeader ? headerIndex(['system', 'sys', 'crs']) : 4;
          const idxZone = hasHeader ? headerIndex(['zone', 'fuseau', 'utmzone']) : 5;
          const idxHem = hasHeader ? headerIndex(['hemisphere', 'hemispher', 'hemi']) : 6;
          const start = hasHeader ? 1 : 0;

          const points: ImportedPoint[] = [];
          for (let i = start; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 3) continue;

            if (!hasHeader && row.length < 5) {
              const x = normalizeNumberCell(String(row[0] ?? ''));
              const y = normalizeNumberCell(String(row[1] ?? ''));
              const z = normalizeNumberCell(String(row[2] ?? '0'));
              if (!x || !y) continue;
              points.push({
                id: `point-${points.length + 1}`,
                x,
                y,
                z: z || '0',
                system: coordinateSystem,
                zone: coordinateSystem === 'UTM' ? utmZone : undefined,
                hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined,
              });
              continue;
            }

            const rawX = row[idxX] ?? row[1] ?? '';
            const rawY = row[idxY] ?? row[2] ?? '';
            const rawZ = row[idxZ] ?? row[3] ?? '0';
            const x = normalizeNumberCell(String(rawX));
            const y = normalizeNumberCell(String(rawY));
            const z = normalizeNumberCell(String(rawZ || '0'));
            if (!x || !y) continue;

            const rawSystem = row[idxSystem] ?? row[4];
            const system = normalizeSystem(rawSystem);
            const rawZone = row[idxZone] ?? row[5];
            const parsedZone = parseInt(String(rawZone ?? ''), 10);
            const zone =
              system === 'UTM'
                ? Number.isFinite(parsedZone)
                  ? parsedZone
                  : utmZone
                : undefined;
            const rawHem = row[idxHem] ?? row[6];
            const hemi = String(rawHem || '').trim().toUpperCase();
            const hemisphere =
              system === 'UTM'
                ? hemi === 'N'
                  ? 'N'
                  : utmHemisphere
                : undefined;

            const idValue = hasHeader
              ? idxId !== -1
                ? row[idxId]
                : undefined
              : row.length >= 5
                ? row[0]
                : undefined;
            points.push({
              id:
                idValue != null && String(idValue).trim() !== ''
                  ? String(idValue)
                  : `point-${i}`,
              x,
              y,
              z: z || '0',
              system,
              zone,
              hemisphere,
            });
          }
          resolve(points);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const importExcel = async (file: File): Promise<ImportedPoint[]> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const headerRow = (data[0] as any[]) || [];
      const header = headerRow.map((value) => normalizeHeader(String(value ?? '')));
      const hasHeader =
        header.includes('x') ||
        header.includes('y') ||
        header.includes('easting') ||
        header.includes('northing');
      const headerIndex = (keys: string[]) =>
        keys
          .map((key) => header.indexOf(key))
          .find((idx) => idx !== -1) ?? -1;
      const idxId = hasHeader ? headerIndex(['id', 'point', 'numero', 'num']) : 0;
      const idxX = hasHeader ? headerIndex(['x', 'easting']) : 1;
      const idxY = hasHeader ? headerIndex(['y', 'northing']) : 2;
      const idxZ = hasHeader ? headerIndex(['z', 'alt', 'altitude', 'elevation']) : 3;
      const idxSystem = hasHeader ? headerIndex(['system', 'sys', 'crs']) : 4;
      const idxZone = hasHeader ? headerIndex(['zone', 'fuseau', 'utmzone']) : 5;
      const idxHem = hasHeader ? headerIndex(['hemisphere', 'hemispher', 'hemi']) : 6;
      const start = hasHeader ? 1 : 0;

      const points: ImportedPoint[] = [];
      for (let i = start; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 3) continue;

        if (!hasHeader && row.length < 5) {
          const x = normalizeNumberCell(String(row[0] ?? ''));
          const y = normalizeNumberCell(String(row[1] ?? ''));
          const z = normalizeNumberCell(String(row[2] ?? '0'));
          if (!x || !y) continue;
          points.push({
            id: `point-${points.length + 1}`,
            x,
            y,
            z: z || '0',
            system: coordinateSystem,
            zone: coordinateSystem === 'UTM' ? utmZone : undefined,
            hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined,
          });
          continue;
        }

        const rawX = row[idxX] ?? row[1] ?? '';
        const rawY = row[idxY] ?? row[2] ?? '';
        const rawZ = row[idxZ] ?? row[3] ?? '0';
        const x = normalizeNumberCell(String(rawX));
        const y = normalizeNumberCell(String(rawY));
        const z = normalizeNumberCell(String(rawZ || '0'));
        if (!x || !y) continue;

        const rawSystem = row[idxSystem] ?? row[4];
        const system = normalizeSystem(rawSystem);
        const rawZone = row[idxZone] ?? row[5];
        const parsedZone = parseInt(String(rawZone ?? ''), 10);
        const zone =
          system === 'UTM'
            ? Number.isFinite(parsedZone)
              ? parsedZone
              : utmZone
            : undefined;
        const rawHem = row[idxHem] ?? row[6];
        const hemi = String(rawHem || '').trim().toUpperCase();
        const hemisphere =
          system === 'UTM'
            ? hemi === 'N'
              ? 'N'
              : utmHemisphere
            : undefined;

        const idValue = hasHeader
          ? idxId !== -1
            ? row[idxId]
            : undefined
          : row.length >= 5
            ? row[0]
            : undefined;
        points.push({
          id:
            idValue != null && String(idValue).trim() !== ''
              ? String(idValue)
              : `point-${i}`,
          x,
          y,
          z: z || '0',
          system,
          zone,
          hemisphere,
        });
      }
      return points;
    } catch (error) {
      
      throw error;
    }
  };

  proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
  proj4.defs('EPSG:30591', '+proj=lcc +lat_1=36.76666666666667 +lat_2=37.25 +lat_0=36.5 +lon_0=2.5 +x_0=500000 +y_0=300000 +ellps=clrk80ign +units=m +no_defs');
  proj4.defs('EPSG:30592', '+proj=lcc +lat_1=32.5 +lat_2=35.16666666666666 +lat_0=33.3 +lon_0=2.7 +x_0=500000 +y_0=300000 +ellps=clrk80ign +units=m +no_defs');

  const handleSelect = async (sub: SubstanceWithPriority) => {
    if (!idDemande) {
      toast.error('ID de demande introuvable');
      return;
    }

    setIsLoading(true);
    const isSelected = selectedIds.includes(sub.id_sub);

    try {
      if (isSelected) {
        await axios.delete(`${apiURL}/api/substances/demande/${idDemande}/${sub.id_sub}`);
        setSelectedSubstances((prev) => prev.filter((s) => s.id_sub !== sub.id_sub));
        setSelectedIds((prev) => prev.filter((id) => id !== sub.id_sub));
      } else {
        const response = await axios.post(`${apiURL}/api/substances/demande/${idDemande}`, {
          id_substance: sub.id_sub,
          priorite: selectedPriority,
        });
        const newSubstance: SubstanceWithPriority = {
          id_sub: sub.id_sub,
          nom_subFR: sub.nom_subFR,
          nom_subAR: sub.nom_subAR,
          categorie_sub: sub.categorie_sub,
          priorite: selectedPriority,
        };
        setSelectedSubstances((prev) => [...prev, newSubstance]);
        setSelectedIds((prev) => [...prev, sub.id_sub]);
      }
    } catch (err) {
      
      toast.error('Erreur lors de la mise a jour de la sélection');
    } finally {
      setIsLoading(false);
    }
  };

  const changePriority = async (id_sub: number, newPriority: 'principale' | 'secondaire') => {
    if (!idDemande) {
      toast.error('ID de demande introuvable');
      return;
    }

    try {
      await axios.delete(`${apiURL}/api/substances/demande/${idDemande}/${id_sub}`);
      await axios.post(`${apiURL}/api/substances/demande/${idDemande}`, {
        id_substance: id_sub,
        priorite: newPriority,
      });
      setSelectedSubstances((prev) =>
        prev.map((sub) => (sub.id_sub === id_sub ? { ...sub, priorite: newPriority } : sub))
      );
    } catch (err) {
      toast.error('Erreur lors du changement de priorité');
    }
  };

  const formatSubstanceLabel = (sub: SubstanceWithPriority) =>
    sub.nom_subAR ? `${sub.nom_subAR} (${sub.nom_subFR || sub.nom_subAR})` : sub.nom_subFR;

  const upsertSelectedSubstance = (id_sub: number, priorite: 'principale' | 'secondaire') => {
    const base =
      allSubstances.find((s) => s.id_sub === id_sub) ||
      selectedSubstances.find((s) => s.id_sub === id_sub);
    if (!base) return;
    setSelectedSubstances((prev) => {
      const exists = prev.find((s) => s.id_sub === id_sub);
      if (exists) {
        return prev.map((s) => (s.id_sub === id_sub ? { ...s, priorite } : s));
      }
      return [...prev, { ...base, priorite }];
    });
    setSelectedIds((prev) => (prev.includes(id_sub) ? prev : [...prev, id_sub]));
  };

  const removeSelectedSubstance = (id_sub: number) => {
    setSelectedSubstances((prev) => prev.filter((s) => s.id_sub !== id_sub));
    setSelectedIds((prev) => prev.filter((id) => id !== id_sub));
  };

  const handlePrincipalSelect = async (id_sub: number) => {
    if (!idDemande) {
      toast.error('ID de demande introuvable');
      return;
    }
    if (principalSubstanceId === id_sub) return;

    setIsLoading(true);
    try {
      if (principalSubstanceId && principalSubstanceId !== id_sub) {
        await axios.delete(
          `${apiURL}/api/substances/demande/${idDemande}/${principalSubstanceId}`,
        );
        removeSelectedSubstance(principalSubstanceId);
        setSecondaryRows((prev) => prev.filter((row) => row.substanceId !== principalSubstanceId));
      }

      if (selectedIds.includes(id_sub)) {
        await axios.delete(`${apiURL}/api/substances/demande/${idDemande}/${id_sub}`);
        removeSelectedSubstance(id_sub);
      }

      await axios.post(`${apiURL}/api/substances/demande/${idDemande}`, {
        id_substance: id_sub,
        priorite: 'principale',
      });
      upsertSelectedSubstance(id_sub, 'principale');
      setPrincipalSubstanceId(id_sub);
      setSecondaryRows((prev) =>
        prev.filter(
          (row) =>
            row.substanceId !== id_sub &&
            (principalSubstanceId == null || row.substanceId !== principalSubstanceId),
        ),
      );
    } catch (err) {
      toast.error('Erreur lors de la mise à jour de la substance principale');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrincipalChange = (value: string) => {
    const nextId = Number(value);
    if (!Number.isFinite(nextId)) return;
    handlePrincipalSelect(nextId);
  };

  const addSecondaryRow = () => {
    setSecondaryRows((prev) => [...prev, createSecondaryRow()]);
  };

  const removeSecondaryRow = async (rowId: string) => {
    const row = secondaryRows.find((item) => item.id === rowId);
    if (!row) return;
    if (!idDemande) {
      toast.error('ID de demande introuvable');
      return;
    }

    if (!row.substanceId) {
      setSecondaryRows((prev) => prev.filter((item) => item.id !== rowId));
      return;
    }

    setIsLoading(true);
    try {
      await axios.delete(`${apiURL}/api/substances/demande/${idDemande}/${row.substanceId}`);
      removeSelectedSubstance(row.substanceId);
      setSecondaryRows((prev) => prev.filter((item) => item.id !== rowId));
    } catch (err) {
      toast.error('Erreur lors de la mise a jour des substances secondaires');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecondaryRowChange = async (rowId: string, value: string) => {
    if (!idDemande) {
      toast.error('ID de demande introuvable');
      return;
    }

    const nextId = value ? Number(value) : null;
    if (nextId != null && !Number.isFinite(nextId)) return;
    if (nextId != null && principalSubstanceId === nextId) return;

    const row = secondaryRows.find((item) => item.id === rowId);
    const currentId = row?.substanceId ?? null;
    if (currentId === nextId) return;

    setIsLoading(true);
    try {
      if (currentId) {
        await axios.delete(`${apiURL}/api/substances/demande/${idDemande}/${currentId}`);
        removeSelectedSubstance(currentId);
      }
      if (nextId) {
        await axios.post(`${apiURL}/api/substances/demande/${idDemande}`, {
          id_substance: nextId,
          priorite: 'secondaire',
        });
        upsertSelectedSubstance(nextId, 'secondaire');
      }
      setSecondaryRows((prev) =>
        prev.map((item) =>
          item.id === rowId ? { ...item, substanceId: nextId ?? null } : item,
        ),
      );
    } catch (err) {
      toast.error('Erreur lors de la mise a jour des substances secondaires');
    } finally {
      setIsLoading(false);
    }
  };

  const isChecked = (id: number) => selectedIds.includes(id);

  const addPoint = useCallback(() => {
    const newPoint = {
      id: generateId(),
      x: '',
      y: '',
      z: '0',
      system: coordinateSystem,
      zone: coordinateSystem === 'UTM' ? utmZone : undefined,
      hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined,
    };
    setPoints((prev) => [...prev, newPoint]);
    return newPoint;
  }, [coordinateSystem, utmZone, utmHemisphere]);

  const removeCoordinateRow = (index: number) => {
    const newCoords = [...points];
    newCoords.splice(index, 1);
    setPoints(newCoords);
    const newErrors = { ...coordinateErrors };
    Object.keys(newErrors).forEach((key) => {
      if (key.includes(`-${index}`)) delete newErrors[key];
    });
    setCoordinateErrors(newErrors);
  };

  const swapCoordinateErrors = (from: number, to: number) => {
    setCoordinateErrors((prev) => {
      const next = { ...prev };
      ['x', 'y'].forEach((field) => {
        const fromKey = `${field}-${from}`;
        const toKey = `${field}-${to}`;
        const fromVal = next[fromKey];
        const toVal = next[toKey];
        if (fromVal === undefined && toVal === undefined) return;
        if (toVal === undefined) {
          delete next[fromKey];
        } else {
          next[fromKey] = toVal;
        }
        if (fromVal === undefined) {
          delete next[toKey];
        } else {
          next[toKey] = fromVal;
        }
      });
      return next;
    });
  };

  const moveCoordinateRow = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= points.length) return;
    setPoints((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    swapCoordinateErrors(index, target);
  };

  const handleCoordinateChange = (index: number, field: keyof Point, value: string) => {
    if (field === 'x' || field === 'y') {
      if (!validateCoordinate(value, field, coordinateSystem)) {
        setCoordinateErrors((prev) => ({
          ...prev,
          [`${field}-${index}`]: `Coordonnée ${field.toUpperCase()} invalide pour le systéme ${coordinateSystem}`,
        }));
      } else {
        const newErrors = { ...coordinateErrors };
        delete newErrors[`${field}-${index}`];
        setCoordinateErrors(newErrors);
      }
    }

    const newCoords = [...points];
    (newCoords[index][field] as any) = value;
    setPoints(newCoords);
  };

  const handlePointZoneChange = (index: number, value: string) => {
    const zone = value ? parseInt(value, 10) : undefined;
    setPoints((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = {
        ...current,
        system: 'UTM',
        zone,
        hemisphere: current.hemisphere ?? utmHemisphere,
      };
      return next;
    });
  };

  const persistDemandeSnapshot = async () => {
    if (!idDemande || !apiURL) return;
    if (!hasCompleteZones) return;
    const communeIds = normalizedZones.map((zone) => zone.communeId);
    const firstZone = normalizedZones[0];
    const demandeData = {
      id_wilaya: firstZone?.wilayaId ?? null,
      id_daira: firstZone?.dairaId ?? null,
      id_commune: firstZone?.communeId ?? null,
      communeIds: communeIds.length > 0 ? communeIds : undefined,
      zones: normalizedZones.map((zone) => ({
        wilayaId: zone.wilayaId,
        dairaId: zone.dairaId,
        communeId: zone.communeId,
      })),
      lieu_ditFR: lieuDitFr,
      lieu_ditAR: lieuDitAr,
      statut_juridique_terrain: statutJuridique,
      occupant_terrain_legal: occupantLegal,
      description_travaux: travaux,
      duree_travaux_estimee: dureeTravaux,
    };
    await axios.put(`${apiURL}/demandes/${idDemande}`, demandeData);
  };



  const handleNext = async () => {
    if (!idProc || !idDemande) {
      toast.error('ID de proc?dure ou de demande introuvable');
      return;
    }

    const superficieDecl =
      superficieDeclaree &&
      superficieDeclaree.trim() !== '' &&
      !isNaN(Number(superficieDeclaree)) &&
      Number(superficieDeclaree) > 0;
    if (!hasCompleteZones || !superficieDecl || !isFormComplete) {
      toast.error('Veuillez remplir tous les champs obligatoires (Wilaya, Da?ra, Commune, Superficie d?clar?e)');
      return;
    }

    setIsLoading(true);
    setSavingEtape(true);
    setEtapeMessage(null);
    setError(null);

    try {
      // Persist declared area into provisional record on Next
      try {
        await axios.post(`${apiURL}/inscription-provisoire`, {
          id_proc: idProc,
          id_demande: idDemande,
          points: [],
          superficie_declaree:
            superficieDeclaree && superficieDeclaree.trim() !== ''
              ? parseFloat(
                  superficieDeclaree
                    .replace(/[\s  ]/g, '')
                    .replace(/,/g, '.')
                )
              : undefined,
        });
      } catch (e) {
        // non-blocking for Demande save
      }

      const communeIds = normalizedZones.map((zone) => zone.communeId);
      const firstZone = normalizedZones[0];

      const demandeData = {
        id_wilaya: firstZone?.wilayaId ?? null,
        id_daira: firstZone?.dairaId ?? null,
        id_commune: firstZone?.communeId ?? null,
        communeIds: communeIds.length > 0 ? communeIds : undefined,
        zones: normalizedZones.map((zone) => ({
          wilayaId: zone.wilayaId,
          dairaId: zone.dairaId,
          communeId: zone.communeId,
        })),
        lieu_ditFR: lieuDitFr,
        lieu_ditAR: lieuDitAr,
        // Do NOT persist computed superficie here (provisional only at step 4)
        statut_juridique_terrain: statutJuridique,
        occupant_terrain_legal: occupantLegal,
        description_travaux: travaux,
        duree_travaux_estimee: dureeTravaux,
      };

      await axios.put(`${apiURL}/demandes/${idDemande}`, demandeData);

      let etapeId = 4;

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
      setSuccess('Donn?es enregistr?es avec succ?s !');
      setTimeout(() => setSuccess(null), 3000);
      router.push(`/investisseur/nouvelle_demande/step3/page3?id=${idProc}`);
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde de l'?tape");
      setEtapeMessage("Erreur lors de l'enregistrement de l'?tape.");
    } finally {
      setSavingEtape(false);
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (!idProc) {
      toast.error('ID de procédure introuvable');
      return;
    }
    router.push(`/investisseur/nouvelle_demande/step5/page5?id=${idProc}`)
  };

  const applyUtmToAllPoints = useCallback(() => {
    if (coordinateSystem !== 'UTM') return;
    setPoints((prev) =>
      prev.map((point) => ({
        ...point,
        system: 'UTM',
        zone: utmZone,
        hemisphere: utmHemisphere,
      })),
    );
  }, [coordinateSystem, utmZone, utmHemisphere]);


  // Helper components
  const UTMSettings = () => (
    <div className={styles['utm-settings']}>
      <div className={styles['form-group']}>
        <label className={styles['form-label']}>Zone UTM</label>
        <Select
          value={String(utmZone)}
          onValueChange={(value) => setUtmZone(parseInt(value, 10))}
          disabled={statutProc === 'TERMINEE'}
        >
          <SelectTrigger className={styles['form-select']}>
            <SelectValue className={styles.selectValue} placeholder="Zone UTM" />
          </SelectTrigger>
          <SelectContent className={styles.selectContent}>
            {Array.from({ length: 4 }, (_, i) => i + 29).map((zone) => (
              <SelectItem
                key={zone}
                value={String(zone)}
                className={styles.selectItem}
              >
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={styles['form-group']}>
        <label className={styles['form-label']}>Appliquer</label>
        <button
          type="button"
          className={styles['btn-apply-utm']}
          onClick={applyUtmToAllPoints}
          disabled={statutProc === 'TERMINEE'}
        >
          Appliquer a tous les points
        </button>
      </div>
    </div>
  );

  const ConversionModal = () => {
    const [conversionSettings, setConversionSettings] = useState<{
      system: CoordinateSystem;
      zone: number;
      hemisphere: 'N';
      applyToAll: boolean;
    }>({
      system: 'UTM',
      zone: utmZone,
      hemisphere: utmHemisphere,
      applyToAll: true,
    });

    const handleConvert = () => {
      try {
        const convertedPoints = points.map((point) => {
          if (conversionSettings.applyToAll) {
            return convertCoordinate(point, {
              from: point.system,
              to: conversionSettings.system,
              zone: conversionSettings.zone,
              hemisphere: conversionSettings.hemisphere,
            });
          } else {
            return convertCoordinate(point, {
              from: point.system,
              to: conversionSettings.system,
              zone: point.zone,
              hemisphere: point.hemisphere,
            });
          }
        });

        setPoints(convertedPoints);
        setCoordinateSystem(conversionSettings.system);
        if (conversionSettings.system === 'UTM') {
          setUtmZone(conversionSettings.zone);
          setUtmHemisphere(conversionSettings.hemisphere);
        }
        setShowConversionModal(false);
      toast.success(`Coordonnées converties en ${conversionSettings.system}`);
      } catch (error) {
        toast.error('Erreur lors de la conversion');
      }
    };

    return (
      <div className={styles['modal-overlay']}>
        <div className={styles['modal']}>
          <div className={styles['modal-header']}>
            <h3>Conversion de Coordonnées</h3>
            <button onClick={() => setShowConversionModal(false)} className={styles['close-btn']}>
              <FiX />
            </button>
          </div>
          <div className={styles['modal-body']}>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Systéme cible</label>
              
              <Select
                value={conversionSettings.system}
                onValueChange={(value) =>
                  setConversionSettings((prev) => ({
                    ...prev,
                    system: value as CoordinateSystem,
                  }))
                }
              >
                <SelectTrigger className={styles['form-select']}>
                  <SelectValue className={styles.selectValue} placeholder="Systeme cible" />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem className={styles.selectItem} value="WGS84">
                    WGS84 (Lat/Lon)
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="UTM">
                    UTM
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="LAMBERT">
                    Lambert
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="MERCATOR">
                    Mercator
                  </SelectItem>
                </SelectContent>
              </Select>

            </div>
            {conversionSettings.system === 'UTM' && (
              <>
                <div className={styles['form-group']}>
                  <label className={styles['form-label']}>Zone UTM</label>
                  
                  <Select
                    value={String(conversionSettings.zone)}
                    onValueChange={(value) =>
                      setConversionSettings((prev) => ({
                        ...prev,
                        zone: parseInt(value, 10),
                      }))
                    }
                  >
                    <SelectTrigger className={styles['form-select']}>
                      <SelectValue className={styles.selectValue} placeholder="Zone UTM" />
                    </SelectTrigger>
                    <SelectContent className={styles.selectContent}>
                      {Array.from({ length: 4 }, (_, i) => i + 29).map((zone) => (
                        <SelectItem
                          key={zone}
                          value={String(zone)}
                          className={styles.selectItem}
                        >
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                </div>
                <div className={styles['form-group']}>
                  <label className={styles['checkbox-label']}>
                    <input
                      type="checkbox"
                      checked={conversionSettings.applyToAll}
                      onChange={(e) => setConversionSettings((prev) => ({ ...prev, applyToAll: e.target.checked }))}
                    />
                    Appliquer é toutes les coordonnées
                  </label>
                  <small className={styles['help-text']}>Si désactivé, chaque point conservera sa zone individuelle</small>
                </div>
              </>
            )}
            <div className={styles['modal-actions']}>
              <button onClick={handleConvert} className={styles['btn-primary']}>Convertir</button>
              <button onClick={() => setShowConversionModal(false)} className={styles['btn-outline']}>Annuler</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isPageReady) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{loadingMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles['app-content']}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles['main-content']}>
          <div className={styles['breadcrumb']}>
            <span>POM</span>
            <FiChevronRight className={styles['breadcrumb-arrow']} />
            <span>Localisation & Substances</span>
          </div>
          <div className={styles['informations-container']}>
            {procedureData && (
              <ProgressStepper
                 phases={phases}
                 currentProcedureId={idProc}
                 currentEtapeId={etapeIdForRoute ?? currentStep}
                 procedurePhases={procedureData.ProcedurePhase || []}
                 procedureTypeId={procedureTypeId}
                 procedureEtapes={procedureData.ProcedureEtape || []}
               />
            )}
            <div className={styles['header-section']}>
              <h1 className={styles['page-title']}>
                <FiMapPin className={styles['title-icon']} />
                 Localisation & Substances
              </h1>
              <p className={styles['page-subtitle']}>
                Veuillez fournir les informations sur la localisation et les substances visées
              </p>
            </div>
            <div className={styles['form-grid']}>
              <div className={styles['form-column']}>
                <div className={styles['form-card']}>
                  <div className={styles['form-card-header']}>
                    <FiGlobe className={styles['card-icon']} />
                    <h3>Localisation Administrative</h3>
                  </div>
                  <div className={styles['form-card-body']}>
                    <div className={styles['zone-list']}>
                        {zoneSelections.map((zone) => {
                          const dairas = zone.wilayaId ? dairasByWilaya[zone.wilayaId] || [] : [];
                          const communes = zone.dairaId ? communesByDaira[zone.dairaId] || [] : [];
                          return (
                            <div key={zone.id} className={styles['zone-row']}>
                              <div className={styles['zone-fields']}>
                                <div className={styles['form-group']}>
                                  <label className={styles['form-label']}>
                                    <FiMapPin className={styles['input-icon']} />
                                    Wilaya
                                  </label>
                                  <Select
                                    value={zone.wilayaId || undefined}
                                    onValueChange={(value) =>
                                      handleZoneChange(zone.id, 'wilayaId', value)
                                    }
                                    disabled={statutProc === 'TERMINEE'}
                                  >
                                    <SelectTrigger className={styles['form-select']}>
                                      <SelectValue
                                        className={styles.selectValue}
                                        placeholder="Selectionner une wilaya"
                                      />
                                    </SelectTrigger>
                                    <SelectContent className={styles.selectContent}>
                                      {wilayas.map((w) => (
                                        <SelectItem
                                          key={w.id_wilaya}
                                          value={String(w.id_wilaya)}
                                          className={styles.selectItem}
                                        >
                                          {w.code_wilaya} - {w.nom_wilayaFR}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className={styles['form-group']}>
                                  <label className={styles['form-label']}>
                                    <FiMapPin className={styles['input-icon']} />
                                    Daira
                                  </label>
                                  <Select
                                    value={zone.dairaId || undefined}
                                    onValueChange={(value) =>
                                      handleZoneChange(zone.id, 'dairaId', value)
                                    }
                                    disabled={!zone.wilayaId || statutProc === 'TERMINEE'}
                                  >
                                    <SelectTrigger className={styles['form-select']}>
                                      <SelectValue
                                        className={styles.selectValue}
                                        placeholder="Selectionner une Daira"
                                      />
                                    </SelectTrigger>
                                    <SelectContent className={styles.selectContent}>
                                      {dairas.map((d) => (
                                        <SelectItem
                                          key={d.id_daira}
                                          value={String(d.id_daira)}
                                          className={styles.selectItem}
                                        >
                                          {d.code_daira} - {d.nom_dairaFR}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className={styles['form-group']}>
                                  <label className={styles['form-label']}>
                                    <FiMapPin className={styles['input-icon']} />
                                    Commune
                                  </label>
                                  <Select
                                    value={zone.communeId || undefined}
                                    onValueChange={(value) =>
                                      handleZoneChange(zone.id, 'communeId', value)
                                    }
                                    disabled={!zone.dairaId || statutProc === 'TERMINEE'}
                                  >
                                    <SelectTrigger className={styles['form-select']}>
                                      <SelectValue
                                        className={styles.selectValue}
                                        placeholder="Selectionner une commune"
                                      />
                                    </SelectTrigger>
                                    <SelectContent className={styles.selectContent}>
                                      {communes.map((c) => (
                                        <SelectItem
                                          key={c.id_commune}
                                          value={String(c.id_commune)}
                                          className={styles.selectItem}
                                        >
                                          {c.code_commune} - {c.nom_communeFR}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className={styles['zone-actions']}>
                                <button
                                  type="button"
                                  className={styles['btn-remove-row']}
                                  onClick={() => removeZoneRow(zone.id)}
                                  disabled={statutProc === 'TERMINEE' || zoneSelections.length === 1}
                                  aria-label="Supprimer cette zone"
                                >
                                  <FiX />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className={styles['btn-add-row']}
                          onClick={addZoneRow}
                          disabled={statutProc === 'TERMINEE'}
                        >
                          <FiPlus />
                          Ajouter une zone
                        </button>
                      </div>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>
                        <FiFileText className={styles['input-icon']} />
                        Lieu Dit FR
                      </label>
                      <input
                        disabled={statutProc === 'TERMINEE'}
                        type="text"
                        className={styles['form-input']}
                        value={lieuDitFr}
                        onChange={(e) => setLieuDitFr(e.target.value)}
                      />
                    </div>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>
                        <FiFileText className={styles['input-icon']} />
                        Lieu Dit AR
                      </label>
                      <input
                        disabled={statutProc === 'TERMINEE'}
                        type="text"
                        className={styles['form-input']}
                        value={lieuDitAr}
                        onChange={(e) => setLieuDitAr(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles['form-card']}>
                  <div className={styles['form-card-header']}>
                    <FiFileText className={styles['card-icon']} />
                    <h3>Statut Juridique du Terrain</h3>
                  </div>
                  <div className={styles['form-card-body']}>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>
                        <FiFileText className={styles['input-icon']} />
                        Statut Juridique
                      </label>
                      
                      <Select
                        value={statutJuridique || undefined}
                        onValueChange={(value) => setStatutJuridique(value)}
                        disabled={statutProc === 'TERMINEE'}
                      >
                        <SelectTrigger className={styles['form-select']}>
                          <SelectValue
                            className={styles.selectValue}
                            placeholder="Selectionner un statut"
                          />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          <SelectItem className={styles.selectItem} value="Domaine public">
                            Domaine public
                          </SelectItem>
                          <SelectItem
                            className={styles.selectItem}
                            value="Domaine privé de l'état"
                          >
                            Domaine privé de l'état
                          </SelectItem>
                          <SelectItem className={styles.selectItem} value="Propriété privée">
                            Propriété privée
                          </SelectItem>
                        </SelectContent>
                      </Select>

                    </div>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>
                        <FiFileText className={styles['input-icon']} />
                        Occupant Légal
                      </label>
                      <input
                        disabled={statutProc === 'TERMINEE'}
                        type="text"
                        className={styles['form-input']}
                        value={occupantLegal}
                        onChange={(e) => setOccupantLegal(e.target.value)}
                      />
                    </div>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>
                        <FiHash className={styles['input-icon']} />
                        Superficie déclarée (Ha)
                      </label>
                      <input
                        disabled={statutProc === 'TERMINEE'}
                        type="number"
                        className={styles['form-input']}
                        value={superficieDeclaree}
                        onChange={(e) => setSuperficieDeclaree(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles['form-column']}>
                <div className={styles['form-card']}>
                  <div className={styles['form-card-header']}>
                    <FiFileText className={styles['card-icon']} />
                    <h3>Substances Minérales Visées</h3>
                  </div>
                  <div className={styles['form-card-body']}>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>Substance Principale *</label>
                      
                      <Select
                        value={principalSubstanceId != null ? String(principalSubstanceId) : undefined}
                        onValueChange={handlePrincipalChange}
                        disabled={statutProc === 'TERMINEE' || !statutProc}
                      >
                        <SelectTrigger className={styles['form-select']}>
                          <SelectValue
                            className={styles.selectValue}
                            placeholder="Selectionner une substance principale"
                          />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          {allSubstances.map((sub) => (
                            <SelectItem
                              key={sub.id_sub}
                              value={String(sub.id_sub)}
                              className={styles.selectItem}
                            >
                              {formatSubstanceLabel(sub)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                    </div>

                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>Substances Secondaires (optionnel)</label>
                      <div className={styles['secondary-list']}>
                        {secondaryRows.map((row) => {
                          const usedIds = secondarySubstanceIds.filter(
                            (id) => id !== row.substanceId,
                          );
                          const options = allSubstances.filter(
                            (sub) =>
                              sub.id_sub !== principalSubstanceId &&
                              !usedIds.includes(sub.id_sub),
                          );
                          return (
                            <div key={row.id} className={styles['secondary-row']}>
                              
                              <Select
                                value={row.substanceId != null ? String(row.substanceId) : undefined}
                                onValueChange={(value) =>
                                  handleSecondaryRowChange(row.id, value)
                                }
                                disabled={statutProc === 'TERMINEE' || !statutProc}
                              >
                                <SelectTrigger className={styles['form-select']}>
                                  <SelectValue
                                    className={styles.selectValue}
                                    placeholder="Selectionner une substance"
                                  />
                                </SelectTrigger>
                                <SelectContent className={styles.selectContent}>
                                  {options.map((sub) => (
                                    <SelectItem
                                      key={sub.id_sub}
                                      value={String(sub.id_sub)}
                                      className={styles.selectItem}
                                    >
                                      {formatSubstanceLabel(sub)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <button
                                type="button"
                                className={styles['btn-remove-row']}
                                onClick={() => removeSecondaryRow(row.id)}
                                disabled={statutProc === 'TERMINEE' || !statutProc}
                                aria-label="Supprimer cette substance secondaire"
                              >
                                <FiX />
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className={styles['btn-add-row']}
                          onClick={addSecondaryRow}
                          disabled={statutProc === 'TERMINEE' || !statutProc}
                        >
                          <FiPlus />
                          Ajouter une substance secondaire
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
<div className={styles['navigation-buttons']}>
              <button
                className={`${styles['btn']} ${styles['btn-outline']}`}
                onClick={handleBack}
                disabled={isLoading}
              >
                <FiChevronLeft className={styles['btn-icon']} />
                Précédent
              </button>
              <button
                className={`${styles['btn']} ${styles['btn-primary']}`}
                onClick={handleNext}
                disabled={isLoading || isSubmitting || savingEtape || (!isFormComplete && !isStepSaved)}
              >
                {isLoading || isSubmitting ? (
                  <span className={styles['btn-loading']}>
                    <span className={styles['spinner-small']}></span>
                    {isSubmitting ? 'Soumission...' : 'Vérification...'}
                  </span>
                ) : (
                  <>
                    Suivant
                    <FiChevronRight className={styles['btn-icon']} />
                  </>
                )}
              </button>
            </div>
            <div className={styles['etapeSaveSection']}>
              {etapeMessage && <div className={styles['etapeMessage']}>{etapeMessage}</div>}
            </div>
            {showReplaceModal && (
              <ConfirmReplaceModal
                coordinates={existingCoords}
                onCancel={() => setShowReplaceModal(false)}
                onConfirm={async () => { setShowReplaceModal(false); await submitCoordinates(); }}
              />
            )}
            {showModal && summaryData && (
              <SummaryModal
                data={summaryData}
                onClose={() => {
                  setShowModal(false);
                }}
              />
            )}
            {showConversionModal && <ConversionModal />}
          </div>
        </main>
      </div>
    </div>
  );
}









