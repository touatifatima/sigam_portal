'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
  FiMapPin,
  FiPlay,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import proj4 from 'proj4';
import styles from './interactive.module.css';
import Navbar from '../../navbar/Navbar';
import Sidebar from '../../sidebar/Sidebar';
import { useViewNavigator } from '../../../src/hooks/useViewNavigator';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { cleanLocalStorageForNewDemande } from '../../../utils/cleanLocalStorage';
import type { ArcGISMapRef } from '@/components/arcgismap/ArcgisMap';

import 'react-datepicker/dist/react-datepicker.css';

const ArcGISMap = dynamic(() => import('@/components/arcgismap/ArcgisMap'), { ssr: false });

interface TypePermis {
  id: number;
  lib_type: string;
  code_type: string;
  regime: string;
  duree_initiale: number;
  nbr_renouv_max: number;
  duree_renouv: number;
  delai_renouv: number;
  superficie_max?: number | null;
}

interface PriorTitre {
  id: number;
  code_permis: string;
  type_code: string | null;
  type_lib: string | null;
  detenteur: { id_detenteur: number; nom: string | null } | null;
  communeId: number | null;
  codeNumber: string | null;
}

interface DraftPointInput {
  id: number;
  x: string;
  y: string;
}

interface DraftState {
  permis?: {
    id: number;
    code_type: string;
    lib_type: string;
    regime: string;
  };
  prior?: {
    id: number;
    code_permis: string;
    type_code?: string | null;
    detenteur_id?: number | null;
    commune_id?: number | null;
    code_number?: string | null;
  };
  apm?: {
    id: number;
    code_permis: string;
    type_code?: string | null;
    detenteur_id?: number | null;
    commune_id?: number | null;
    code_number?: string | null;
  };
  points?: { x: number; y: number }[];
  zone?: number;
  hemisphere?: 'N';
  source?: 'manual' | 'prior';
  updatedAt?: string;
}

type MapPoint = {
  id: number;
  idTitre: number;
  h: number;
  x: number;
  y: number;
  system: 'UTM';
  zone?: number;
  hemisphere?: 'N';
};

type OverlapLayerKey = 'titres' | 'perimetresSig' | 'promotion' | 'exclusions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
const DRAFT_KEY = 'interactive_demande_draft_v1';
const ALLOWED_PERMIS_CODES = new Set(['APM', 'TEM', 'TEC', 'AAM', 'AAC', 'TXM', 'TXC', 'AXW', 'AXH', 'ARO']);

const buildDefaultPoints = (): DraftPointInput[] => [
  { id: 1, x: '', y: '' },
  { id: 2, x: '', y: '' },
  { id: 3, x: '', y: '' }
];

// Nord Sahara -> WGS84 7-parameter transformation (JO 30/11/2022).
// Published parameters are WGS84 -> Nord Sahara; signs inverted for +towgs84.
const NORD_SAHARA_TOWGS84 = {
  dx: -267.407,
  dy: -47.068,
  dz: 446.357,
  rx: -0.179423,
  ry: 5.577661,
  rz: -1.277620,
  ds: 1.204866
};

const buildUtmProj = (zone: number) =>
  `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +units=m ` +
  `+k=0.9996 +x_0=500000 +y_0=0 ` +
  `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
  `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
  `+no_defs`;

const normalizeRing = (coords: [number, number][]) => {
  if (!coords.length) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return coords.slice(0, -1);
  }
  return coords;
};

const coerceUtmZone = (value: unknown, fallback: number) => {
  const zone = Number(value);
  if (Number.isFinite(zone) && zone >= 29 && zone <= 32) {
    return Math.trunc(zone);
  }
  return fallback;
};

const deriveUtmZoneFromLon = (lon: number, fallback: number) => {
  if (!Number.isFinite(lon)) return fallback;
  const zone = Math.floor((lon + 180) / 6) + 1;
  if (!Number.isFinite(zone) || zone < 29 || zone > 32) return fallback;
  return zone;
};

const isLikelyWgs84Coord = (x: number, y: number) => Math.abs(x) <= 180 && Math.abs(y) <= 90;

const areLikelyWgs84Points = (points: { x: number; y: number }[]) =>
  points.length > 0 && points.every((p) => isLikelyWgs84Coord(p.x, p.y));

const areLikelyWgs84Coords = (coords: [number, number][]) =>
  coords.length > 0 && coords.every(([x, y]) => isLikelyWgs84Coord(x, y));

const convertWgs84ToUtm = (coords: [number, number][], zone: number) =>
  coords.map(([lon, lat]) => {
    const [x, y] = proj4('EPSG:4326', buildUtmProj(zone), [lon, lat]);
    return [x, y] as [number, number];
  });

export default function InteractiveDemandePage() {
  const router = useRouter();
  const { currentView, navigateTo } = useViewNavigator('demande-interactive');
  const { auth } = useAuthStore();
  const mapRef = useRef<ArcGISMapRef | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [permisOptions, setPermisOptions] = useState<TypePermis[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [selectedPermisId, setSelectedPermisId] = useState<number | ''>('');
  const [selectedPermis, setSelectedPermis] = useState<TypePermis | null>(null);

  const [dateSoumission, setDateSoumission] = useState<Date | null>(new Date());
  const [submitting, setSubmitting] = useState(false);

  const [priorModalOpen, setPriorModalOpen] = useState(false);
  const [priorLoading, setPriorLoading] = useState(false);
  const [priorError, setPriorError] = useState<string | null>(null);
  const [priorSearch, setPriorSearch] = useState('');
  const [priorTitres, setPriorTitres] = useState<PriorTitre[]>([]);
  const [selectedPrior, setSelectedPrior] = useState<PriorTitre | null>(null);
  const [apmTitres, setApmTitres] = useState<PriorTitre[]>([]);
  const [selectedApm, setSelectedApm] = useState<PriorTitre | null>(null);
  const [temFromApm, setTemFromApm] = useState<'yes' | 'no' | null>(null);

  const [searchPermisCode, setSearchPermisCode] = useState('');

  const [coordModalOpen, setCoordModalOpen] = useState(false);
  const [coordSource, setCoordSource] = useState<'manual' | 'prior' | null>(null);
  const [draftPoints, setDraftPoints] = useState<DraftPointInput[]>(buildDefaultPoints());
  const [draftZone, setDraftZone] = useState<number>(31);
  const [draftHemisphere, setDraftHemisphere] = useState<'N'>('N');
  const [coordError, setCoordError] = useState<string | null>(null);

  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [superficie, setSuperficie] = useState(0);
  const [hasValidatedPerimeter, setHasValidatedPerimeter] = useState(false);

  const [overlapTitles, setOverlapTitles] = useState<any[]>([]);
  const [isCheckingOverlaps, setIsCheckingOverlaps] = useState(false);
  const [overlapDetected, setOverlapDetected] = useState(false);
  const [hasOverlapCheck, setHasOverlapCheck] = useState(false);
  const [showAllOverlaps, setShowAllOverlaps] = useState(false);

  const effectivePermis = useMemo(() => {
    if (selectedPermis) return selectedPermis;
    if (selectedPermisId === '') return null;
    return permisOptions.find((p) => p.id === selectedPermisId) ?? null;
  }, [permisOptions, selectedPermis, selectedPermisId]);

  const currentPermisCode = (effectivePermis?.code_type || '').toUpperCase();
  const isTEM = currentPermisCode === 'TEM';
  const isTX = currentPermisCode.startsWith('TX');
  const isTXM = currentPermisCode === 'TXM';
  const isTXC = currentPermisCode === 'TXC';

  const loadDraft = (): DraftState | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DraftState;
    } catch {
      return null;
    }
  };

  const saveDraft = (next: DraftState) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {}
  };

  const clearDraft = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const applyDraft = (draft: DraftState) => {
    if (draft.permis) {
      setSelectedPermisId(draft.permis.id);
      setSelectedPermis(null);
    }
    if (draft.zone) setDraftZone(draft.zone);
    if (draft.hemisphere) setDraftHemisphere(draft.hemisphere);
    if (draft.points && draft.points.length >= 3) {
      const points = draft.points.map((p, idx) => ({
        id: idx + 1,
        idTitre: 0,
        h: draft.zone || 31,
        x: p.x,
        y: p.y,
        system: 'UTM' as const,
        zone: draft.zone || 31,
        hemisphere: draft.hemisphere || 'N'
      }));
      setMapPoints(points);
      setHasValidatedPerimeter(true);
    }
    if (draft.source) setCoordSource(draft.source);
  };

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      applyDraft(draft);
    }
  }, []);

  useEffect(() => {
    if (!apiBase) {
      setPageError('Configuration API manquante.');
      return;
    }
    const controller = new AbortController();
    setOptionsLoading(true);
    axios
      .get<TypePermis[]>(`${apiBase}/type-permis`, {
        withCredentials: true,
        signal: controller.signal
      })
      .then((res) => {
        const list = res.data ?? [];
        setPermisOptions(
          list.filter((permis) => ALLOWED_PERMIS_CODES.has((permis.code_type || '').trim().toUpperCase())),
        );
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error('Failed to load permit types', err);
        setPageError('Impossible de charger la liste des types de permis.');
      })
      .finally(() => {
        setOptionsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const resetDraftState = () => {
    setSelectedPermisId('');
    setSelectedPermis(null);
    setSelectedPrior(null);
    setSelectedApm(null);
    setTemFromApm(null);
    setDraftPoints(buildDefaultPoints());
    setDraftZone(31);
    setDraftHemisphere('N');
    setCoordSource(null);
    setCoordError(null);
    setMapPoints([]);
    setSuperficie(0);
    setHasValidatedPerimeter(false);
    setOverlapTitles([]);
    setOverlapDetected(false);
    setHasOverlapCheck(false);
    setShowAllOverlaps(false);
    clearDraft();
  };

  const openManualEntry = (resetPoints: boolean) => {
    setCoordSource('manual');
    if (resetPoints) {
      setDraftPoints(buildDefaultPoints());
    }
    setCoordError(null);
    setCoordModalOpen(true);
  };

  const handlePermisChange = async (value: string) => {
    resetDraftState();
    if (!value) {
      setSelectedPermisId('');
      setSelectedPermis(null);
      return;
    }

    const permisId = Number(value);
    if (Number.isNaN(permisId)) {
      toast.error('Identifiant de permis invalide.');
      return;
    }

    setSelectedPermisId(permisId);
    setDetailsLoading(true);
    try {
      const res = await axios.get<TypePermis>(`${apiBase}/type-permis/${permisId}`, { withCredentials: true });
      setSelectedPermis(res.data ?? null);
      const code = (res.data?.code_type || '').toUpperCase();
      if (code === 'APM' || code === 'TEC' || (!code.startsWith('TX') && code !== 'TEM')) {
        openManualEntry(true);
      } else {
        await openPriorModal(code);
      }
    } catch (err) {
      console.error('Failed to load permit details', err);
      toast.error('Impossible de charger les details du type de permis.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const openPriorModal = async (code: string) => {
    if (!apiBase) {
      toast.error('Configuration API manquante.');
      return;
    }
    setPriorError(null);
    setPriorSearch('');
    setPriorTitres([]);
    setApmTitres([]);
    setSelectedPrior(null);
    setSelectedApm(null);
    setTemFromApm(null);
    setPriorModalOpen(true);
    setPriorLoading(true);

    try {
      const { data } = await axios.get<PriorTitre[]>(`${apiBase}/api/permis/prior-titres`, {
        withCredentials: true
      });
      const list = data || [];
      setPriorTitres(list);
      setApmTitres(list.filter((t) => (t.type_code || '').toUpperCase() === 'APM'));
      if (!list.length) {
        setPriorError('Aucun titre retourne par le serveur.');
      }
      if (code === 'TEM') {
        setTemFromApm('yes');
      }
    } catch (err) {
      console.error('Erreur chargement titres anterieurs', err);
      setPriorError('Impossible de charger les titres precedents.');
    } finally {
      setPriorLoading(false);
    }
  };

  const filteredPriorTitres = useMemo(() => {
    const q = priorSearch.trim().toLowerCase();
    const sourceList = priorTitres.filter((t) => {
      const ty = (t.type_code || '').toUpperCase();
      if (isTXM) return ty === 'TEM';
      if (isTXC) return ty === 'TEC';
      return true;
    });
    if (!q) return sourceList;
    return sourceList.filter((t) => {
      const det = (t.detenteur?.nom || '').toLowerCase();
      const code = (t.code_permis || '').toLowerCase();
      const type = (t.type_code || '').toLowerCase();
      const number = (t.codeNumber || '').toLowerCase();
      return det.includes(q) || code.includes(q) || type.includes(q) || number.includes(q);
    });
  }, [priorSearch, priorTitres, isTXM, isTXC]);

  const filteredApmTitres = useMemo(() => {
    const q = priorSearch.trim().toLowerCase();
    if (!q) return apmTitres;
    return apmTitres.filter((t) => {
      const det = (t.detenteur?.nom || '').toLowerCase();
      const code = (t.code_permis || '').toLowerCase();
      const number = (t.codeNumber || '').toLowerCase();
      return det.includes(q) || code.includes(q) || number.includes(q);
    });
  }, [apmTitres, priorSearch]);

  const fillDraftFromCoords = (coords: [number, number][], zone?: number, hemisphere?: 'N') => {
    const cleaned = normalizeRing(coords)
      .map((c, idx) => ({ id: idx + 1, x: String(c[0]), y: String(c[1]) }));
    setDraftPoints(cleaned.length >= 3 ? cleaned : buildDefaultPoints());
    if (zone) setDraftZone(zone);
    if (hemisphere) setDraftHemisphere(hemisphere);
    setCoordModalOpen(true);
  };

  const fetchPriorCoords = async (prior: PriorTitre | null) => {
    if (!prior?.code_permis) {
      toast.error('Code du permis introuvable.');
      return;
    }
    try {
      const res = await axios.get(`${apiBase}/coordinates/permis-code/${encodeURIComponent(prior.code_permis)}`);
      const polygons = Array.isArray(res.data?.polygons) ? res.data.polygons : [];
      const available = polygons.filter((p: any) => Array.isArray(p.coordinates) && p.coordinates.length >= 3);
      if (!available.length) {
        toast.warning('Aucune coordonnee disponible pour ce permis.');
        return;
      }
      const latest = available
        .slice()
        .sort((a: any, b: any) => (Number(b.idProc) || 0) - (Number(a.idProc) || 0))[0];
      const rawCoords = latest.coordinates.map((c: any) => [Number(c[0]), Number(c[1])] as [number, number]);
      const isWgs = Boolean(latest.isWGS) || areLikelyWgs84Coords(rawCoords);
      let zone = coerceUtmZone(latest.zone, draftZone);
      let coords = rawCoords;
      if (isWgs) {
        const derivedZone = deriveUtmZoneFromLon(rawCoords[0]?.[0], draftZone);
        zone = coerceUtmZone(latest.zone, derivedZone);
        coords = convertWgs84ToUtm(rawCoords, zone);
        toast.info(`Coordonnees WGS84 detectees, conversion en UTM zone ${zone}.`);
      }
      const hemisphere: 'N' = 'N';
      setCoordSource('prior');
      fillDraftFromCoords(coords, zone, hemisphere);
    } catch (err) {
      console.error('Erreur chargement coordonnees', err);
      toast.error('Impossible de charger les coordonnees du permis selectionne.');
    }
  };

  const updateDraftPoint = (id: number, field: 'x' | 'y', value: string) => {
    setDraftPoints((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const addDraftPoint = () => {
    setDraftPoints((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((p) => p.id)) + 1 : 1;
      return [...prev, { id: nextId, x: '', y: '' }];
    });
  };

  const removeDraftPoint = (id: number) => {
    setDraftPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const moveDraftPoint = (fromIndex: number, direction: -1 | 1) => {
    setDraftPoints((prev) => {
      const next = [...prev];
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= next.length) return prev;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const parseDraftPoints = () => {
    const parsed = draftPoints
      .map((p) => ({
        id: p.id,
        x: Number(p.x),
        y: Number(p.y)
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    return parsed;
  };

  const computeAreaHa = (coords: { x: number; y: number }[]) => {
    if (coords.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < coords.length; i += 1) {
      const next = coords[(i + 1) % coords.length];
      const current = coords[i];
      sum += current.x * next.y - next.x * current.y;
    }
    const areaM2 = Math.abs(sum) / 2;
    return areaM2 / 10000;
  };

  const handleValidatePerimeter = () => {
    setCoordError(null);
    let parsed = parseDraftPoints();
    if (parsed.length < 3) {
      setCoordError('Le polygone doit contenir au moins 3 points valides.');
      return;
    }

    let zone = draftZone;
    let hemisphere = draftHemisphere;
    if (areLikelyWgs84Points(parsed)) {
      const derivedZone = deriveUtmZoneFromLon(parsed[0]?.x, draftZone);
      zone = coerceUtmZone(zone, derivedZone);
      const convertedCoords = convertWgs84ToUtm(
        parsed.map((p) => [p.x, p.y]),
        zone,
      );
      parsed = parsed.map((p, idx) => ({
        ...p,
        x: convertedCoords[idx]?.[0] ?? p.x,
        y: convertedCoords[idx]?.[1] ?? p.y,
      }));
      hemisphere = 'N';
      setDraftZone(zone);
      setDraftHemisphere('N');
      setDraftPoints(parsed.map((p) => ({ id: p.id, x: String(p.x), y: String(p.y) })));
      toast.info(`Coordonnees WGS84 detectees, conversion en UTM zone ${zone}.`);
    }
    const mapPts: MapPoint[] = parsed.map((p, index) => ({
      id: index + 1,
      idTitre: 0,
      h: zone,
      x: p.x,
      y: p.y,
      system: 'UTM',
      zone,
      hemisphere
    }));

    setMapPoints(mapPts);
    setHasValidatedPerimeter(true);
    setOverlapTitles([]);
    setHasOverlapCheck(false);
    setOverlapDetected(false);
    setShowAllOverlaps(false);
    const area = computeAreaHa(parsed);
    setSuperficie(area);

    saveDraft({
      permis: effectivePermis
        ? {
            id: effectivePermis.id,
            code_type: effectivePermis.code_type,
            lib_type: effectivePermis.lib_type,
            regime: effectivePermis.regime
          }
        : undefined,
      prior: selectedPrior
        ? {
            id: selectedPrior.id,
            code_permis: selectedPrior.code_permis,
            type_code: selectedPrior.type_code,
            detenteur_id: selectedPrior.detenteur?.id_detenteur ?? null,
            commune_id: selectedPrior.communeId ?? null,
            code_number: selectedPrior.codeNumber ?? null
          }
        : undefined,
      apm: selectedApm
        ? {
            id: selectedApm.id,
            code_permis: selectedApm.code_permis,
            type_code: selectedApm.type_code,
            detenteur_id: selectedApm.detenteur?.id_detenteur ?? null,
            commune_id: selectedApm.communeId ?? null,
            code_number: selectedApm.codeNumber ?? null
          }
        : undefined,
      points: parsed.map((p) => ({ x: p.x, y: p.y })),
      zone,
      hemisphere,
      source: coordSource ?? 'manual',
      updatedAt: new Date().toISOString()
    });

    setCoordModalOpen(false);
  };

  const getSelectedOverlapLayers = () => {
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
    } catch {}

    return defaults;
  };

  const checkOverlaps = async () => {
    if (!mapPoints.length) {
      toast.warning('Veuillez valider un perimetre avant la verification.');
      return;
    }
    const selectedLayers = getSelectedOverlapLayers();
    const anyLayerActive = Object.values(selectedLayers).some(Boolean);
    if (!anyLayerActive) {
      toast.warning('Veuillez selectionner au moins une couche.');
      setOverlapDetected(false);
      setOverlapTitles([]);
      setHasOverlapCheck(false);
      return;
    }

    setIsCheckingOverlaps(true);
    try {
      const payloadPoints = mapPoints.map((p) => ({
        x: p.x,
        y: p.y,
        system: p.system,
        zone: p.zone ?? draftZone,
        hemisphere: p.hemisphere ?? draftHemisphere,
      }));
      const res = await axios.post(
        `${apiBase}/gis/analyze-perimeter`,
        { points: payloadPoints, layers: selectedLayers },
        { withCredentials: true },
      );
      const areaHa = res.data?.areaHa;
      const overlapsRaw = Array.isArray(res.data?.overlaps) ? res.data.overlaps : [];
      const localAreaHa = computeAreaHa(mapPoints);
      const effectiveAreaHa =
        Number.isFinite(localAreaHa) && localAreaHa > 0
          ? localAreaHa
          : typeof areaHa === 'number' && !Number.isNaN(areaHa)
            ? areaHa
            : Number.isFinite(superficie) && superficie > 0
              ? superficie
              : null;
      if (effectiveAreaHa != null) {
        setSuperficie(parseFloat(effectiveAreaHa.toFixed(2)));
      }
      const baseAreaHa = effectiveAreaHa;
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

      const unique = dedupeOverlaps(overlaps);
      setOverlapTitles(unique);
      setOverlapDetected(unique.length > 0);
      setHasOverlapCheck(true);
      setShowAllOverlaps(false);
    } catch (err) {
      console.error('Overlap check failed', err);
      toast.error('Erreur lors de la verification des chevauchements.');
    } finally {
      setIsCheckingOverlaps(false);
    }
  };

  const dedupeOverlaps = (list: any[]) => {
    const seen = new Set<string>();
    return list.filter((t) => {
      const layer = String(t.layer_type ?? t.layerType ?? '');
      const key = [
        layer,
        t.id ?? '',
        t.idtitre ?? '',
        t.code ?? '',
        t.objectid ?? '',
        t.permis_code ?? '',
        t.nom ?? '',
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getOverlapLayerType = (o: any) =>
    String(o?.layer_type ?? o?.layerType ?? o?.__layerType ?? '').trim();

  const getOverlapZoomTarget = (o: any): { layerKey: OverlapLayerKey; fieldName: string; value: string } | null => {
    const layerType = getOverlapLayerType(o);
    if (layerType === 'titres') {
      if (o?.code != null) return { layerKey: 'titres', fieldName: 'code', value: String(o.code) };
      if (o?.idtitre != null) return { layerKey: 'titres', fieldName: 'idtitre', value: String(o.idtitre) };
      if (o?.objectid != null) return { layerKey: 'titres', fieldName: 'objectid', value: String(o.objectid) };
      return null;
    }
    if (layerType === 'perimetresSig') {
      if (o?.permis_code != null) return { layerKey: 'perimetresSig', fieldName: 'permis_code', value: String(o.permis_code) };
      if (o?.permisCode != null) return { layerKey: 'perimetresSig', fieldName: 'permis_code', value: String(o.permisCode) };
      if (o?.id != null) return { layerKey: 'perimetresSig', fieldName: 'id', value: String(o.id) };
      if (o?.objectid != null) return { layerKey: 'perimetresSig', fieldName: 'objectid', value: String(o.objectid) };
      return null;
    }
    if (layerType === 'promotion') {
      if (o?.objectid != null) return { layerKey: 'promotion', fieldName: 'objectid', value: String(o.objectid) };
      if (o?.idzone != null) return { layerKey: 'promotion', fieldName: 'idzone', value: String(o.idzone) };
      if (o?.nom != null) return { layerKey: 'promotion', fieldName: 'nom', value: String(o.nom) };
      return null;
    }
    if (layerType === 'exclusions') {
      if (o?.objectid != null) return { layerKey: 'exclusions', fieldName: 'objectid', value: String(o.objectid) };
      if (o?.idzone != null) return { layerKey: 'exclusions', fieldName: 'idzone', value: String(o.idzone) };
      if (o?.nom != null) return { layerKey: 'exclusions', fieldName: 'nom', value: String(o.nom) };
      return null;
    }
    return null;
  };

  const handleOverlapItemClick = async (o: any) => {
    const target = getOverlapZoomTarget(o);
    if (!target) {
      toast.info('Zoom indisponible pour cet element.');
      return;
    }
    if (!mapRef.current?.searchLayerFeature) {
      toast.error('Carte indisponible pour le zoom.');
      return;
    }
    const ok = await mapRef.current.searchLayerFeature(
      target.layerKey,
      target.fieldName,
      target.value,
    );
    if (!ok) {
      toast.warning('Polygone introuvable sur la carte.');
    }
  };

  const getOverlapLabel = (o: any) => {
    const layerType = getOverlapLayerType(o);
    const overlapAreaM =
      typeof o?.overlap_area_m2 === 'number'
        ? o.overlap_area_m2
        : typeof o?.overlap_area_ha === 'number'
          ? o.overlap_area_ha * 10000
          : null;
    const overlapText = overlapAreaM ? ` (~${overlapAreaM.toFixed(0)} m²)` : '';

    if (layerType === 'titres') {
      const typ = o.typetitre || o.codetype || 'Titre';
      const code = o.code ?? o.idtitre ?? o.objectid ?? '';
      return `Titres miniers: ${typ} ${o.codetype || ''} ${code}${overlapText}`.replace(/\s+/g, ' ').trim();
    }
    if (layerType === 'perimetresSig') {
      const code = o.permis_code ?? o.permisCode ?? '';
      const label = o.permis_type_label ?? o.permisTypeLabel ?? 'Demandes';
      return `Demandes: ${label}${code ? ` (${code})` : ''}${overlapText}`.replace(/\s+/g, ' ').trim();
    }
    if (layerType === 'promotion') {
      const name = o.nom || o.Nom || 'Promotion';
      const id = o.objectid ?? o.OBJECTID ?? '';
      return `Promotion: ${name}${id ? ` (#${id})` : ''}${overlapText}`.replace(/\s+/g, ' ').trim();
    }
    if (layerType === 'modifications') {
      const modType = o.typemodification || 'Modification';
      return `Modifications: ${modType}${overlapText}`.replace(/\s+/g, ' ').trim();
    }
    if (layerType === 'exclusions') {
      const name = o.nom || o.Nom || 'Zone d\'exclusion';
      return `Zones d'exclusion: ${name}${overlapText}`.replace(/\s+/g, ' ').trim();
    }
    return `Chevauchement${overlapText}`.trim();
  };

  const pickLatestProcedureWithCoords = (procedures: any[] = []) => {
    return procedures
      .filter((p: any) => (p.coordonnees?.length ?? 0) > 0)
      .sort((a: any, b: any) => {
        const da = new Date(b.date_debut_proc || b.createdAt || 0).getTime();
        const db = new Date(a.date_debut_proc || a.createdAt || 0).getTime();
        if (da !== db) return da - db;
        return (b.id_proc ?? 0) - (a.id_proc ?? 0);
      })[0];
  };

  const persistPriorSelection = (prior: PriorTitre) => {
    try {
      localStorage.setItem('prior_permis_id', String(prior.id));
      localStorage.setItem('prior_code_permis', prior.code_permis || '');
      if (prior.codeNumber) localStorage.setItem('prior_code_number', prior.codeNumber);
      if (prior.type_code) localStorage.setItem('prior_type_code', prior.type_code);
      if (prior.detenteur?.id_detenteur)
        localStorage.setItem('prior_detenteur_id', String(prior.detenteur.id_detenteur));
      if (prior.communeId != null)
        localStorage.setItem('prior_commune_id', String(prior.communeId));
    } catch {}
  };

  const persistApmSelection = (apm: PriorTitre) => {
    try {
      localStorage.setItem('apm_permis_id', String(apm.id));
      localStorage.setItem('apm_code_permis', apm.code_permis || '');
      if (apm.codeNumber) localStorage.setItem('apm_code_number', apm.codeNumber);
      if (apm.type_code) localStorage.setItem('apm_type_code', apm.type_code);
      if (apm.detenteur?.id_detenteur)
        localStorage.setItem('apm_detenteur_id', String(apm.detenteur.id_detenteur));
      if (apm.communeId != null)
        localStorage.setItem('apm_commune_id', String(apm.communeId));
      persistPriorSelection(apm);
    } catch {}
  };

  const startProcedure = async () => {
    if (!effectivePermis || !dateSoumission) {
      toast.warning('Selectionnez un type de permis et une date de soumission.');
      return;
    }
    if (!hasValidatedPerimeter) {
      toast.warning('Veuillez valider un perimetre avant de demarrer.');
      return;
    }
    if (!hasOverlapCheck || overlapDetected) {
      toast.warning('Veuillez verifier les chevauchements avant de demarrer.');
      return;
    }
    if (!apiBase) {
      toast.error('Configuration API manquante.');
      return;
    }

    const codeSel = (effectivePermis.code_type || '').toUpperCase();
    if (codeSel.startsWith('TX') && !selectedPrior) {
      toast.warning('Veuillez selectionner le titre precedent TEM/TEC.');
      return;
    }

    setSubmitting(true);
    try {
      cleanLocalStorageForNewDemande();
      const isExploitation = codeSel.startsWith('TX');
      const isExplorationTEM = codeSel === 'TEM';
      const isApm = codeSel === 'APM';
      const isAxw = codeSel === 'AXW';
      let id_detenteur: number | undefined = undefined;

      if (isExploitation && selectedPrior?.detenteur?.id_detenteur) {
        id_detenteur = selectedPrior.detenteur.id_detenteur;
        persistPriorSelection(selectedPrior);
      }

      if (isExplorationTEM && selectedApm?.detenteur?.id_detenteur) {
        id_detenteur = selectedApm.detenteur.id_detenteur;
        persistApmSelection(selectedApm);
      }

      let id_sourceProc: number | undefined = undefined;
      let designation_number: string | undefined = undefined;
      if (isExploitation && selectedPrior?.id) {
        designation_number = selectedPrior.codeNumber || undefined;
        try {
          const pr = await axios.get(`${apiBase}/Permisdashboard/${selectedPrior.id}`, { withCredentials: true });
          const procedures = pr.data?.procedures || [];
          const source = pickLatestProcedureWithCoords(procedures);
          if (source?.id_proc) id_sourceProc = source.id_proc;
        } catch {}
      }

      const response = await axios.post(
        `${apiBase}/demandes`,
        {
          id_typepermis: effectivePermis.id,
          objet_demande: 'Instruction initialisee',
          date_demande: dateSoumission.toISOString(),
          nom_responsable: auth.username || undefined,
          ...(id_detenteur ? { id_detenteur } : {}),
          ...(id_sourceProc ? { id_sourceProc } : {}),
          ...(designation_number ? { designation_number } : {})
        },
        { withCredentials: true },
      );

      const { procedure, code_demande: demandeCode, id_demande } = response.data ?? {};
      if (id_demande) localStorage.setItem('id_demande', String(id_demande));
      if (procedure?.id_proc) localStorage.setItem('id_proc', String(procedure.id_proc));
      localStorage.setItem('code_demande', demandeCode ?? '');
      localStorage.setItem('selected_permis', JSON.stringify(effectivePermis));
      localStorage.setItem(
        'permis_details',
        JSON.stringify({
          duree_initiale: effectivePermis.duree_initiale,
          nbr_renouv_max: effectivePermis.nbr_renouv_max,
          superficie_max: effectivePermis.superficie_max ?? null,
          duree_renouv: effectivePermis.duree_renouv
        }),
      );

      if (selectedPrior) persistPriorSelection(selectedPrior);
      if (selectedApm) persistApmSelection(selectedApm);

      if (procedure?.id_proc) {
        const points = mapPoints.map((p) => ({
          x: p.x,
          y: p.y,
          z: 0,
          system: 'UTM',
          zone: draftZone,
          hemisphere: draftHemisphere
        }));
        try {
          await axios.post(
            `${apiBase}/inscription-provisoire`,
            {
              id_proc: procedure.id_proc,
              id_demande,
              points,
              system: 'UTM',
              zone: draftZone,
              hemisphere: draftHemisphere,
              superficie_declaree: superficie
            },
            { withCredentials: true },
          );
        } catch (err) {
          console.warn('Inscription provisoire failed', err);
        }
      }

      clearDraft();

      if (procedure?.id_proc) {
        if (isExploitation) {
          const priorParam = selectedPrior?.id ? `&permisId=${selectedPrior.id}` : '';
          await router.push(`/demande_exploitation/step1/page1?id=${procedure.id_proc}${priorParam}`);
          return;
        }
        if (isExplorationTEM && selectedApm?.id) {
          await router.push(`/demande_exploration_mines/step1/page1?id=${procedure.id_proc}&permisId=${selectedApm.id}`);
          return;
        }
        if (isApm) {
          await router.push(`/demande_apm/step1/page1?id=${procedure.id_proc}`);
          return;
        }
        if (isAxw) {
          await router.push(`/demande_axw/step1/page1?id=${procedure.id_proc}`);
          return;
        }
        await router.push(`/demande/step1/page1?id=${procedure.id_proc}`);
        return;
      }
      toast.info('Demande creee, mais identifiant de procedure indisponible.');
    } catch (err) {
      console.error('Failed to create demande', err);
      toast.error('Erreur lors de la creation de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    if (!mapPoints.length) {
      toast.warning('Aucun perimetre a exporter.');
      return;
    }
    const headers = ['id', 'x', 'y', 'z', 'system', 'zone', 'hemisphere'];
    const rows = mapPoints.map((p, index) => [
      p.id ?? index + 1,
      p.x,
      p.y,
      0,
      p.system,
      p.zone ?? draftZone,
      p.hemisphere ?? draftHemisphere,
    ]);
    const csvLines = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/\"/g, '""')}"`).join(',')),
    ];
    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `perimetre-utm-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const detectCsvDelimiter = (line: string) => {
    const comma = (line.match(/,/g) || []).length;
    const semi = (line.match(/;/g) || []).length;
    return semi > comma ? ';' : ',';
  };

  const normalizeHeader = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const parseCsvValue = (value: string) =>
    value.trim().replace(/^"|"$/g, '').replace(/""/g, '"');

  const isBulkPasteText = (text: string) => {
    if (!text) return false;
    if (/[\r\n\t;]/.test(text)) return true;
    const tokens = text.trim().match(/-?\d+(?:[.,]\d+)?/g);
    return Boolean(tokens && tokens.length >= 2 && /\s/.test(text.trim()));
  };

  const normalizeNumericToken = (value: string) => value.replace(',', '.');

  const parseClipboardPoints = (text: string) => {
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let zone: number | undefined;
    const zoneMatch =
      cleaned.match(/zone\s*([0-9]{1,2})/i) || cleaned.match(/\b([0-9]{1,2})\s*[nNsS]\b/);
    if (zoneMatch) {
      const parsed = Number(zoneMatch[1]);
      if (Number.isFinite(parsed) && parsed >= 29 && parsed <= 32) {
        zone = parsed;
      }
    }

    const points: DraftPointInput[] = [];
    cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const rawTokens = line.match(/-?\d+(?:[.,]\d+)?/g) || [];
        if (rawTokens.length < 2) return;

        const tokens = rawTokens.map(normalizeNumericToken);
        let xToken = '';
        let yToken = '';

        const isLargeCoord = (value: number) =>
          Number.isFinite(value) && Math.abs(value) > 10000;

        if (tokens.length >= 4) {
          const nLast1 = Number(tokens[tokens.length - 2]);
          const nLast2 = Number(tokens[tokens.length - 1]);
          if (isLargeCoord(nLast1) && isLargeCoord(nLast2)) {
            xToken = tokens[tokens.length - 2];
            yToken = tokens[tokens.length - 1];
            const n0 = Number(tokens[0]);
            const n0IsZone = Number.isFinite(n0) && n0 >= 29 && n0 <= 32;
            if (n0IsZone && zone == null) {
              zone = n0;
            }
          }
        }

        if (!xToken && tokens.length >= 3) {
          const n0 = Number(tokens[0]);
          const n1 = Number(tokens[1]);
          const n2 = Number(tokens[2]);
          const n0IsZone = Number.isFinite(n0) && n0 >= 29 && n0 <= 32;
          const n0IsIndex = Number.isFinite(n0) && n0 >= 0 && n0 <= 1000;
          const restLarge = isLargeCoord(n1) && isLargeCoord(n2);

          if ((n0IsZone || n0IsIndex) && restLarge) {
            xToken = tokens[1];
            yToken = tokens[2];
            if (n0IsZone && zone == null) {
              zone = n0;
            }
          } else {
            xToken = tokens[0];
            yToken = tokens[1];
          }
        }

        if (!xToken) {
          xToken = tokens[0];
          yToken = tokens[1];
        }

        const xNum = Number(xToken);
        const yNum = Number(yToken);
        if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) return;
        points.push({ id: points.length + 1, x: xToken, y: yToken });
      });

    return { points, zone };
  };

  const handleCoordsPaste =
    (rowIndex: number) => (event: ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData.getData('text');
      if (!isBulkPasteText(text)) return;

      const { points, zone } = parseClipboardPoints(text);
      if (!points.length) return;

      event.preventDefault();
      setCoordSource('manual');
      setDraftPoints((prev) => {
        const next = [...prev];
        const needed = rowIndex + points.length;
        while (next.length < needed) {
          next.push({ id: next.length + 1, x: '', y: '' });
        }
        points.forEach((point, offset) => {
          const idx = rowIndex + offset;
          next[idx] = { ...next[idx], x: point.x, y: point.y };
        });
        return next.map((point, idx) => ({ ...point, id: idx + 1 }));
      });
      if (zone != null) {
        setDraftZone(zone);
      }
      setCoordError(null);
      setHasValidatedPerimeter(false);
      setMapPoints([]);
      setSuperficie(0);
      setOverlapTitles([]);
      setOverlapDetected(false);
      setHasOverlapCheck(false);
    };

  const importCsvFile = async (file: File) => {
    const content = await file.text();
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return { points: [], zone: undefined, hemisphere: undefined };

    const delimiter = detectCsvDelimiter(lines[0]);
    const rows = lines.map((line) =>
      line.split(delimiter).map((cell) => parseCsvValue(cell)),
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
    const idxZone = hasHeader ? headerIndex(['zone', 'fuseau', 'utmzone']) : 5;
    const idxHem = hasHeader ? headerIndex(['hemisphere', 'hemispher', 'hemi']) : 6;

    const start = hasHeader ? 1 : 0;
    const points: DraftPointInput[] = [];
    let zone: number | undefined;
    let hemisphere: 'N' | undefined;

    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      const rawX = row[idxX] ?? row[1] ?? '';
      const rawY = row[idxY] ?? row[2] ?? '';
      const x = rawX.replace(',', '.').trim();
      const y = rawY.replace(',', '.').trim();
      if (!x || !y) continue;

      const idValue = row[idxId] ?? `${points.length + 1}`;
      points.push({
        id: Number(idValue) || points.length + 1,
        x,
        y,
      });

      if (zone == null) {
        const rawZone = row[idxZone] ?? row[5];
        const parsedZone = Number(rawZone);
        if (Number.isFinite(parsedZone)) zone = parsedZone;
      }
      if (!hemisphere) {
        const rawHem = row[idxHem] ?? row[6];
        const hemi = String(rawHem || '').trim().toUpperCase();
        if (hemi === 'N') hemisphere = 'N';
      }
    }

    return { points, zone, hemisphere };
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { points, zone, hemisphere } = await importCsvFile(file);
      if (!points.length) {
        toast.error('Aucune coordonnee valide trouvee dans le CSV.');
        return;
      }
      setCoordSource('manual');
      setDraftPoints(points);
      if (zone != null) setDraftZone(zone);
      if (hemisphere) setDraftHemisphere(hemisphere);
      setCoordError(null);
      setHasValidatedPerimeter(false);
      setMapPoints([]);
      setSuperficie(0);
      toast.success(`${points.length} points importes avec succes.`);
    } catch (error) {
      console.error('CSV import failed', error);
      toast.error("Erreur lors de l'import CSV.");
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.breadcrumb}>
            <span>SIGAM</span>
            <FiChevronRight className={styles.breadcrumbArrow} />
            <span>Demande interactive</span>
          </div>

          <div className={styles.headerRow}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Assistant interactif de demande</h1>
              <p className={styles.subtitle}>
                Choisissez un type de permis, saisissez le perimetre et verifiez les chevauchements avant demarrage.
              </p>
            </div>
            <div className={styles.headerSearch}>
              <input
                value={searchPermisCode}
                onChange={(e) => setSearchPermisCode(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const code = searchPermisCode.trim();
                  if (!code) return;
                  if (!mapRef.current?.searchPerimetreByPermisCode || !mapRef.current?.searchTitreByCode) {
                    toast.error('Carte indisponible pour la recherche.');
                    return;
                  }
                  const ok = await mapRef.current.searchPerimetreByPermisCode(code);
                  if (!ok) {
                    const fallbackOk = await mapRef.current.searchTitreByCode(code);
                    if (!fallbackOk) toast.warning('Aucun permis trouve.');
                  }
                }}
                placeholder="Rechercher un code permis..."
                className={styles.headerSearchInput}
              />
              <button
                type="button"
                className={styles.headerSearchButton}
                onClick={async () => {
                  const code = searchPermisCode.trim();
                  if (!code) return;
                  if (!mapRef.current?.searchPerimetreByPermisCode || !mapRef.current?.searchTitreByCode) {
                    toast.error('Carte indisponible pour la recherche.');
                    return;
                  }
                  const ok = await mapRef.current.searchPerimetreByPermisCode(code);
                  if (!ok) {
                    const fallbackOk = await mapRef.current.searchTitreByCode(code);
                    if (!fallbackOk) toast.warning('Aucun permis trouve.');
                  }
                }}
              >
                Rechercher
              </button>
            </div>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={resetDraftState}
              title="Reinitialiser la saisie"
            >
              Reinitialiser
            </button>
          </div>

          {pageError && <div className={styles.errorBox}>{pageError}</div>}

          <div className={styles.contentGrid}>
            <section className={styles.leftPanel}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>1. Type de titre</h3>
                </div>
                <div className={styles.cardBody}>
                  <label className={styles.label}>
                    Categorie de permis <span className={styles.required}>*</span>
                  </label>
                  <select
                    className={styles.select}
                    value={selectedPermisId === '' ? '' : String(selectedPermisId)}
                    onChange={(e) => handlePermisChange(e.target.value)}
                    disabled={optionsLoading}
                  >
                    <option value="">-- Selectionnez --</option>
                    {permisOptions.map((permis) => (
                      <option key={permis.id} value={permis.id}>
                        {permis.lib_type} ({permis.code_type}) - {permis.regime}
                      </option>
                    ))}
                  </select>

                  {detailsLoading && <div className={styles.loadingHint}>Chargement des details...</div>}
                  {effectivePermis && !detailsLoading && (
                    <div className={styles.infoBox}>
                      <div className={styles.infoRow}>
                        <span>Type:</span> <strong>{effectivePermis.lib_type}</strong>
                      </div>
                      <div className={styles.infoRow}>
                        <span>Code:</span> <strong>{effectivePermis.code_type}</strong>
                      </div>
                      <div className={styles.infoRow}>
                        <span>Superficie max:</span>{' '}
                        <strong>{effectivePermis.superficie_max ?? 'Non specifie'} ha</strong>
                      </div>
                    </div>
                  )}

                  <label className={styles.label}>
                    Date de soumission <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.datepickerWrapper}>
                    <DatePicker
                      selected={dateSoumission}
                      onChange={(date: Date | null) => setDateSoumission(date)}
                      dateFormat="dd/MM/yyyy"
                      className={styles.select}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>2. Perimetre</h3>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.infoRow}>
                    <span>Fuseau UTM:</span> <strong>{draftZone}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Hemisphere:</span> <strong>{draftHemisphere}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Points:</span> <strong>{mapPoints.length || 0}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Superficie:</span> <strong>{superficie ? `${superficie.toFixed(2)} ha` : '--'}</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      openManualEntry(false);
                    }}
                    disabled={!effectivePermis}
                  >
                    <FiMapPin /> Saisir les coordonnees
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={exportCsv}
                    disabled={!mapPoints.length}
                  >
                    Exporter CSV
                  </button>
                  {hasValidatedPerimeter && (
                    <div className={styles.statusBadge}>
                      <FiCheckCircle /> Perimetre valide
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>3. Chevauchements</h3>
                </div>
                <div className={styles.cardBody}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={checkOverlaps}
                    disabled={isCheckingOverlaps || !hasValidatedPerimeter}
                  >
                    {isCheckingOverlaps ? 'Verification...' : 'Verifier les chevauchements'}
                  </button>
                  {hasOverlapCheck && !overlapDetected && (
                    <div className={styles.statusBadge}>
                      <FiCheckCircle /> Aucun empietement detecte
                    </div>
                  )}
                  {overlapDetected && (
                    <div className={styles.warningBadge}>
                      <FiAlertTriangle /> Empietements detectes ({overlapTitles.length})
                    </div>
                  )}
                  {overlapTitles.length > 0 && (
                    <div
                      className={`${styles.overlapList} ${
                        showAllOverlaps ? styles.overlapListExpanded : ''
                      }`}
                    >
                      {(showAllOverlaps ? overlapTitles : overlapTitles.slice(0, 6)).map((t, idx) => {
                        const key = `${t.id ?? t.idtitre ?? t.objectid ?? idx}`;
                        const label = getOverlapLabel(t);
                        const zoomTarget = getOverlapZoomTarget(t);
                        if (!zoomTarget) {
                          return (
                            <div key={key} className={styles.overlapItem}>
                              {label}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={key}
                            type="button"
                            className={styles.overlapItemButton}
                            onClick={() => handleOverlapItemClick(t)}
                          >
                            {label}
                          </button>
                        );
                      })}
                      {overlapTitles.length > 6 && !showAllOverlaps && (
                        <button
                          type="button"
                          className={styles.overlapToggleBtn}
                          onClick={() => setShowAllOverlaps(true)}
                        >
                          + {overlapTitles.length - 6} autres... Afficher tous
                        </button>
                      )}
                      {overlapTitles.length > 6 && showAllOverlaps && (
                        <button
                          type="button"
                          className={styles.overlapToggleBtn}
                          onClick={() => setShowAllOverlaps(false)}
                        >
                          Reduire la liste
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>4. Demarrer</h3>
                </div>
                <div className={styles.cardBody}>
                  <button
                    type="button"
                    className={styles.startBtn}
                    disabled={submitting || !hasValidatedPerimeter || !hasOverlapCheck || overlapDetected}
                    onClick={startProcedure}
                  >
                    <FiPlay /> {submitting ? 'Creation...' : 'Demarrer la procedure'}
                  </button>
                </div>
              </div>
            </section>

            <section className={styles.mapPanel}>
              <ArcGISMap
                ref={mapRef}
                points={mapPoints}
                superficie={superficie}
                isDrawing={false}
                coordinateSystem="UTM"
                utmZone={draftZone}
                utmHemisphere={draftHemisphere}
                showFuseaux
                enableSelectionTools
              />
            </section>
          </div>

          {priorModalOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <h3>{isTEM ? 'Source APM (TEM)' : 'Titre precedent (TX)'}</h3>
                  <button className={styles.modalClose} onClick={() => setPriorModalOpen(false)}>
                    x
                  </button>
                </div>
                <div className={styles.modalBody}>
                  {priorLoading && <div>Chargement...</div>}
                  {priorError && <div className={styles.errorBox}>{priorError}</div>}

                  {!priorLoading && !priorError && isTEM && (
                    <>
                      <p>Ce titre TEM provient-il d'un APM ?</p>
                      <div className={styles.choiceRow}>
                        <button
                          type="button"
                          className={`${styles.choiceBtn} ${temFromApm === 'yes' ? styles.choiceActive : ''}`}
                          onClick={() => setTemFromApm('yes')}
                        >
                          Oui, choisir un APM
                        </button>
                        <button
                          type="button"
                          className={`${styles.choiceBtn} ${temFromApm === 'no' ? styles.choiceActive : ''}`}
                          onClick={() => setTemFromApm('no')}
                        >
                          Non, saisir un nouveau perimetre
                        </button>
                      </div>
                      {temFromApm === 'yes' && (
                        <>
                          <input
                            className={styles.searchInput}
                            placeholder="Rechercher APM..."
                            value={priorSearch}
                            onChange={(e) => setPriorSearch(e.target.value)}
                          />
                          <div className={styles.titreList}>
                            {filteredApmTitres.map((t) => (
                              <label key={t.id} className={styles.titreItem}>
                                <input
                                  type="radio"
                                  name="apm_titre"
                                  checked={selectedApm?.id === t.id}
                                  onChange={() => setSelectedApm(t)}
                                />
                                <div>
                                  <strong>{t.code_permis}</strong> {t.type_code ? `(${t.type_code})` : ''}
                                </div>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {!priorLoading && !priorError && isTX && (
                    <>
                      <p>Selectionnez le titre TEM/TEC de reference.</p>
                      <input
                        className={styles.searchInput}
                        placeholder="Rechercher TEM/TEC..."
                        value={priorSearch}
                        onChange={(e) => setPriorSearch(e.target.value)}
                      />
                      <div className={styles.titreList}>
                        {filteredPriorTitres.map((t) => (
                          <label key={t.id} className={styles.titreItem}>
                            <input
                              type="radio"
                              name="prior_titre"
                              checked={selectedPrior?.id === t.id}
                              onChange={() => setSelectedPrior(t)}
                            />
                            <div>
                              <strong>{t.code_permis}</strong> {t.type_code ? `(${t.type_code})` : ''}
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  {isTEM && temFromApm === 'no' && (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => {
                        setPriorModalOpen(false);
                        openManualEntry(true);
                      }}
                    >
                      Saisir de nouvelles coordonnees
                    </button>
                  )}
                  {isTEM && temFromApm === 'yes' && (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setPriorModalOpen(false);
                          openManualEntry(true);
                        }}
                      >
                        Saisir de nouvelles coordonnees
                      </button>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={!selectedApm}
                        onClick={async () => {
                          await fetchPriorCoords(selectedApm);
                          setPriorModalOpen(false);
                        }}
                      >
                        Utiliser les coordonnees APM
                      </button>
                    </>
                  )}
                  {isTX && (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setPriorModalOpen(false);
                          openManualEntry(true);
                        }}
                      >
                        Saisir de nouvelles coordonnees
                      </button>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={!selectedPrior}
                        onClick={async () => {
                          await fetchPriorCoords(selectedPrior);
                          setPriorModalOpen(false);
                        }}
                      >
                        Utiliser les coordonnees du titre
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {coordModalOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <h3>Saisie des coordonnees (UTM)</h3>
                  <button className={styles.modalClose} onClick={() => setCoordModalOpen(false)}>
                    x
                  </button>
                </div>
                <div className={styles.modalBody}>
                  {coordError && <div className={styles.errorBox}>{coordError}</div>}
                  <div className={styles.coordControls}>
                    <label>Fuseau</label>
                    <select value={draftZone} onChange={(e) => setDraftZone(Number(e.target.value))}>
                      {[29, 30, 31, 32].map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                    <label>Hemisphere</label>
                    <select value={draftHemisphere} onChange={(e) => setDraftHemisphere(e.target.value as 'N')}>
                      <option value="N">Nord (N)</option>
                    </select>
                  </div>

                  <div className={styles.coordTableHeader}>
                    <span>Points du perimetre</span>
                    <div className={styles.coordActions}>
                      <button className={styles.coordAddBtn} type="button" onClick={addDraftPoint}>
                        <FiPlus /> Ajouter
                      </button>
                      <button
                        className={styles.coordAddBtn}
                        type="button"
                        onClick={() => csvInputRef.current?.click()}
                      >
                        Importer CSV
                      </button>
                    </div>
                  </div>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleImportCsv}
                    style={{ display: 'none' }}
                  />

                  <table className={styles.coordTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Easting (X)</th>
                        <th>Northing (Y)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftPoints.map((point, index) => (
                        <tr key={point.id}>
                          <td>{index + 1}</td>
                          <td>
                            <input
                              type="number"
                              value={point.x}
                              onChange={(e) => updateDraftPoint(point.id, 'x', e.target.value)}
                              onPaste={handleCoordsPaste(index)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={point.y}
                              onChange={(e) => updateDraftPoint(point.id, 'y', e.target.value)}
                              onPaste={handleCoordsPaste(index)}
                            />
                          </td>
                          <td>
                            <div className={styles.coordActionGroup}>
                              <button
                                type="button"
                                className={styles.coordMoveBtn}
                                onClick={() => moveDraftPoint(index, -1)}
                                disabled={index === 0}
                                title="Monter"
                              >
                                <FiChevronUp />
                              </button>
                              <button
                                type="button"
                                className={styles.coordMoveBtn}
                                onClick={() => moveDraftPoint(index, 1)}
                                disabled={index === draftPoints.length - 1}
                                title="Descendre"
                              >
                                <FiChevronDown />
                              </button>
                              <button
                                type="button"
                                className={styles.coordRemoveBtn}
                                onClick={() => removeDraftPoint(point.id)}
                                disabled={draftPoints.length <= 3}
                                title="Supprimer"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.pasteHint}>
                    Astuce: collez depuis Excel/CSV ou un texte UTM (Ctrl+V).
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.primaryBtn} onClick={handleValidatePerimeter}>
                    Valider le perimetre
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
