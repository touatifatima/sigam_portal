
'use client';

import { useMemo, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { toast } from 'react-toastify';
import proj4 from 'proj4';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi';

import styles from './projection.module.css';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import { useViewNavigator } from '../../src/hooks/useViewNavigator';
import type { ArcGISMapRef } from '@/components/arcgismap/ArcgisMap';

const ArcGISMap = dynamic(() => import('@/components/arcgismap/ArcgisMap'), { ssr: false });

interface DraftPointInput {
  id: number;
  x: string;
  y: string;
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

// Nord Sahara -> WGS84 7-parameter transformation (JO 30/11/2022).
// Published parameters are WGS84 -> Nord Sahara; signs inverted for +towgs84.
const NORD_SAHARA_TOWGS84 = {
  dx: -267.407,
  dy: -47.068,
  dz: 446.357,
  rx: -0.179423,
  ry: 5.577661,
  rz: -1.27762,
  ds: 1.204866,
};

const buildDefaultPoints = (): DraftPointInput[] => [
  { id: 1, x: '', y: '' },
  { id: 2, x: '', y: '' },
  { id: 3, x: '', y: '' },
];

const buildUtmProj = (zone: number) =>
  `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +units=m ` +
  `+k=0.9996 +x_0=500000 +y_0=0 ` +
  `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
  `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
  `+no_defs`;

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

const convertWgs84ToUtm = (coords: [number, number][], zone: number) =>
  coords.map(([lon, lat]) => {
    const [x, y] = proj4('EPSG:4326', buildUtmProj(zone), [lon, lat]);
    return [x, y] as [number, number];
  });

export default function ProjectionPage() {
  const { currentView, navigateTo } = useViewNavigator('projection');
  const mapRef = useRef<ArcGISMapRef | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [searchPermisCode, setSearchPermisCode] = useState('');
  const [draftPoints, setDraftPoints] = useState<DraftPointInput[]>(buildDefaultPoints());
  const [draftZone, setDraftZone] = useState(31);
  const [draftHemisphere, setDraftHemisphere] = useState<'N'>('N');
  const [coordError, setCoordError] = useState<string | null>(null);

  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [superficie, setSuperficie] = useState(0);
  const [hasValidatedPerimeter, setHasValidatedPerimeter] = useState(false);
  const [showFuseaux, setShowFuseaux] = useState(false);
  const [detectedLieu, setDetectedLieu] = useState<{ wilaya?: string; commune?: string; ville?: string }>({});

  const [overlapTitles, setOverlapTitles] = useState<any[]>([]);
  const [isCheckingOverlaps, setIsCheckingOverlaps] = useState(false);
  const [overlapDetected, setOverlapDetected] = useState(false);
  const [hasOverlapCheck, setHasOverlapCheck] = useState(false);
  const [showAllOverlaps, setShowAllOverlaps] = useState(false);

  const pointsCount = mapPoints.length || 0;

  const handleSearchPermis = async () => {
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

  const parseDraftPoints = () =>
    draftPoints
      .map((p) => ({ id: p.id, x: Number(p.x), y: Number(p.y) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

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
      hemisphere,
    }));

    setMapPoints(mapPts);
    setHasValidatedPerimeter(true);
    setOverlapTitles([]);
    setHasOverlapCheck(false);
    setOverlapDetected(false);
    setShowAllOverlaps(false);
    const area = computeAreaHa(parsed);
    setSuperficie(area);
  };

  const resetAll = () => {
    setDraftPoints(buildDefaultPoints());
    setDraftZone(31);
    setDraftHemisphere('N');
    setCoordError(null);
    setMapPoints([]);
    setSuperficie(0);
    setHasValidatedPerimeter(false);
    setOverlapTitles([]);
    setOverlapDetected(false);
    setHasOverlapCheck(false);
    setShowAllOverlaps(false);
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
    const rows = lines.map((line) => line.split(delimiter).map((cell) => parseCsvValue(cell)));

    const header = rows[0].map(normalizeHeader);
    const hasHeader =
      header.includes('x') || header.includes('y') || header.includes('easting') || header.includes('northing');

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
    if (!apiBase) {
      toast.error('Configuration API manquante.');
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
    if (layerType === 'exclusions') {
      const name = o.nom || o.Nom || "Zone d'exclusion";
      return `Zones d'exclusion: ${name}${overlapText}`.replace(/\s+/g, ' ').trim();
    }
    return `Chevauchement${overlapText}`.trim();
  };

  const coordPreview = useMemo(() => {
    if (!mapPoints.length) return [];
    return mapPoints.slice(0, 3).map((p) => `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`);
  }, [mapPoints]);

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.headerRow}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Outils professionnels de projection</h1>
              <p className={styles.subtitle}>
                Centralisez vos coordonnees, analysez les couches SIGAM et verifiez les chevauchements en un clic.
              </p>
            </div>
            <div className={styles.headerSearch}>
              <FiSearch className={styles.headerSearchIcon} />
              <input
                value={searchPermisCode}
                onChange={(e) => setSearchPermisCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchPermis();
                  }
                }}
                placeholder="Rechercher par code permis..."
                className={styles.headerSearchInput}
              />
              <button
                type="button"
                className={styles.headerSearchButton}
                onClick={handleSearchPermis}
              >
                Chercher
              </button>
            </div>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={resetAll}
              title="Reinitialiser la session"
            >
              <FiRefreshCw /> Reinitialiser
            </button>
          </div>

          <div className={styles.contentGrid}>
            <section className={styles.leftPanel}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>Tableau de bord</h3>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.infoRow}>
                    <span>Fuseau UTM:</span> <strong>{draftZone}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Hemisphere:</span> <strong>{draftHemisphere}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Points valides:</span> <strong>{pointsCount}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Superficie:</span>{' '}
                    <strong>{superficie ? `${superficie.toFixed(2)} ha` : '--'}</strong>
                  </div>
                  <label className={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={showFuseaux}
                      onChange={(e) => setShowFuseaux(e.target.checked)}
                    />
                    Afficher les fuseaux UTM
                  </label>
                  {(detectedLieu.ville || detectedLieu.commune || detectedLieu.wilaya) && (
                    <div className={styles.infoHighlight}>
                      Lieu detecte: {[detectedLieu.ville, detectedLieu.commune, detectedLieu.wilaya].filter(Boolean).join(' / ')}
                    </div>
                  )}
                  {!!coordPreview.length && (
                    <div className={styles.previewBox}>
                      <span>Apercu coordonnees:</span>
                      <ul>
                        {coordPreview.map((c, idx) => (
                          <li key={`${c}-${idx}`}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>Coordonnees UTM</h3>
                </div>
                <div className={styles.cardBody}>
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
                        <FiUpload /> Importer CSV
                      </button>
                      <button className={styles.coordAddBtn} type="button" onClick={exportCsv}>
                        <FiDownload /> Exporter CSV
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

                  <div className={styles.coordFooter}>
                    <button className={styles.primaryBtn} onClick={handleValidatePerimeter}>
                      <FiMapPin /> Valider le perimetre
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>Chevauchements</h3>
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
                      {(showAllOverlaps ? overlapTitles : overlapTitles.slice(0, 8)).map((t, idx) => {
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
                      {overlapTitles.length > 8 && !showAllOverlaps && (
                        <button
                          type="button"
                          className={styles.overlapToggleBtn}
                          onClick={() => setShowAllOverlaps(true)}
                        >
                          + {overlapTitles.length - 8} autres... Afficher tous
                        </button>
                      )}
                      {overlapTitles.length > 8 && showAllOverlaps && (
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
                showFuseaux={showFuseaux}
                enableSelectionTools
                onAdminDetected={(loc) => setDetectedLieu(loc || {})}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

