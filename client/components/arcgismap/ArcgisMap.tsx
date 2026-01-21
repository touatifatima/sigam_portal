// components/map/ArcGISMap.tsx
'use client';
// Configure ArcGIS before importing other @arcgis/core modules
import '../../src/config/arcgis-config';
import '@arcgis/core/assets/esri/themes/light/main.css';
import { forwardRef, useRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Basemap from '@arcgis/core/Basemap';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import Sketch from '@arcgis/core/widgets/Sketch';
import DistanceMeasurement2D from '@arcgis/core/widgets/DistanceMeasurement2D';
import AreaMeasurement2D from '@arcgis/core/widgets/AreaMeasurement2D';
import Compass from '@arcgis/core/widgets/Compass';
import NavigationToggle from '@arcgis/core/widgets/NavigationToggle';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as proj4 from 'proj4';
import esriConfig from '@arcgis/core/config';
import * as print from '@arcgis/core/rest/print';
import PrintParameters from '@arcgis/core/rest/support/PrintParameters';
import PrintTemplate from '@arcgis/core/rest/support/PrintTemplate';
import esriId from '@arcgis/core/identity/IdentityManager';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Configure ArcGIS Enterprise portal
try { esriConfig.portalUrl = "https://sig.anam.dz/portal"; } catch {}

// Persist ArcGIS credentials across refreshes so users don't re-enter login on each visit
const CREDENTIALS_KEY = 'sigam_arcgis_credentials';
const loadPersistedCredentials = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return;
    const json = JSON.parse(raw);
    esriId.initialize(json);
  } catch (e) {
    console.warn('Failed to restore ArcGIS credentials from storage', e);
  }
};
const persistCredentials = () => {
  if (typeof window === 'undefined') return;
  try {
    const json = esriId.toJSON();
    window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(json));
  } catch (e) {
    console.warn('Failed to persist ArcGIS credentials', e);
  }
};
loadPersistedCredentials();
try {
  // Keep stored credentials updated when a new token is issued
  (esriId as any).on?.('credential-create', persistCredentials);
} catch {}

// Strip app-level custom headers from ArcGIS/ANAM/CDN requests to avoid CORS issues
if (typeof window !== 'undefined') {
  try {
    const req = esriConfig.request as any;
    req.corsEnabledServers = req.corsEnabledServers || [];
    const corsServers = req.corsEnabledServers as string[];
    const ensure = (h: string) => { if (!corsServers.includes(h)) corsServers.push(h); };
    [
      'sig.anam.dz',
      'sig.anam.dz:443',
      'cdn.arcgis.com',
      'js.arcgis.com',
      'services.arcgisonline.com',
      'server.arcgisonline.com',
      'basemaps.arcgis.com',
      'tiles.arcgis.com'
    ].forEach(ensure);

    const key = '__SIGAM_ARCGIS_INTERCEPTOR__';
    const w = window as any;
    if (!w[key]) {
      esriConfig.request.interceptors!.push({
        // Provide a types-compatible list of host patterns; do final hostname verification in `before`
        urls: [
          'sig.anam.dz',
          /\.arcgis\.com$/,
          /\.arcgisonline\.com$/,
          'cdn.arcgis.com'
        ],
        before: (params: any) => {
          try {
            // Determine the request URL from available params locations
            const urlStr = params.url || params.requestOptions?.url || '';
            const u = new URL(urlStr, window.location.origin);
            const h = u.hostname.toLowerCase();
            // Only modify headers/credentials for the intended hosts
            if (
              h === 'sig.anam.dz' ||
              h.endsWith('.arcgis.com') ||
              h.endsWith('arcgisonline.com') ||
              h === 'cdn.arcgis.com'
            ) {
              const headers = new Headers(params.requestOptions?.headers || {});
              headers.delete('X-User-Id');
              headers.delete('x-user-id');
              headers.delete('X-User-Name');
              headers.delete('x-user-name');
              // Include cookies for sig.anam.dz so secured layers (e.g., modifications) can load
              // while omitting credentials for ArcGIS CDN hosts.
              const credentials = h === 'sig.anam.dz' ? 'include' : 'omit';
              params.requestOptions = {
                ...params.requestOptions,
                headers,
                credentials
              };
            }
          } catch {}
          return params;
        }
      });
      w[key] = true;
    }
  } catch {}
}

export type CoordinateSystem = 'WGS84' | 'UTM' | 'LAMBERT' | 'MERCATOR';

export type SigamLayerKey =
  | 'perimetresSig'
  | 'titres'
  | 'promotion'
  | 'exclusions'
  | 'wilayas'
  | 'communes'
  | 'villes'
  | 'pays';

export type Coordinate = {
  id: number;
  idTitre: number;
  h: number;
  x: number;
  y: number;
  system: CoordinateSystem;
  zone?: number;
  hemisphere?: 'N';
};

type SelectedPolygon = {
  key: string;
  layerId?: string;
  layerTitle?: string;
  attributes?: any;
  geometry: Polygon;
  wgs84Rings: number[][][];
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

// Empirical UTM offsets to correct residual shift when displaying
// Nord Sahara UTM points over ArcGIS basemaps (meters), per fuseau.
// Positive X = east, positive Y = north.
const getUtmShift = (zone: number) => {
  return { x: 0, y: 0 };
};

export interface ArcGISMapProps {
  points: Coordinate[];
  superficie: number;
  isDrawing: boolean;
  onMapClick?: (x: number, y: number) => void;
  onPolygonChange?: (coordinates: [number, number][]) => void;
  // Called when a "Titres Miniers ANAM" polygon is clicked
  // (attributes come from the ArcGIS FeatureLayer, e.g. idtitre, code, etc.).
  onTitreSelected?: (attributes: any) => void;
  // Notifies parent when wilaya/commune/ville are detected from the polygon centroid
  onAdminDetected?: (loc: { wilaya?: string; commune?: string; ville?: string }) => void;
  existingPolygons?: {
    idProc: number;
    num_proc: string;
    coordinates: [number, number][];
    zone?: number;
    hemisphere?: 'N' | 'S';
    isWGS?: boolean;
  }[];
  selectedExistingProcId?: number | null;
  previewPolygons?: { label?: string; coordinates: [number, number][]; color?: [number, number, number, number?] }[];
  layerType?: string;
  coordinateSystem?: CoordinateSystem;
  utmZone?: number;
  utmHemisphere?: 'N';
  editable?: boolean;
  labelText?: string;
  showFuseaux?: boolean;
  // Optional: administrative info for reports
  adminInfo?: {
    codeDemande?: string;
    typePermis?: string;
    titulaire?: string;
    wilaya?: string;
    daira?: string;
    commune?: string;
  };
  declaredAreaHa?: number; // Superficie déclarée
  validationSummary?: { // Validation flags to display in PDF
    sitGeoOk?: boolean;
    empietOk?: boolean;
    geomOk?: boolean;
    superfOk?: boolean;
  };
  // Optional: precomputed overlaps (titles) to include in PDF export.
  // When provided, PDF generation will not query remote layers again.
  overlapTitles?: any[];
  enableSelectionTools?: boolean;
}

export interface ArcGISMapRef {
  getPoints: () => Coordinate[];
  resetMap: () => void;
  calculateArea: () => number;
  getActiveLayers: () => {[key: string]: boolean};
  toggleLayerPanel: () => void;
  setLayerPanelOpen: (open: boolean) => void;
  searchTitreByCode: (code: string) => Promise<boolean>;
  searchPerimetreByPermisCode: (code: string) => Promise<boolean>;
  searchLayerFeature: (layerKey: SigamLayerKey, fieldName: string, value: string) => Promise<boolean>;
  detectAdminForCurrent: () => Promise<void>;
  // Returns null if service unreachable or query fails
  queryMiningTitles: (geometry?: any) => Promise<any[] | null>;
}

  export const ArcGISMap = forwardRef<ArcGISMapRef, ArcGISMapProps>(({ 
    points,
    superficie,
    isDrawing,
    onMapClick,
    onPolygonChange,
    onTitreSelected,
    existingPolygons = [],
    selectedExistingProcId = null,
    previewPolygons = [],
    layerType = 'titres',
    coordinateSystem = 'UTM',
    utmZone = 31,
    utmHemisphere = 'N',
    editable = true,
    labelText,
    showFuseaux = false,
    adminInfo,
    declaredAreaHa,
    validationSummary,
    overlapTitles,
    onAdminDetected,
    enableSelectionTools = false
  }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const markersLayerRef = useRef<GraphicsLayer | null>(null);
  const existingPolygonsLayerRef = useRef<GraphicsLayer | null>(null);
  const previewLayerRef = useRef<GraphicsLayer | null>(null);
  const fuseauxLayerRef = useRef<GraphicsLayer | null>(null);
  const titresLayerRef = useRef<FeatureLayer | null>(null);
  const perimetresSigLayerRef = useRef<FeatureLayer | null>(null);
  const searchHighlightLayerRef = useRef<GraphicsLayer | null>(null);
  const selectionLayerRef = useRef<GraphicsLayer | null>(null);
  const wilayasLayerRef = useRef<FeatureLayer | null>(null);
  const communesLayerRef = useRef<FeatureLayer | null>(null);
  const villesLayerRef = useRef<FeatureLayer | null>(null);
  const currentPolygonRef = useRef<Polygon | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const searchCacheRef = useRef<Record<string, { features: any[]; index: number; value: string }>>({});
  const [detectedAdmin, setDetectedAdmin] = useState<{wilaya?: string; commune?: string; ville?: string}>({});
  // Build a popup template listing all fields of a layer
  const buildAllFieldsPopup = (layer: any, title?: string) => {
    const infos = (layer?.fields || []).map((f: any) => ({
      fieldName: f.name,
      label: f.alias || f.name
    }));
    return {
      title: title || layer?.title || '{OBJECTID}',
      content: [{ type: 'fields', fieldInfos: infos }] as any
    };
  };
  const [enterpriseLayers, setEnterpriseLayers] = useState<any[]>([]);
  const enterpriseLayersRef = useRef<any[]>([]);

  // Persist layer toggles so fullscreen (2nd map instance) and refresh keep the same selection.
  const ACTIVE_LAYERS_KEY = 'sigam_arcgis_active_layers';
  const defaultActiveLayers: { [key: string]: boolean } = {
    titres: true,          // layer 1
    perimetresSig: false,  // layer 0
    promotion: false,      // layer 2
    exclusions: false,     // layer 3
    wilayas: false,        // layer 4
    communes: false,       // layer 5
    villes: false,         // layer 6
    pays: false            // layer 7
  };

  const [activeLayers, setActiveLayers] = useState<{[key: string]: boolean}>(() => {
    if (typeof window === 'undefined') return { ...defaultActiveLayers };
    try {
      const raw = window.localStorage.getItem(ACTIVE_LAYERS_KEY);
      if (!raw) return { ...defaultActiveLayers };
      const parsed = JSON.parse(raw) as Record<string, any>;
      const migrated = { ...(parsed || {}) };
      if (migrated.pays === undefined && migrated.paye !== undefined) {
        migrated.pays = migrated.paye;
      }
      delete migrated.paye;
      return { ...defaultActiveLayers, ...migrated };
    } catch {
      return { ...defaultActiveLayers };
    }
  });

  type BasemapMode = 'standard' | 'satellite';
  const BASEMAP_MODE_KEY = 'sigam_arcgis_basemap_mode';
  const [basemapMode, setBasemapMode] = useState<BasemapMode>(() => {
    if (typeof window === 'undefined') return 'standard';
    try {
      const saved = window.localStorage.getItem(BASEMAP_MODE_KEY) as BasemapMode | null;
      return saved || 'standard';
    } catch {
      return 'standard';
    }
  });
  const basemapCacheRef = useRef<{ standard?: Basemap; satellite?: Basemap }>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ACTIVE_LAYERS_KEY, JSON.stringify(activeLayers));
    } catch {}
  }, [activeLayers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BASEMAP_MODE_KEY, basemapMode);
    } catch {}
  }, [basemapMode]);
  const layerToggleOptions = [
    { key: 'titres', label: 'Titres miniers' },
    { key: 'perimetresSig', label: 'Demandes' },
    { key: 'promotion', label: 'Promotion' },
    { key: 'exclusions', label: "Zones d'exclusion" },
    { key: 'wilayas', label: 'Wilayas' },
    { key: 'communes', label: 'Communes' },
    { key: 'villes', label: 'Villes' },
    { key: 'pays', label: 'Pays' },

  ];
  const basemapOptions: Array<{ key: BasemapMode; label: string }> = [
    { key: 'standard', label: 'Carte' },
    { key: 'satellite', label: 'Satellite' }
  ];
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [activeMeasureTool, setActiveMeasureTool] = useState<'none' | 'distance' | 'area'>('none');
  const [rotationToolsEnabled, setRotationToolsEnabled] = useState(false);
  const [selectedTitreAttributes, setSelectedTitreAttributes] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPolygons, setSelectedPolygons] = useState<SelectedPolygon[]>([]);
  const [showSelectedCoords, setShowSelectedCoords] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);
  const [selectionCollapsed, setSelectionCollapsed] = useState(false);
  // Guard to avoid duplicate MapView initialization in React StrictMode (dev)
  const initializedRef = useRef<boolean>(false);
  const polygonGraphicRef = useRef<Graphic | null>(null);
  const sketchRef = useRef<Sketch | null>(null);
  const distanceMeasurementRef = useRef<DistanceMeasurement2D | null>(null);
  const areaMeasurementRef = useRef<AreaMeasurement2D | null>(null);
  const navigationToggleRef = useRef<NavigationToggle | null>(null);
  const compassRef = useRef<Compass | null>(null);
  const hasZoomedToPolygonRef = useRef<boolean>(false);
  const [editingEnabled, setEditingEnabled] = useState(false);

  // ANAM Enterprise utility services (geometry / printing)
  const enterpriseServices = {
    geometryService: "https://sig.anam.dz/server/rest/services/Utilities/Geometry/GeometryServer",
    printingService: "https://sig.anam.dz/server/rest/services/Utilities/PrintingTools/GPServer"
  };

  // Base ANAM service providing all SIGAM map layers (override via env if needed)
  const SIGAM_SERVICE_BASE =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SIGAM_ARCGIS_BASE) ||
    (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SIGAM_ARCGIS_BASE) ||
    "https://sig.anam.dz/server/rest/services/sigam_cadastre/MapServer";

  // Individual layer URLs for sigam_final (all couches)
  const SIGAM_LAYERS = {
    perimetresSig: `${SIGAM_SERVICE_BASE}/0`, // sig_gis.public.gis_perimeters
    titres: `${SIGAM_SERVICE_BASE}/1`,        // sig_gis.public.cmasig_titres
    promotion: `${SIGAM_SERVICE_BASE}/2`,     // sig_gis.public.cmasig_promotion
    exclusions: `${SIGAM_SERVICE_BASE}/3`,    // sig_gis.public.cmasig_exclusion
    wilayas: `${SIGAM_SERVICE_BASE}/4`,       // sig_gis.public.cmasig_wilayas
    communes: `${SIGAM_SERVICE_BASE}/5`,      // sig_gis.public.cmasig_communes
    villes: `${SIGAM_SERVICE_BASE}/6`,        // sig_gis.public.cmasig_villes
    pays: `${SIGAM_SERVICE_BASE}/7`,          // sig_gis.public.cmasig_pays

  } as const;
  
  // Allow disabling enterprise layers entirely in local/dev via env
  // Vite exposes env as import.meta.env; any string 'true' enables this toggle
  const DISABLE_ENTERPRISE_LAYERS = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ARCGIS_DISABLE_ENTERPRISE === 'true');

  const API_BASE =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API_URL) ||
    '';

  const deriveUtmZoneFromLon = (lon?: number | null) => {
    if (lon === null || lon === undefined || !Number.isFinite(lon)) return undefined;
    const zone = Math.floor((lon + 180) / 6) + 1;
    return Number.isFinite(zone) ? zone : undefined;
  };

  const deriveHemisphereFromLat = (lat?: number | null) => {
    if (lat === null || lat === undefined || !Number.isFinite(lat)) return undefined;
    return lat < 0 ? 'S' : 'N';
  };

  const buildSatelliteBasemap = useCallback(async () => {
    if (basemapCacheRef.current.satellite) {
      return basemapCacheRef.current.satellite;
    }
    try {
      const sat = Basemap.fromId('hybrid');
      await sat!.load();
      basemapCacheRef.current.satellite = sat!;
      return sat!;
    } catch (err) {
      console.warn('ArcGIS hybrid basemap unavailable; trying World Imagery tiles.', err);
      try {
        const imageryLayer = new WebTileLayer({
          urlTemplate: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        });
        const imageryBasemap = new Basemap({ baseLayers: [imageryLayer], title: 'Esri World Imagery' });
        basemapCacheRef.current.satellite = imageryBasemap;
        return imageryBasemap;
      } catch (fallbackErr) {
        console.warn('World Imagery basemap unavailable.', fallbackErr);
        return null;
      }
    }
  }, []);

  const applyBasemap = useCallback(async (mode: BasemapMode) => {
    const view = viewRef.current;
    if (!view) return;
    if (mode === 'standard') {
      const standard = basemapCacheRef.current.standard || view.map!.basemap;
      if (standard) {
        view.map!.basemap = standard;
      }
      return;
    }
    const satellite = await buildSatelliteBasemap();
    if (satellite) {
      view.map!.basemap = satellite;
    }
  }, [buildSatelliteBasemap]);

  // Coordinate conversion functions (same as before)
  const convertToWGS84 = (point: Coordinate): [number, number] => {
    // Guard against invalid coordinates early
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return [0, 0];
    }
    try {
    const isUTM = point.system === 'UTM' || point.system === 'WGS84' || !point.system;
    if (isUTM) {
      // Always use the fuseau selected in the UI/props
      const zone = utmZone;
      const hemisphere = point.hemisphere ?? utmHemisphere;
      if (!zone || !hemisphere) {
        console.warn(`UTM coordinate missing zone or hemisphere for point ${point.id}, using defaults: zone=${utmZone}, hemisphere=${utmHemisphere}`);
      }
      const shift = getUtmShift(zone);
      const xCorr = point.x + shift.x;
      const yCorr = point.y + shift.y;
      // Use Clarke 1880 UTM (k=0.9996) with JO 2022 Bursa-Wolf params
      const sourceProj =
        // `+proj=utm +zone=${zone} +a=6378249.138 +b=6356514.9999 +units=m ` +
        // `+k=0.9996 +x_0=500000 +y_0=0 +no_defs`;
         `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +units=m ` +
        `+k=0.9996 +x_0=500000 +y_0=0 ` +
        `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
        `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
        `+no_defs`;
      const convertedUTM = proj4.default(sourceProj, 'EPSG:4326', [xCorr, yCorr]);
      return [convertedUTM[0], convertedUTM[1]];
    }
    return [point.x, point.y];
  } catch (error) {
    console.error(`Coordinate conversion error for point ${point.id}:`, error);
    return [0, 0];
  }
  };

  const convertFromWGS84 = (lng: number, lat: number, targetSystem: CoordinateSystem, targetZone?: number, targetHemisphere?: 'N'): [number, number] => {
    try {
      switch (targetSystem) {
        case 'UTM':
          const zone = targetZone ?? utmZone;
          const hemisphere = targetHemisphere ?? utmHemisphere;
          if (!zone || !hemisphere) {
            throw new Error('UTM conversion requires zone and hemisphere');
          }
          const targetProj =
            // `+proj=utm +zone=${zone} +a=6378249.138 +b=6356514.9999 +units=m ` +
            // `+k=0.9996 +x_0=500000 +y_0=0 +no_defs`;
             `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +units=m ` +
            `+k=0.9996 +x_0=500000 +y_0=0 ` +
            `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
            `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
            `+no_defs`;
          const convertedUTM = proj4.default('EPSG:4326', targetProj, [lng, lat]);
          const shiftBack = getUtmShift(zone);
          const x = convertedUTM[0] - shiftBack.x;
          const y = convertedUTM[1] - shiftBack.y;
          return [x, y];
        default:
          return [lng, lat];
      }
    } catch (error) {
      console.error('Coordinate conversion error:', error);
      return [0, 0];
    }
  };

  const normalizeRingCoords = (ring: number[][]) => {
    const cleaned = ring.filter(
      (coord) => Array.isArray(coord) && Number.isFinite(coord[0]) && Number.isFinite(coord[1])
    );
    if (cleaned.length > 1) {
      const first = cleaned[0];
      const last = cleaned[cleaned.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        return cleaned.slice(0, -1);
      }
    }
    return cleaned;
  };

  const closeRing = (ring: number[][]) => {
    if (!ring.length) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring;
    return [...ring, first];
  };

  const toWgs84Polygon = (geom: Polygon) => {
    const wkid = geom?.spatialReference?.wkid;
    if (!wkid || wkid === 4326) return geom;
    if (wkid === 3857 || wkid === 102100) {
      try {
        return webMercatorUtils.webMercatorToGeographic(geom) as Polygon;
      } catch {
        return geom;
      }
    }
    return geom;
  };

  const extractWgs84Rings = (geom: Polygon) => {
    try {
      const wgsGeom = toWgs84Polygon(geom);
      const rings = (wgsGeom?.rings || []).map((ring) => normalizeRingCoords(ring));
      return rings.filter((ring) => ring.length >= 3);
    } catch {
      return [];
    }
  };

  const getGraphicKey = (graphic: Graphic) => {
    const attrs = graphic?.attributes || {};
    const candidate =
      attrs.objectid ??
      attrs.OBJECTID ??
      attrs.id ??
      attrs.idtitre ??
      attrs.code ??
      (graphic as any)?.uid;
    const layerId = (graphic?.layer as any)?.id ?? 'layer';
    return `${layerId}:${candidate}`;
  };

  const isSelectableGraphic = (graphic?: Graphic | null, allowedRefs: any[] = []) => {
    if (!graphic) return false;
    const layer = graphic.layer as any;
    if (!layer) return false;
    const ignoredLayers = new Set(
      [
        fuseauxLayerRef.current,
        selectionLayerRef.current,
        searchHighlightLayerRef.current,
        previewLayerRef.current,
        markersLayerRef.current
      ]
        .filter(Boolean)
        .map((l: any) => l?.id)
    );
    if (layer?.id && ignoredLayers.has(layer.id)) return false;
    if (allowedRefs.length) {
      return allowedRefs.some((ref: any) => ref?.id === layer?.id);
    }
    if (layer === graphicsLayerRef.current) return true;
    if (layer === existingPolygonsLayerRef.current) return true;
    return false;
  };

  const getSelectionLabel = (selection: SelectedPolygon, index: number) => {
    const attrs = selection.attributes || {};
    const code =
      attrs.code ??
      attrs.permis_code ??
      attrs.idtitre ??
      attrs.objectid ??
      attrs.OBJECTID ??
      attrs.id;
    const type =
      attrs.typetitre ??
      attrs.codetype ??
      attrs.type_code ??
      attrs.lib_type ??
      attrs.nom;
    const layer = selection.layerTitle || 'Couche';
    if (type && code) return `${type} ${code}`.trim();
    if (type) return String(type);
    if (code) return `${layer} ${code}`.trim();
    return `${layer} ${index + 1}`;
  };

  const resolveSelectionZoneHemisphere = (selection: SelectedPolygon, ring?: number[][]) => {
    const attrs = selection.attributes || {};
    const zoneCandidate = Number(
      attrs.__utm_zone ??
        attrs.zone ??
        attrs.z ??
        attrs.ZONE ??
        attrs.Z
    );
    const zone =
      Number.isFinite(zoneCandidate) && zoneCandidate >= 1 && zoneCandidate <= 60
        ? zoneCandidate
        : deriveUtmZoneFromLon(ring?.[0]?.[0]) ?? utmZone;
    const hemiRaw =
      attrs.__utm_hemisphere ??
      attrs.hemisphere ??
      attrs.HEMISPHERE ??
      attrs.HEMI ??
      attrs.H;
    const hemisphere =
      hemiRaw === 'S' || hemiRaw === 'N'
        ? hemiRaw
        : deriveHemisphereFromLat(ring?.[0]?.[1]) ?? utmHemisphere;
    return { zone, hemisphere };
  };

  const formatUtmHectometric = (value: number) => {
    if (!Number.isFinite(value)) return '';
    return String(Math.round(value / 100) * 100);
  };

  const selectionCoordsText = selectedPolygons
    .map((selection, idx) => {
      const label = getSelectionLabel(selection, idx);
      const ringBlocks = (selection.wgs84Rings || []).map((ring, ringIdx) => {
        const ringLabel = selection.wgs84Rings.length > 1 ? `Ring ${ringIdx + 1}` : null;
        const wgsLines = ring.map(([lon, lat]) => `${lon.toFixed(6)} ${lat.toFixed(6)}`);
        const { zone, hemisphere } = resolveSelectionZoneHemisphere(selection, ring);
        const utmLines = ring.map(([lon, lat]) => {
          const [x, y] = convertFromWGS84(lon, lat, 'UTM', zone, hemisphere);
          return `${x.toFixed(3)} ${y.toFixed(3)}`;
        });
        const utmHmLines = ring.map(([lon, lat]) => {
          const [x, y] = convertFromWGS84(lon, lat, 'UTM', zone, hemisphere);
          return `${formatUtmHectometric(x)} ${formatUtmHectometric(y)}`;
        });
        const zoneLabel = zone ? `zone ${zone}${hemisphere || ''}` : 'zone --';
        return [
          ringLabel,
          'WGS84:',
          ...wgsLines,
          `UTM Nord Sahara (${zoneLabel}):`,
          ...utmLines,
          `UTM Nord Sahara hectometrique (${zoneLabel}):`,
          ...utmHmLines
        ]
          .filter((line) => line && line.length)
          .join('\n');
      });
      return [`#${idx + 1} ${label} (coordonnees)`, ...ringBlocks].join('\n');
    })
    .join('\n\n');

  // Function to query mining titles that intersect with current polygon
  const queryMiningTitles = async (geometry?: any): Promise<any[] | null> => {
    if (!viewRef.current) return null;
    // Empiètement: on interroge uniquement les couches cochées
      const layersToQuery = {
        titres: !!activeLayers.titres,
        perimetresSig: !!activeLayers.perimetresSig,
        promotion: !!activeLayers.promotion,
        exclusions: !!activeLayers.exclusions,
        pays: !!activeLayers.pays,
      };
    const anyActive = Object.values(layersToQuery).some(Boolean);
    if (!anyActive) return [];

    try {
      // Prefer existing polygon geometry if available
      let queryGeometry = geometry;
      if (!queryGeometry && currentPolygonRef.current) {
        queryGeometry = currentPolygonRef.current;
      }
      if (!queryGeometry && points.length >= 3) {
        const validPoints = points.filter(p => !isNaN(p.x) && !isNaN(p.y));
        const wgs84Points = validPoints.map(point => convertToWGS84(point));
        queryGeometry = new Polygon({
          rings: [wgs84Points.map(coord => [coord[0], coord[1]])],
          spatialReference: { wkid: 4326 }
        });
      }
      if (!queryGeometry) return [];

      const geomJson = (queryGeometry as any).toJSON ? (queryGeometry as any).toJSON() : queryGeometry;
      const params = new URLSearchParams({
        f: 'json',
        geometry: JSON.stringify(geomJson),
        geometryType: 'esriGeometryPolygon',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'false',
        inSR: '4326',
        outSR: '4326'
      });

      const results: any[] = [];

      if (layersToQuery.titres) {
        const respTitres = await fetch(`${SIGAM_LAYERS.titres}/query?${params.toString()}`, { credentials: 'include' });
        const jsonTitres = await respTitres.json();
        const attrsTitres = Array.isArray(jsonTitres?.features)
          ? jsonTitres.features.map((f: any) => ({ ...(f?.attributes || {}), __layerType: 'titres' })).filter(Boolean)
          : [];
        results.push(...attrsTitres);
        try { console.log('Titres miniers - attributs reçus (query):', attrsTitres); } catch {}
      }

      if (layersToQuery.perimetresSig) {
        const respPerims = await fetch(`${SIGAM_LAYERS.perimetresSig}/query?${params.toString()}`, { credentials: 'include' });
        const jsonPerims = await respPerims.json();
        const attrsPerims = Array.isArray(jsonPerims?.features)
          ? jsonPerims.features.map((f: any) => ({ ...(f?.attributes || {}), __layerType: 'perimetresSig' })).filter(Boolean)
          : [];
        results.push(...attrsPerims);
        try { console.log('Périmètres SIG - attributs reçus (query):', attrsPerims); } catch {}
      }

      if (layersToQuery.promotion) {
        const respPromo = await fetch(`${SIGAM_LAYERS.promotion}/query?${params.toString()}`, { credentials: 'include' });
        const jsonPromo = await respPromo.json();
        const attrsPromo = Array.isArray(jsonPromo?.features)
          ? jsonPromo.features.map((f: any) => ({ ...(f?.attributes || {}), __layerType: 'promotion' })).filter(Boolean)
          : [];
        results.push(...attrsPromo);
        try { console.log('Promotion - attributs reçus (query):', attrsPromo); } catch {}
      }

        if (layersToQuery.pays) {
          const respPays = await fetch(`${SIGAM_LAYERS.pays}/query?${params.toString()}`, { credentials: 'include' });
          const jsonPays = await respPays.json();
          const attrsPays = Array.isArray(jsonPays?.features)
            ? jsonPays.features.map((f: any) => ({ ...(f?.attributes || {}), __layerType: 'pays' })).filter(Boolean)
            : [];
          results.push(...attrsPays);
          try { console.log('Pays - attributs reçus (query):', attrsPays); } catch {}
        }

      if (layersToQuery.exclusions) {
        const respExcl = await fetch(`${SIGAM_LAYERS.exclusions}/query?${params.toString()}`, { credentials: 'include' });
        const jsonExcl = await respExcl.json();
        const attrsExcl = Array.isArray(jsonExcl?.features)
          ? jsonExcl.features.map((f: any) => ({ ...(f?.attributes || {}), __layerType: 'exclusions' })).filter(Boolean)
          : [];
        results.push(...attrsExcl);
        try { console.log("Zones d'exclusion - attributs reçus (query):", attrsExcl); } catch {}
      }

      return results;
      
    } catch (error) {
      console.error('Error querying mining titles:', error);
      return null;
    }
  };

  // Search by code/permis_code and zoom to feature (cycles through matches)
  const searchAndZoom = async (layerKey: SigamLayerKey, fieldName: string, value: string): Promise<boolean> => {
    const view = viewRef.current;
    if (!view) return false;
    const trimmed = (value || '').trim();
    if (!trimmed) return false;

    const layerUrl = SIGAM_LAYERS[layerKey];
    if (!layerUrl) return false;
    const layerRef =
      layerKey === 'titres'
        ? titresLayerRef.current
        : layerKey === 'perimetresSig'
          ? perimetresSigLayerRef.current
          : null;

    const cacheKey = `${layerKey}:${trimmed}`;
    let cache = searchCacheRef.current[cacheKey];

    const zoomToFeature = async (feature: any, key: SigamLayerKey) => {
      if (!feature?.geometry) return false;
      const geom = feature.geometry as any;
      if (!geom) return false;
      const graphic = new Graphic({ geometry: geom, attributes: feature.attributes });
      const extent = (geom as any).extent || (geom as any).getExtent?.();
      const center = (geom as any).centroid ?? extent?.center;

      if (searchHighlightLayerRef.current) {
        searchHighlightLayerRef.current.removeAll();
        try {
          searchHighlightLayerRef.current.add(
            new Graphic({
              geometry: geom,
              symbol: {
                type: 'simple-fill',
                color: [0, 0, 0, 0],
                outline: { color: [255, 0, 0, 0.9], width: 2.5 },
              },
            } as any),
          );
        } catch {}
      }

      try {
        if (extent) {
          await viewRef.current!.goTo(extent.expand(1.6));
        } else if (center) {
          await viewRef.current!.goTo({
            target: center,
            zoom: Math.max(viewRef.current!.zoom ?? 8, 12),
          });
        } else {
          await viewRef.current!.goTo({
            target: graphic,
            zoom: Math.max(viewRef.current!.zoom ?? 8, 12),
          });
        }
      } catch {
        return false;
      }

      try {
        (viewRef.current as any).popup.open({
          features: [graphic],
          location: center ?? geom,
        });
      } catch {}

      if (key === 'titres') {
        const attrs = feature.attributes || null;
        setSelectedTitreAttributes(attrs);
        onTitreSelected?.(attrs);
      }

      return true;
    };

    const fetchFeatures = async () => {
      const safeVal = trimmed.replace(/'/g, "''");
      const numericValue = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
      const suffix = trimmed.match(/(\d+)$/)?.[1] || null;
      const fl = layerRef ?? new FeatureLayer({ url: layerUrl, outFields: ['*'] });
      let fieldDefs: any[] = [];

      try {
        await fl.load();
        fieldDefs = Array.isArray(fl.fields) ? fl.fields : [];
      } catch {
        fieldDefs = [];
      }

      const candidateFields = (() => {
        const base =
          layerKey === 'titres'
            ? [fieldName, 'code_permis', 'permis_code', 'code', 'permiscode', 'codepermis']
            : [fieldName];
        const seen = new Set<string>();
        const unique = base.filter((name) => {
          const lower = String(name).toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
        if (!fieldDefs.length) return { names: unique, defs: [] as any[] };
        const fieldMap = new globalThis.Map(
          fieldDefs.map((f) => [String(f.name).toLowerCase(), f]),
        );
        const extra = fieldDefs
          .map((f) => f?.name)
          .filter((name) => {
            const lower = String(name || '').toLowerCase();
            return (
              lower.includes('permis') ||
              lower.includes('permit') ||
              lower === 'code' ||
              lower.endsWith('_code') ||
              lower.startsWith('code_')
            );
          })
          .filter(Boolean);
        const merged = [...unique, ...extra].filter((name, idx, arr) => {
          const lower = String(name).toLowerCase();
          return arr.findIndex((n) => String(n).toLowerCase() === lower) === idx;
        });
        const defs = merged
          .map((name) => fieldMap.get(String(name).toLowerCase()))
          .filter(Boolean);
        const names = defs.length ? defs.map((d: any) => d.name) : merged;
        return { names, defs };
      })();

      const queryWithWhere = async (where: string) => {
        try {
          const res = await fl.queryFeatures({
            where,
            outFields: ['*'],
            returnGeometry: true,
            outSpatialReference: view?.spatialReference,
          });
          return res.features || [];
        } catch {
          return [];
        }
      };

      let feats: any[] = [];
      const stringDefs = candidateFields.defs.filter((def: any) =>
        String(def.type || '').toLowerCase().includes('string'),
      );
      const numberDefs = candidateFields.defs.filter((def: any) => {
        const type = String(def.type || '').toLowerCase();
        return (
          type.includes('integer') ||
          type.includes('double') ||
          type.includes('small') ||
          type.includes('oid')
        );
      });

      if (numericValue !== null) {
        const numFields = numberDefs.length ? numberDefs.map((d: any) => d.name) : candidateFields.names;
        const whereNum = numFields.map((name) => `${name} = ${numericValue}`).join(' OR ');
        if (whereNum) {
          feats = await queryWithWhere(whereNum);
        }
      }

      if (!feats.length) {
        const strFields = stringDefs.length ? stringDefs.map((d: any) => d.name) : candidateFields.names;
        const whereExact = strFields.map((name) => `${name} = '${safeVal}'`).join(' OR ');
        if (whereExact) {
          feats = await queryWithWhere(whereExact);
        }
      }

      if (!feats.length) {
        const strFields = stringDefs.length ? stringDefs.map((d: any) => d.name) : candidateFields.names;
        const whereContains = strFields.map((name) => `${name} LIKE '%${safeVal}%'`).join(' OR ');
        if (whereContains) {
          feats = await queryWithWhere(whereContains);
        }
      }

      if (!feats.length && suffix) {
        const strFields = stringDefs.length ? stringDefs.map((d: any) => d.name) : candidateFields.names;
        const whereSuffix = strFields.map((name) => `${name} LIKE '%${suffix}%'`).join(' OR ');
        if (whereSuffix) {
          feats = await queryWithWhere(whereSuffix);
        }
      }

      searchCacheRef.current[cacheKey] = { features: feats as any, index: 0, value: trimmed };
      return feats as any;
    };

    const features =
      cache?.value === trimmed && Array.isArray(cache.features) && cache.features.length
        ? cache.features
        : await fetchFeatures();
    if (!features || !features.length) {
      if (layerKey === 'perimetresSig') {
        const safeVal = trimmed.replace(/'/g, "''");
        const titresLayer =
          titresLayerRef.current ||
          new FeatureLayer({ url: SIGAM_LAYERS.titres, outFields: ['*'] });
        let titreFeatures: any[] = [];
        try {
          await titresLayer.load();
        } catch {}
        try {
          const res = await titresLayer.queryFeatures({
            where: `code = '${safeVal}' OR code LIKE '%${safeVal}%'`,
            outFields: ['*'],
            returnGeometry: true,
            outSpatialReference: view?.spatialReference,
          });
          titreFeatures = res.features || [];
        } catch {}

        if (titreFeatures.length && titreFeatures[0]?.geometry) {
          const perLayer =
            perimetresSigLayerRef.current ||
            new FeatureLayer({ url: SIGAM_LAYERS.perimetresSig, outFields: ['*'] });
          let perFeatures: any[] = [];
          try {
            await perLayer.load();
          } catch {}
          try {
            const res = await perLayer.queryFeatures({
              geometry: titreFeatures[0].geometry,
              spatialRelationship: 'intersects',
              outFields: ['*'],
              returnGeometry: true,
              outSpatialReference: view?.spatialReference,
            });
            perFeatures = res.features || [];
          } catch {}

          if (perFeatures.length) {
            const ok = await zoomToFeature(perFeatures[0], 'perimetresSig');
            if (ok) return true;
          }

          const okTitle = await zoomToFeature(titreFeatures[0], 'titres');
          if (okTitle) return true;
        }

        return await searchAndZoom('titres', 'code', trimmed);
      }
      return false;
    }

    const nextIndex = cache?.value === trimmed ? (cache.index + 1) % features.length : 0;
    searchCacheRef.current[cacheKey] = { features, index: nextIndex, value: trimmed };

    const target = features[nextIndex];
    const zoomOk = await zoomToFeature(target, layerKey);
    if (!zoomOk && layerKey === 'perimetresSig') {
      return await searchAndZoom('titres', 'code', trimmed);
    }
    return zoomOk;
  };
  const detectAdminLocation = async (geomPoint: Point) => {
    // Query using ArcGIS FeatureLayer API (handles auth/session automatically)
    const baseGeom: any = (currentPolygonRef.current || geomPoint) as any;
    const geometry =
      (baseGeom as any)?.extent?.center ||
      (baseGeom as any)?.centroid ||
      (geomPoint as any);
    if (!geometry) return;

    // Buffer a bit to be lenient on edge cases
    let queryGeometry: any = geometry;
    try {
      queryGeometry = geometryEngine.geodesicBuffer(geometry as any, 500, "meters");
    } catch {}

    const queryField = async (layerRef: any, fields: string[]) => {
      const layer = layerRef.current;
      if (!layer || !queryGeometry) return undefined;
      try {
        const result = await layer.queryFeatures({
          geometry: queryGeometry as any,
          spatialRelationship: 'intersects',
          outFields: ['*'],
          returnGeometry: false,
        } as any);
        const attrs = result?.features?.[0]?.attributes || {};
        const lower = Object.fromEntries(
          Object.entries(attrs || {}).map(([k, v]) => [k.toLowerCase(), v]),
        );
        for (const f of fields) {
          const val = lower[f.toLowerCase()];
          if (val !== undefined && val !== null && `${val}`.trim() !== '') {
            return `${val}`.trim();
          }
        }
        const firstString = Object.values(attrs || {}).find(
          (v) => typeof v === 'string' && v.trim() !== '',
        ) as string | undefined;
        return firstString?.trim();
      } catch (e) {
        console.warn(`Admin detection query failed for ${fields.join(',')}`, e);
        return undefined;
      }
    };

    const [wilaya, commune, ville] = await Promise.all([
      queryField(wilayasLayerRef, ['wilaya']),
      queryField(communesLayerRef, ['commune', 'nom', 'name']),
      queryField(villesLayerRef, ['city_name', 'admin_name', 'commune', 'wilaya']),
    ]);
    let loc = { wilaya, commune, ville };

    // Fallback: call backend PostGIS detector if nothing found from layers
    if (!wilaya && !commune && !ville && API_BASE) {
      try {
        const rings = (currentPolygonRef.current as any)?.rings?.[0];
        const wgsPoints =
          Array.isArray(rings) && rings.length
            ? rings.map((r: number[]) => ({ x: r[0], y: r[1], system: 'WGS84' }))
            : [];
        const resp = await fetch(`${API_BASE}/gis/admin-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wgsPoints.length
              ? { points: wgsPoints }
              : { x: geometry?.x, y: geometry?.y, system: 'WGS84' },
          ),
        });
        const json = await resp.json();
        loc = {
          wilaya: json?.wilaya ?? loc.wilaya,
          commune: json?.commune ?? loc.commune,
          ville: json?.ville ?? loc.ville,
        };
      } catch (e) {
        console.warn('Backend admin-location fallback failed', e);
      }
    }

    setDetectedAdmin(loc);
    try { onAdminDetected?.(loc); } catch {}
  };

  const detectAdminForCurrent = async () => {
    const poly = currentPolygonRef.current;
    if (!poly) return;
    const center = poly.extent?.center;
    if (center) {
      await detectAdminLocation(center as any);
    }
  };

  const zoomToCurrentPolygon = async () => {
    if (!viewRef.current) return;
    const poly = currentPolygonRef.current;
    if (poly) {
      viewRef.current.goTo(poly).catch(() => {});
      return;
    }

    const validPoints = points.filter((p) => !isNaN(p.x) && !isNaN(p.y));
    if (validPoints.length < 3) return;
    const wgs84Points = validPoints.map((point) => convertToWGS84(point));
    const polygon = new Polygon({
      rings: [wgs84Points.map((coord) => [coord[0], coord[1]])],
      spatialReference: { wkid: 4326 },
    });
    viewRef.current.goTo(polygon).catch(() => {});
  };

  useImperativeHandle(ref, () => ({
    getPoints: () => points,
    resetMap: () => {
      if (graphicsLayerRef.current) {
        graphicsLayerRef.current.removeAll();
      }
    },
    calculateArea: () => {
      if (points.length < 3) return 0;
      
      const validPoints = points.filter(p => !isNaN(p.x) && !isNaN(p.y));
      if (validPoints.length < 3) return 0;

      try {
        const coordinates = validPoints.map(point => {
          if (point.system === 'WGS84') {
            return [point.x, point.y];
          } else {
            return convertToWGS84(point);
          }
        });

        // Close the polygon if not closed
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const finalCoordinates = [...coordinates];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          finalCoordinates.push([...first]);
        }

        // Create ArcGIS polygon
        const polygon = new Polygon({
          rings: [finalCoordinates.map(coord => [coord[0], coord[1]])],
          spatialReference: { wkid: 4326 }
        });

        // Calculate area in square meters
        const area = geometryEngine.planarArea(polygon, 'square-meters');
        return area ? area / 10000 : 0; // Convert to hectares
      } catch (error) {
        console.error('Area calculation error:', error);
        return 0;
      }
    },
    getActiveLayers: () => ({ ...activeLayers }),
    toggleLayerPanel: () => setIsLayerPanelOpen((v) => !v),
    setLayerPanelOpen: (open: boolean) => setIsLayerPanelOpen(!!open),
    searchTitreByCode: (code: string) => searchAndZoom('titres', 'code', code),
    searchPerimetreByPermisCode: (code: string) => searchAndZoom('perimetresSig', 'permis_code', code),
    searchLayerFeature: (layerKey: SigamLayerKey, fieldName: string, value: string) =>
      searchAndZoom(layerKey, fieldName, value),
    detectAdminForCurrent,
    zoomToCurrentPolygon,
    queryMiningTitles
  }));

  const clearMeasurementTools = () => {
    const view = viewRef.current;
    if (!view) return;
    const distanceWidget = distanceMeasurementRef.current;
    if (distanceWidget) {
      try {
        distanceWidget.viewModel?.clear?.();
      } catch {}
      view.ui.remove(distanceWidget);
    }
    const areaWidget = areaMeasurementRef.current;
    if (areaWidget) {
      try {
        areaWidget.viewModel?.clear?.();
      } catch {}
      view.ui.remove(areaWidget);
    }
    setActiveMeasureTool('none');
  };

  const startMeasurement = (widget: DistanceMeasurement2D | AreaMeasurement2D | null) => {
    if (!widget) return;
    const vm = (widget as any)?.viewModel;
    if (typeof vm?.newMeasurement === 'function') {
      vm.newMeasurement();
      return;
    }
    if (typeof vm?.start === 'function') {
      vm.start();
    }
  };

  const toggleMeasurementTool = (tool: 'distance' | 'area') => {
    const view = viewRef.current;
    if (!view) return;
    if (activeMeasureTool === tool) {
      clearMeasurementTools();
      return;
    }
    clearMeasurementTools();
    try {
      if (tool === 'distance') {
        if (!distanceMeasurementRef.current) {
          distanceMeasurementRef.current = new DistanceMeasurement2D({ view } as any);
        } else {
          distanceMeasurementRef.current.view = view;
        }
        view.ui.add(distanceMeasurementRef.current, 'top-right');
        startMeasurement(distanceMeasurementRef.current);
      } else {
        if (!areaMeasurementRef.current) {
          areaMeasurementRef.current = new AreaMeasurement2D({ view } as any);
        } else {
          areaMeasurementRef.current.view = view;
        }
        view.ui.add(areaMeasurementRef.current, 'top-right');
        startMeasurement(areaMeasurementRef.current);
      }
      setActiveMeasureTool(tool);
    } catch (err) {
      console.warn('Failed to activate measurement tool', err);
    }
  };

  const toggleRotationTools = () => {
    const view = viewRef.current;
    if (!view) return;
    const nextEnabled = !rotationToolsEnabled;
    setRotationToolsEnabled(nextEnabled);
    try {
      view.constraints.rotationEnabled = nextEnabled;
    } catch {}
    if (nextEnabled) {
      if (!navigationToggleRef.current) {
        navigationToggleRef.current = new NavigationToggle({ view } as any);
      } else {
        navigationToggleRef.current.view = view as any;
      }
      if (!compassRef.current) {
        compassRef.current = new Compass({ view } as any);
      } else {
        compassRef.current.view = view as any;
      }
      view.ui.add(navigationToggleRef.current, 'top-right');
      view.ui.add(compassRef.current, 'top-right');
    } else {
      if (navigationToggleRef.current) view.ui.remove(navigationToggleRef.current);
      if (compassRef.current) view.ui.remove(compassRef.current);
      view.rotation = 0;
    }
  };

  const resetRotation = () => {
    const view = viewRef.current;
    if (!view) return;
    view.rotation = 0;
  };

  // Function to add Enterprise layers to the map
  const addEnterpriseLayers = async (map: Map) => {
    const layers = [];

    try {
      // Note: Do not add external MapImageLayer as a baselayer to avoid blocking map when ANAM DNS is unreachable.

      const titreLabelExpression =
        "var code = $feature.code; if (IsEmpty(code)) { code = $feature.code_permis; } " +
        "if (IsEmpty(code)) { code = $feature.permis_code; } return code;";
      const wilayaLabelExpression =
        "var name = $feature.wilaya; if (IsEmpty(name)) { name = $feature.nom; } " +
        "if (IsEmpty(name)) { name = $feature.name; } return name;";
      const communeLabelExpression =
        "var name = $feature.commune; if (IsEmpty(name)) { name = $feature.nom; } " +
        "if (IsEmpty(name)) { name = $feature.name; } return name;";

      // Add Titres (layer 1)
      const titresLayer = new FeatureLayer({
        url: SIGAM_LAYERS.titres,
        title: "Titres Miniers ANAM",
        outFields: ["*"],
        opacity: activeLayers.titres ? 0.7 : 0,
        popupTemplate: {
          title: "{typetitre} — {tnom}",
          content: [
            {
              type: 'fields',
              fieldInfos: [
                { fieldName: 'typetitre', label: 'Type' },
                { fieldName: 'codetype', label: 'Code Type' },
                { fieldName: 'code', label: 'Code' },
                { fieldName: 'idtitre', label: 'ID Titre' },
                { fieldName: 'tnom', label: 'Titulaire' },
                { fieldName: 'tprenom', label: 'Prénom titulaire' },
                { fieldName: 'substance1', label: 'Substance' },
                { fieldName: 'sig_area', label: 'Superficie (ha)' },
                { fieldName: 'wilaya', label: 'Wilaya' },
                { fieldName: 'daira', label: 'Daira' },
                { fieldName: 'commune', label: 'Commune' },
                { fieldName: 'carte', label: 'Carte' },
                { fieldName: 'lieudit', label: 'Lieu-dit' },
                { fieldName: 'dateoctroi', label: "Date d'octroi", format: { dateFormat: 'short-date' } as any },
                { fieldName: 'dateexpiration', label: 'Date d\'expiration', format: { dateFormat: 'short-date' } as any },
                { fieldName: 'objectid', label: 'OBJECTID' }
              ]
            }
          ] as any
        },
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [255, 0, 0, 0.3],
            outline: {
              color: [255, 0, 0],
              width: 2
            }
          }
        } as any
      });
      const titresOpacity = 0.7;
      (titresLayer as any).__sigamKey = 'titres';
      (titresLayer as any).__defaultOpacity = titresOpacity;
      titresLayer.opacity = activeLayers.titres ? titresOpacity : 0;
      titresLayer.visible = !!activeLayers.titres;
      try {
        await titresLayer.load();
        try {
          titresLayer.labelingInfo = [
            {
              labelExpressionInfo: { expression: titreLabelExpression },
              labelPlacement: "center-center",
              minScale: 0,
              maxScale: 5000000,
              symbol: {
                type: "text",
                color: [0, 0, 0, 0.95],
                haloColor: [255, 255, 255, 0.9],
                haloSize: 1,
                font: { size: 9, family: "Avenir Next", weight: "bold" },
              },
            },
            {
              labelExpressionInfo: { expression: titreLabelExpression },
              labelPlacement: "center-center",
              minScale: 5000000,
              maxScale: 1000000,
              symbol: {
                type: "text",
                color: [0, 0, 0, 0.95],
                haloColor: [255, 255, 255, 0.9],
                haloSize: 1.25,
                font: { size: 12, family: "Avenir Next", weight: "bold" },
              },
            },
            {
              labelExpressionInfo: { expression: titreLabelExpression },
              labelPlacement: "center-center",
              minScale: 1000000,
              maxScale: 0,
              symbol: {
                type: "text",
                color: [0, 0, 0, 0.95],
                haloColor: [255, 255, 255, 0.95],
                haloSize: 1.5,
                font: { size: 15, family: "Avenir Next", weight: "bold" },
              },
            },
          ] as any;
          titresLayer.labelsVisible = true;
        } catch {}
        try { titresLayer.popupTemplate = buildAllFieldsPopup(titresLayer, "Titres Miniers ANAM"); } catch {}
        map.add(titresLayer);
        layers.push(titresLayer);
        titresLayerRef.current = titresLayer;
      } catch (e) {
        console.warn('Skipped Titres Miniers layer: service unreachable.', e);
      }

      // Demandes (layer 0)
      const perimetresSigLayer = new FeatureLayer({
        url: SIGAM_LAYERS.perimetresSig,
        title: "Demandes",
        outFields: ["*"],
        popupTemplate: {
          title: "Demandes",
          content: [
            {
              type: 'fields',
              fieldInfos: [
                { fieldName: 'sigam_proc_id', label: 'Procédure' },
                { fieldName: 'sigam_permis_id', label: 'Permis ID' },
                { fieldName: 'permis_code', label: 'Code Permis' },
                { fieldName: 'permis_type_code', label: 'Type Code' },
                { fieldName: 'permis_type_label', label: 'Type Libellé' },
                { fieldName: 'permis_titulaire', label: 'Titulaire' },
                { fieldName: 'permis_area_ha', label: 'Superficie (ha)' },
                { fieldName: 'source', label: 'Source' },
                { fieldName: 'type_code', label: 'Type' },
                { fieldName: 'status', label: 'Statut' },
                { fieldName: 'created_at', label: 'Créé le', format: { dateFormat: 'short-date' } as any },
                { fieldName: 'updated_at', label: 'Mis à jour', format: { dateFormat: 'short-date' } as any },
                { fieldName: 'id', label: 'ID' }
              ]
            }
          ] as any
        },
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [0, 0, 255, 0.25],
            outline: {
              color: [0, 90, 200],
              width: 1.5
            }
          }
        } as any
      });
      const perimetresSigOpacity = 0.5;
      (perimetresSigLayer as any).__sigamKey = 'perimetresSig';
      (perimetresSigLayer as any).__defaultOpacity = perimetresSigOpacity;
      perimetresSigLayer.opacity = activeLayers.perimetresSig ? perimetresSigOpacity : 0;
      perimetresSigLayer.visible = !!activeLayers.perimetresSig;
      try {
        await perimetresSigLayer.load();
        try { perimetresSigLayer.popupTemplate = buildAllFieldsPopup(perimetresSigLayer, "Périmètres SIG"); } catch {}
        map.add(perimetresSigLayer);
        layers.push(perimetresSigLayer);
        perimetresSigLayerRef.current = perimetresSigLayer;
      } catch (e) {
        console.warn("Skipped Périmètres SIG layer: service unreachable.", e);
      }

      // Promotion (layer 2)
      const promotionLayer = new FeatureLayer({
        url: SIGAM_LAYERS.promotion,
        title: "Promotion",
        outFields: ["*"],
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [0, 0, 255, 0.2],
            outline: { color: [0, 0, 180], width: 1 }
          }
        } as any
      });
      const promotionOpacity = 0.5;
      (promotionLayer as any).__sigamKey = 'promotion';
      (promotionLayer as any).__defaultOpacity = promotionOpacity;
      promotionLayer.opacity = activeLayers.promotion ? promotionOpacity : 0;
      promotionLayer.visible = !!activeLayers.promotion;
      try {
        await promotionLayer.load();
        try { promotionLayer.popupTemplate = buildAllFieldsPopup(promotionLayer, "Promotion"); } catch {}
        map.add(promotionLayer);
        layers.push(promotionLayer);
      } catch (e) {
        console.warn("Skipped Promotion layer: service unreachable.", e);
      }

      // Pays (layer 7)
      const paysLayer = new FeatureLayer({
        url: SIGAM_LAYERS.pays,
        title: "Pays",
        outFields: ["*"],
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [255, 255, 0, 0.25],
            outline: { color: [200, 200, 0], width: 1 }
          }
        } as any
      });
      const paysOpacity = 0.5;
      (paysLayer as any).__sigamKey = 'pays';
      (paysLayer as any).__defaultOpacity = paysOpacity;
      paysLayer.opacity = activeLayers.pays ? paysOpacity : 0;
      paysLayer.visible = !!activeLayers.pays;
      try {
        await paysLayer.load();
        try { paysLayer.popupTemplate = buildAllFieldsPopup(paysLayer, "Pays"); } catch {}
        map.add(paysLayer);
        layers.push(paysLayer);
      } catch (e) {
        console.warn("Skipped Pays layer: service unreachable.", e);
      }

      // Wilayas (layer 5)
      const wilayasLayer = new FeatureLayer({
        url: SIGAM_LAYERS.wilayas,
        title: "Wilayas",
        outFields: ["*"],
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [0, 0, 0, 0.95], width: 2 }
          }
        } as any
      });
      const wilayasOpacity = 0.85;
      (wilayasLayer as any).__sigamKey = 'wilayas';
      (wilayasLayer as any).__defaultOpacity = wilayasOpacity;
      wilayasLayer.opacity = activeLayers.wilayas ? wilayasOpacity : 0;
      wilayasLayer.visible = !!activeLayers.wilayas;
      try {
        await wilayasLayer.load();
        try {
          wilayasLayer.labelingInfo = [
            {
              labelExpressionInfo: { expression: wilayaLabelExpression },
              labelPlacement: "always-horizontal",
              minScale: 0,
              maxScale: 0,
              symbol: {
                type: "text",
                color: [0, 0, 0, 0.95],
                haloColor: [255, 255, 255, 0.95],
                haloSize: 1.5,
                font: { size: 12, family: "Avenir Next", weight: "bold" },
              },
            },
          ] as any;
          wilayasLayer.labelsVisible = true;
        } catch {}
        try { wilayasLayer.popupTemplate = buildAllFieldsPopup(wilayasLayer, "Wilayas"); } catch {}
        map.add(wilayasLayer);
        layers.push(wilayasLayer);
        wilayasLayerRef.current = wilayasLayer;
      } catch (e) {
        console.warn("Skipped Wilayas layer: service unreachable.", e);
      }

      // Communes (layer 6)
      const communesLayer = new FeatureLayer({
        url: SIGAM_LAYERS.communes,
        title: "Communes",
        outFields: ["*"],
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [0, 0, 0, 0.85], width: 1 }
          }
        } as any
      });
      const communesOpacity = 0.7;
      (communesLayer as any).__sigamKey = 'communes';
      (communesLayer as any).__defaultOpacity = communesOpacity;
      communesLayer.opacity = activeLayers.communes ? communesOpacity : 0;
      communesLayer.visible = !!activeLayers.communes;
      try {
        await communesLayer.load();
        try {
          communesLayer.labelingInfo = [
            {
              labelExpressionInfo: { expression: communeLabelExpression },
              labelPlacement: "always-horizontal",
              minScale: 2000000,
              maxScale: 0,
              symbol: {
                type: "text",
                color: [0, 0, 0, 0.9],
                haloColor: [255, 255, 255, 0.95],
                haloSize: 1,
                font: { size: 10, family: "Avenir Next", weight: "bold" },
              },
            },
          ] as any;
          communesLayer.labelsVisible = true;
        } catch {}
        try { communesLayer.popupTemplate = buildAllFieldsPopup(communesLayer, "Communes"); } catch {}
        map.add(communesLayer);
        layers.push(communesLayer);
        communesLayerRef.current = communesLayer;
      } catch (e) {
        console.warn("Skipped Communes layer: service unreachable.", e);
      }

      // Villes (layer 7)
      const villesLayer = new FeatureLayer({
        url: SIGAM_LAYERS.villes,
        title: "Villes",
        outFields: ["*"],
      });
      const villesOpacity = 0.8;
      (villesLayer as any).__sigamKey = 'villes';
      (villesLayer as any).__defaultOpacity = villesOpacity;
      villesLayer.opacity = activeLayers.villes ? villesOpacity : 0;
      villesLayer.visible = !!activeLayers.villes;
      try {
        await villesLayer.load();
        try { villesLayer.popupTemplate = buildAllFieldsPopup(villesLayer, "Villes"); } catch {}
        map.add(villesLayer);
        layers.push(villesLayer);
        villesLayerRef.current = villesLayer;
      } catch (e) {
        console.warn("Skipped Villes layer: service unreachable.", e);
      }

      // Exclusions (layer 4)
      const exclusionLayer = new FeatureLayer({
        url: SIGAM_LAYERS.exclusions,
        title: "Zones d'exclusion",
        outFields: ["*"],
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [255, 165, 0, 0.25],
            outline: { color: [255, 140, 0], width: 1 }
          }
        } as any
      });
      const exclusionOpacity = 0.35;
      (exclusionLayer as any).__sigamKey = 'exclusions';
      (exclusionLayer as any).__defaultOpacity = exclusionOpacity;
      exclusionLayer.opacity = activeLayers.exclusions ? exclusionOpacity : 0;
      exclusionLayer.visible = !!activeLayers.exclusions;
      try {
        await exclusionLayer.load();
        try { exclusionLayer.popupTemplate = buildAllFieldsPopup(exclusionLayer, "Zones d'exclusion"); } catch {}
        map.add(exclusionLayer);
        layers.push(exclusionLayer);
      } catch (e) {
        console.warn("Skipped Zones d'exclusion layer: service unreachable.", e);
      }

      enterpriseLayersRef.current = layers;
      setEnterpriseLayers(layers);
      console.log(`ANAM Enterprise layers loaded: ${layers.length}/8`);

    } catch (error) {
      console.error("Error loading ANAM enterprise layers:", error);
    }
  };

  // Initialize ArcGIS Map with ANAM Enterprise services
  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMap = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      try {
        // Prefer ArcGIS basemap for clear ArcGIS look & feel
        // Fallbacks: Esri raster tiles -> OSM tiles
        let map: Map;
        try {
          const esriVectorBasemap = Basemap.fromId('topo-vector');
          await esriVectorBasemap!.load();
          map = new Map({ basemap: esriVectorBasemap });
        } catch (eVec) {
          console.warn('ArcGIS vector basemap unavailable; trying Esri raster tiles.', eVec);
          try {
            const esriRasterTiles = new WebTileLayer({
              urlTemplate: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
            });
            const esriRasterBasemap = new Basemap({ baseLayers: [esriRasterTiles], title: 'Esri World Topo Map' });
            map = new Map({ basemap: esriRasterBasemap });
          } catch (eRas) {
            console.warn('Esri raster tiles unavailable; falling back to OpenStreetMap.', eRas);
            const osmLayer = new WebTileLayer({ urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' });
            const osmBasemap = new Basemap({ baseLayers: [osmLayer], title: 'OpenStreetMap' });
            map = new Map({ basemap: osmBasemap });
          }
        }

        basemapCacheRef.current.standard = map.basemap ?? undefined;

        // Create map view centered on Algeria
        const view = new MapView({
          container: mapRef.current!,
          map: map,
          center: [2.632, 28.163], // Center of Algeria
          zoom: 6,
          constraints: {
            minZoom: 3,
            maxZoom: 20
          }
        });
        // Show ArcGIS UI components (Zoom, Attribution). Assets load from /assets
        try { (view.ui as any).components = ['zoom', 'attribution']; } catch {}

        // Add ANAM Enterprise layers (non-blocking; skipped if unreachable)
        if (!DISABLE_ENTERPRISE_LAYERS) {
          await addEnterpriseLayers(map);
        } else {
          console.warn('Enterprise layers are disabled by VITE_ARCGIS_DISABLE_ENTERPRISE=true');
        }

        // Create graphics layers for user drawings
        const mainGraphicsLayer = new GraphicsLayer();
        const markersLayer = new GraphicsLayer();
        const existingGraphicsLayer = new GraphicsLayer();
        const previewGraphicsLayer = new GraphicsLayer();
        const searchHighlightLayer = new GraphicsLayer({ elevationInfo: undefined } as any);
        const selectionLayer = new GraphicsLayer({ listMode: 'hide' });
        const fuseauxLayer = new GraphicsLayer({ listMode: 'hide' });
        try { (fuseauxLayer as any).popupEnabled = false; } catch {}
        
        map.add(mainGraphicsLayer);
        map.add(markersLayer);
        map.add(existingGraphicsLayer);
        map.add(previewGraphicsLayer);
        map.add(searchHighlightLayer);
        map.add(selectionLayer);
        map.add(fuseauxLayer);

        graphicsLayerRef.current = mainGraphicsLayer;
        markersLayerRef.current = markersLayer;
        existingPolygonsLayerRef.current = existingGraphicsLayer;
        previewLayerRef.current = previewGraphicsLayer;
        searchHighlightLayerRef.current = searchHighlightLayer;
        selectionLayerRef.current = selectionLayer;
        fuseauxLayerRef.current = fuseauxLayer;
        viewRef.current = view;

        // Set up click event
        view.on("click", (event) => {
          if (isDrawing && onMapClick) {
            const point = event.mapPoint;

            if (!point) return; // extra safeguard

            const lng = point.longitude ?? 0;
            const lat = point.latitude ?? 0;

            const converted = convertFromWGS84(
              lng,
              lat,
              coordinateSystem,
              utmZone,
              utmHemisphere
            );

            onMapClick(converted[0], converted[1]);
          }
          // Additionally, log attributes of any clicked feature (Titres or Demandes)
          try {
            const layerRefs = [titresLayerRef.current, perimetresSigLayerRef.current, ...enterpriseLayersRef.current].filter(Boolean);
            const needsHitTest = enableSelectionTools || layerRefs.length;
            if (!needsHitTest) return;

            (view as any).hitTest(event).then((response: any) => {
              const results: any[] = (response?.results || []);

              if (enableSelectionTools && !isDrawing) {
                const nativeEvt = (event as any)?.native;
                const isMultiSelect = !!(nativeEvt?.shiftKey || nativeEvt?.ctrlKey || nativeEvt?.metaKey);
                const polygonResult = results.find(
                  (r: any) =>
                    r?.graphic?.geometry?.type === 'polygon' &&
                    isSelectableGraphic(r?.graphic, layerRefs)
                );
                const graphic = polygonResult?.graphic as Graphic | undefined;
                if (graphic?.geometry && graphic.geometry.type === 'polygon') {
                  const polygon = graphic.geometry as Polygon;
                  const wgs84Rings = extractWgs84Rings(polygon);
                  if (wgs84Rings.length) {
                    const key = getGraphicKey(graphic);
                    const layer = graphic.layer as any;
                    setSelectedPolygons((prev) => {
                      const exists = prev.find((sel) => sel.key === key);
                      if (isMultiSelect) {
                        if (exists) return prev.filter((sel) => sel.key !== key);
                        return [
                          ...prev,
                          {
                            key,
                            layerId: layer?.id,
                            layerTitle: layer?.title,
                            attributes: graphic.attributes,
                            geometry: polygon,
                            wgs84Rings
                          }
                        ];
                      }
                      return [
                        {
                          key,
                          layerId: layer?.id,
                          layerTitle: layer?.title,
                          attributes: graphic.attributes,
                          geometry: polygon,
                          wgs84Rings
                        }
                      ];
                    });
                  }
                }
              }

              const filtered = results.filter((r: any) => {
                const lyr: any = r?.graphic?.layer;
                if (!lyr) return false;
                return layerRefs.some(ref => lyr.id === ref?.id);
              });

              if (!filtered.length) return;

              const graphics = filtered.map(f => f.graphic).filter(Boolean);
              if (graphics.length) {
                try {
                  (view as any).popup.open({
                    features: graphics,
                    location: event.mapPoint
                  });
                } catch {}
              }

              const clickLon = event?.mapPoint?.longitude;
              const clickLat = event?.mapPoint?.latitude;
              const clickZone = deriveUtmZoneFromLon(clickLon);
              const clickHemisphere = deriveHemisphereFromLat(clickLat);

              filtered.forEach(res => {
                const attrs = res?.graphic?.attributes || null;
                const enrichedAttrs =
                  attrs && clickZone
                    ? {
                        ...attrs,
                        __utm_zone: (attrs as any).__utm_zone ?? clickZone,
                        __utm_hemisphere:
                          (attrs as any).__utm_hemisphere ?? clickHemisphere,
                      }
                    : attrs;
                try { console.log('Clic couche SIGAM - attributs:', attrs); } catch {}
                if (res?.graphic?.layer?.id === titresLayerRef.current?.id && attrs) {
                  setSelectedTitreAttributes(attrs);
                  if (onTitreSelected) onTitreSelected(enrichedAttrs);
                }
                // Propagate perimeter selection as well (reuse onTitreSelected handler upstream)
                if (res?.graphic?.layer?.id === perimetresSigLayerRef.current?.id && attrs) {
                  if (onTitreSelected) onTitreSelected(enrichedAttrs);
                }
              });
            }).catch(() => {});
          } catch {}
        });

        await view.when();

        // Initialize Sketch for in-map editing (update-only)
        try {
          if (!sketchRef.current) {
            const sk = new Sketch({
              view,
              layer: graphicsLayerRef.current!,
              visibleElements: {
                createTools: { point: false, polyline: false, polygon: false, circle: false, rectangle: false },
                selectionTools: { 'lasso-selection': false, 'rectangle-selection': false },
                settingsMenu: false
              }
            });
            // Attach to UI in top-left, default hidden via state
            (sk as any).visible = false;
            view.ui.add(sk, 'top-left');
            // Propagate edits back to parent
            sk.on('update', (evt: any) => {
              try {
                if (!evt.graphics || !evt.graphics.length) return;
                const g = evt.graphics[0] as Graphic;
                const geom = g.geometry as any;
                if (geom?.type === 'polygon') {
                  const rings = (geom as Polygon).rings?.[0] || [];
                  const coords: [number, number][] = rings.map(([lng, lat]: number[]) => {
                    const [x, y] = convertFromWGS84(lng, lat, coordinateSystem, utmZone, utmHemisphere);
                    return [x, y];
                  });
                  // Remove duplicate last vertex if closed
                  if (coords.length > 1) {
                    const f = coords[0];
                    const l = coords[coords.length - 1];
                    if (f[0] === l[0] && f[1] === l[1]) coords.pop();
                  }
                  onPolygonChange?.(coords);
                }
              } catch {}
            });
            sketchRef.current = sk;
          }
        } catch {}

        setIsMapReady(true);
        
        console.log("ANAM ArcGIS Enterprise Map initialized successfully");

      } catch (error) {
        console.error("Error initializing ANAM ArcGIS Enterprise map:", error);
      }
    };

    initializeMap();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!isMapReady) return;
    applyBasemap(basemapMode);
  }, [isMapReady, basemapMode, applyBasemap]);

  // Update layer visibility when activeLayers changes
  useEffect(() => {
    if (!enterpriseLayers.length) return;

    enterpriseLayers.forEach((layer: any) => {
      const key = layer?.__sigamKey as string | undefined;
      if (!key || !(key in activeLayers)) return;

      const defaultOpacity =
        typeof layer.__defaultOpacity === 'number'
          ? layer.__defaultOpacity
          : (typeof layer.opacity === 'number' ? layer.opacity : 1);

      const isActive = !!activeLayers[key];
      layer.opacity = isActive ? defaultOpacity : 0;
      if (typeof layer.visible === 'boolean') {
        layer.visible = isActive;
      }
    });
  }, [activeLayers, enterpriseLayers]);

  useEffect(() => {
    if (!selectionLayerRef.current) return;
    const layer = selectionLayerRef.current;
    layer.removeAll();
    if (!enableSelectionTools || !selectedPolygons.length) return;
    const symbol = new SimpleFillSymbol({
      color: [37, 99, 235, 0.15],
      outline: { color: [29, 78, 216, 0.95], width: 2 }
    });
    selectedPolygons.forEach((selection) => {
      layer.add(new Graphic({ geometry: selection.geometry, symbol }));
    });
  }, [enableSelectionTools, selectedPolygons]);

  // Update drawing mode
  useEffect(() => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    
    if (isDrawing) {
      view.container!.style.cursor = 'crosshair';
    } else {
      view.container!.style.cursor = 'grab';
    }
  }, [isDrawing]);

  // Update existing polygons
  useEffect(() => {
    if (!existingPolygonsLayerRef.current || !isMapReady) return;

    const layer = existingPolygonsLayerRef.current;
    layer.removeAll();
    let firstPolygon: Polygon | null = null;

    existingPolygons.forEach(({ idProc, num_proc, coordinates, zone: polyZone, hemisphere: polyHemisphere, isWGS }) => {
      if (selectedExistingProcId !== null && idProc !== selectedExistingProcId) {
        return;
      }
      try {
        if (!coordinates || coordinates.length < 3) {
          console.warn('Invalid polygon data for:', num_proc);
          return;
        }

        let wgs84Coords: [number, number][] = [];

        if (isWGS) {
          // Already WGS84 (gis_perimeters): keep as-is
          wgs84Coords = coordinates.map((c) => [c[0], c[1]] as [number, number]);
        } else {
          // ProcedureCoord stored in UTM meters: reproject using fuseau from data or UI
          const z = polyZone ?? utmZone;
          const hem = polyHemisphere ?? utmHemisphere;
          const sourceProj =
            // `+proj=utm +zone=${z} +a=6378249.138 +b=6356514.9999 +units=m ` +
            // `+k=0.9996 +x_0=500000 +y_0=0 +no_defs`;
            `+proj=utm +zone=${z} +a=6378249.145 +b=6356514.869 +units=m ` +
            `+k=0.9996 +x_0=500000 +y_0=0 ` +
            `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
            `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
            `+no_defs`;
          wgs84Coords = coordinates.map((coord) => {
            const [lng, lat] = proj4.default(sourceProj, 'EPSG:4326', [coord[0], coord[1]]);
            return [lng, lat] as [number, number];
          });
        }
        // Ensure ring is closed
        if (wgs84Coords.length >= 3) {
          const first = wgs84Coords[0];
          const last = wgs84Coords[wgs84Coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            wgs84Coords.push(first);
          }
        }

        const polygon = new Polygon({
          rings: [wgs84Coords],
          spatialReference: { wkid: 4326 }
        });
        currentPolygonRef.current = polygon;

        const fillSymbol = new SimpleFillSymbol({
          color: [128, 0, 128, 0.2],
          outline: {
            color: [128, 0, 128, 0.7],
            width: 2,
            style: "dash"
          }
        });

        const polygonGraphic = new Graphic({
          geometry: polygon,
          symbol: fillSymbol,
          attributes: {
            num_proc: num_proc
          },
          popupTemplate: {
            title: "Procédure Existante",
            content: `Numéro de procédure: ${num_proc}`
          }
        });

        layer.add(polygonGraphic);
        currentPolygonRef.current = polygon;
        if (!firstPolygon) firstPolygon = polygon;
      } catch (error) {
        console.error('Failed to create existing polygon:', num_proc, error);
      }
    });

    if (!firstPolygon && existingPolygons.length > 0) {
      if (typeof window !== 'undefined') {
        window.alert('Aucune coordonnée exploitable pour ce périmètre.');
      }
      return;
    }

    // Zoom to the currently displayed existing polygon and detect admin location
    if (firstPolygon) {
      try {
        // Cast to any to avoid TypeScript inferring an unexpected 'never' type on firstPolygon
        const target: any = (firstPolygon as any).extent ?? (firstPolygon as any);
        const isValidExtent =
          target &&
          isFinite(target.xmin) &&
          isFinite(target.xmax) &&
          isFinite(target.ymin) &&
          isFinite(target.ymax);
        if (isValidExtent) {
          viewRef.current?.goTo(target).catch(() => {});
        } else {
          console.warn('Invalid extent for polygon, skipping goTo');
          if (typeof window !== 'undefined') {
            window.alert('Aucune coordonnée exploitable pour ce périmètre.');
          }
          return;
        }
      } catch {}

      (async () => {
        try {
          const poly = firstPolygon as Polygon;
          // Use a safe access pattern for extent/center and fall back to centroid if available
          const center = (poly as any).extent?.center ?? (poly as any).centroid;
          if (center) await detectAdminLocation(center as any);
        } catch {}
      })();
    }
  }, [existingPolygons, isMapReady, coordinateSystem, utmZone, utmHemisphere, selectedExistingProcId]);

  // Toggle/display UTM fuseaux bands (29-32)
  useEffect(() => {
    if (!fuseauxLayerRef.current || !isMapReady) return;
    const layer = fuseauxLayerRef.current;
    layer.removeAll();
    layer.visible = showFuseaux;
    if (!showFuseaux) return;

    const zones = [
      { id: 29, minLng: -12, maxLng: -6 },
      { id: 30, minLng: -6, maxLng: 0 },
      { id: 31, minLng: 0, maxLng: 6 },
      { id: 32, minLng: 6, maxLng: 12 },
    ];
    const latMin = 18;
    const latMax = 38;

    zones.forEach((z) => {
      const poly = new Polygon({
        rings: [[
          [z.minLng, latMin],
          [z.maxLng, latMin],
          [z.maxLng, latMax],
          [z.minLng, latMax],
          [z.minLng, latMin],
        ]],
        spatialReference: { wkid: 4326 },
      });
      const graphic = new Graphic({
        geometry: poly,
        attributes: { zone: z.id },
        symbol: new SimpleFillSymbol({
          color: [120, 168, 255, 0.05],
          outline: {
            color: [70, 120, 200, 0.8],
            width: 1,
            style: 'dash',
          },
        }),
      });
      layer.add(graphic);
    });
  }, [showFuseaux, isMapReady]);

  // Preview polygons (e.g., union preview)
  useEffect(() => {
    if (!previewLayerRef.current || !isMapReady) return;
    const layer = previewLayerRef.current;
    layer.removeAll();
    if (!previewPolygons || previewPolygons.length === 0) return;

    previewPolygons.forEach(({ coordinates, label, color }) => {
      if (!coordinates || coordinates.length < 3) return;
      try {
        const wgs84Coords = coordinates.map(coord => {
          const tempPoint: Coordinate = {
            id: 0,
            idTitre: 0,
            h: 0,
            x: coord[0],
            y: coord[1],
            system: coordinateSystem,
            zone: coordinateSystem === 'UTM' ? utmZone : undefined,
            hemisphere: coordinateSystem === 'UTM' ? utmHemisphere : undefined
          };
          return convertToWGS84(tempPoint);
        });

        const polygon = new Polygon({
          rings: [wgs84Coords.map(([lng, lat]) => [lng, lat])],
          spatialReference: { wkid: 4326 }
        });

        const fillSymbol = new SimpleFillSymbol({
          color: color ? [color[0], color[1], color[2], color[3] ?? 0.2] : [34, 197, 94, 0.2],
          outline: {
            color: color ? [color[0], color[1], color[2], 0.9] : [22, 163, 74, 0.9],
            width: 2,
            style: 'dash'
          }
        });

        const polygonGraphic = new Graphic({
          geometry: polygon,
          symbol: fillSymbol,
          attributes: {
            label: label || 'Union'
          },
          popupTemplate: {
            title: label || 'Union',
            content: label || 'Union previsionnelle'
          }
        });

        layer.add(polygonGraphic);
      } catch (err) {
        console.warn('Failed to draw preview polygon', err);
      }
    });
  }, [previewPolygons, isMapReady, coordinateSystem, utmZone, utmHemisphere]);

  // Update current polygon and points
  useEffect(() => {
    if (!graphicsLayerRef.current || !isMapReady) return;

    const layer = graphicsLayerRef.current;
    layer.removeAll();

    try {
      const validPoints = points.filter(p => !isNaN(p.x) && !isNaN(p.y));
      const wgs84Points = validPoints.map(point => convertToWGS84(point));

      // Add polygon if we have enough points
      if (wgs84Points.length >= 3) {
        const polygon = new Polygon({
          rings: [wgs84Points.map(coord => [coord[0], coord[1]])],
          spatialReference: { wkid: 4326 }
        });
        currentPolygonRef.current = polygon;

        const fillSymbol = new SimpleFillSymbol({
          color: [37, 99, 235, 0.3],
          outline: {
            color: [37, 99, 235, 1],
            width: 2
          }
        });

        const polygonGraphic = new Graphic({
          geometry: polygon,
          symbol: fillSymbol,
          popupTemplate: {
            title: "Nouveau Périmètre Minier",
            content: `
              <div class="popup-content">
                <p><strong>Superficie:</strong> ${superficie.toLocaleString()} ha</p>
                <p><strong>Nombre de points:</strong> ${points.length}</p>
                <p><strong>Système de coordonnées:</strong> ${coordinateSystem}</p>
                ${utmZone ? `<p><strong>Zone UTM:</strong> ${utmZone}</p>` : ''}
              </div>
            `
          }
        });

        layer.add(polygonGraphic);

        // Detect administrative location based on polygon centroid
        // Detect administrative location based on polygon centroid
        (async () => {
          try {
            const center = polygon.extent?.center;
            if (center) {
              await detectAdminLocation(center as any);
            }
          } catch {}
        })();

        // Add label inside polygon (demande code)
        try {
          const center = polygon.extent?.center;
          if (center && labelText) {
            const label = String(labelText || '').trim();
            if (label.length > 0) {
              const textSymbol = new TextSymbol({
                text: label,
                color: [0, 0, 0, 1],
                haloColor: [255, 255, 255, 1],
                haloSize: 2,
                font: { size: 12, family: 'Arial', weight: 'bold' } as any
              });
              const textGraphic = new Graphic({
                geometry: center,
                symbol: textSymbol
              });
              layer.add(textGraphic);
            }
          }
        } catch {}

        // Zoom to polygon only once per lifecycle to avoid
        // constantly re-centering when the user manually changes zoom.
        if (viewRef.current && wgs84Points.length > 0 && !hasZoomedToPolygonRef.current) {
          hasZoomedToPolygonRef.current = true;
          viewRef.current.goTo(polygon).catch(() => {
            // Ignore zoom errors
          });
        }
      }

      // Add point markers
      validPoints.forEach((point, index) => {
        const [lng, lat] = convertToWGS84(point);
        const mapPoint = new Point({
          longitude: lng,
          latitude: lat,
          spatialReference: { wkid: 4326 }
        });

        const markerSymbol = new SimpleMarkerSymbol({
          color: [37, 99, 235],
          outline: {
            color: [255, 255, 255],
            width: 2
          },
          size: 12
        });

        const markerGraphic = new Graphic({
          geometry: mapPoint,
          symbol: markerSymbol,
          attributes: {
            pointId: point.id,
            index: index + 1
          },
          popupTemplate: {
            title: `Point ${index + 1}`,
            content: `
              <div class="popup-content">
                <p><strong>ID:</strong> ${point.id}</p>
                <p><strong>X:</strong> ${point.x.toFixed(2)}</p>
                <p><strong>Y:</strong> ${point.y.toFixed(2)}</p>
                <p><strong>Système:</strong> ${point.system}</p>
                ${point.zone ? `<p><strong>Zone:</strong> ${point.zone}</p>` : ''}
              </div>
            `
          }
        });

        layer.add(markerGraphic);
      });

    } catch (error) {
      console.error('Error updating map graphics:', error);
    }
  }, [points, isMapReady, coordinateSystem, utmZone, utmHemisphere, superficie]);

  // Layer toggle handler
  const toggleLayer = (layerName: string) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerName]: !prev[layerName]
    }));
  };

  // Export current map view to PNG
  const exportPNG = async () => {
    if (!viewRef.current) return;
    try {
      setIsExporting(true);
      const shot: any = await (viewRef.current as any).takeScreenshot({ format: 'png', quality: 1 });
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = shot?.dataUrl || shot?.dataUrl; // ArcGIS returns dataUrl
      const code = selectedTitreAttributes?.code || selectedTitreAttributes?.idtitre || 'site-minier';
      a.download = `capture-${code}-${ts}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Erreur export PNG:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // Export PDF via ArcGIS Printing Service
  const exportPDF = async () => {
    if (!viewRef.current) return;
    try {
      setIsExporting(true);
      const taskUrl = `${enterpriseServices.printingService}/Export%20Web%20Map%20Task`;
      // Compose a title from selected attributes when possible
      const typ = selectedTitreAttributes?.typetitre || selectedTitreAttributes?.codetype || 'Titre minier';
      const code = selectedTitreAttributes?.code ?? selectedTitreAttributes?.idtitre ?? selectedTitreAttributes?.objectid ?? '';
      const titulaire = [selectedTitreAttributes?.tnom, selectedTitreAttributes?.tprenom].filter(Boolean).join(' ').trim();
      const titleText = `${typ} ${selectedTitreAttributes?.codetype || ''} ${code}`.replace(/\s+/g, ' ').trim();

      // Use precomputed overlaps when available to avoid slow remote queries during export.
      const overlapsForPrint: any[] = Array.isArray(overlapTitles) ? overlapTitles : [];
      const overlapCount = overlapsForPrint?.length || 0;
      const overlapList = (overlapsForPrint || []).slice(0, 8).map((t: any, i: number) => {
        const ttyp = t.typetitre || t.codetype || 'Titre';
        const tcode = t.code ?? t.idtitre ?? t.objectid ?? '';
        const ttit = [t.tnom, t.tprenom].filter(Boolean).join(' ').trim();
        const tloc = [t.wilaya, t.daira, t.commune].filter(Boolean).join(' / ');
        return `${i+1}. ${ttyp} ${t.codetype || ''} ${tcode}${ttit ? ' — ' + ttit : ''}${tloc ? ' — ' + tloc : ''}`.replace(/\s+/g,' ').trim();
      }).join('\n');

      const template = new PrintTemplate({
        format: 'pdf',
        layout: 'a4-portrait',
        exportOptions: { dpi: 96 } as any,
        layoutOptions: {
          titleText: titleText || 'Carte des titres miniers',
          authorText: titulaire || 'ANAM',
          // Custom text elements are used when the server layout supports them; safe to include
          customTextElements: [
            { label: 'Code Demande', value: (adminInfo as any)?.codeDemande ?? (labelText || '') },
            { label: 'Type permis', value: (adminInfo as any)?.typePermis ?? (selectedTitreAttributes?.typetitre || '') },
            { label: 'Titulaire', value: (adminInfo as any)?.titulaire ?? titulaire },
            { label: 'Wilaya', value: (adminInfo as any)?.wilaya ?? selectedTitreAttributes?.wilaya ?? '' },
            { label: 'Daira', value: (adminInfo as any)?.daira ?? selectedTitreAttributes?.daira ?? '' },
            { label: 'Commune', value: (adminInfo as any)?.commune ?? selectedTitreAttributes?.commune ?? '' },
            { label: 'Substance', value: selectedTitreAttributes?.substance1 || selectedTitreAttributes?.substances || '' },
            { label: 'Superficie (ha)', value: selectedTitreAttributes?.sig_area || superficie || '' },
            { label: 'Chevauchements (compte)', value: String(overlapCount) },
            { label: 'Chevauchements (liste)', value: overlapList }
          ] as any
        } as any
      });

      const params = new PrintParameters({
        view: viewRef.current!,
        template
      } as any);

      const result: any = await new Promise((resolve, reject) => {
        const timeoutMs = 8000;
        const to = setTimeout(() => reject(new Error('Print service timeout')), timeoutMs);
        (print as any)
          .execute(taskUrl, params as any)
          .then((r: any) => {
            clearTimeout(to);
            resolve(r);
          })
          .catch((e: any) => {
            clearTimeout(to);
            reject(e);
          });
      });
      if (result?.url) {
        const a = document.createElement('a');
        a.href = result.url;
        const ts = new Date().toISOString().substring(0,19).replace(/[:T]/g, '-');
        const codePart = code ? `-${code}` : '';
        a.download = `rapport-titre${codePart}-${ts}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        console.warn('Aucune URL de PDF retournée par le service de cartographie.');
      }
    } catch (e) {
      console.error('Erreur export PDF:', e);
      // Fallback to client-side PDF composition when server print fails
      try {
        await exportClientPDF();
      } catch (e2) {
        console.error('Erreur export PDF (fallback):', e2);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Client-side PDF composition fallback (screenshot + attributes)
  const exportClientPDF = async () => {
    if (!viewRef.current) return;
    const view = viewRef.current as any;

    const shot: any = await view.takeScreenshot({ format: 'jpg', quality: 0.85 });
    const dataUrl: string = shot?.dataUrl || '';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Agence Nationale des Activités Minières', pageWidth / 2, margin, { align: 'center' });
    doc.setFontSize(12);
    const typ = selectedTitreAttributes?.typetitre || selectedTitreAttributes?.codetype || 'Titre minier';
    const code = selectedTitreAttributes?.code ?? selectedTitreAttributes?.idtitre ?? selectedTitreAttributes?.objectid ?? '';
    const titleLine = `${typ}${selectedTitreAttributes?.codetype ? ' ' + selectedTitreAttributes.codetype : ''}${code ? ' — ' + code : ''}`.replace(/\s+/g, ' ').trim();
    doc.text(titleLine || 'Rapport du Titre Minier', pageWidth / 2, margin + 7, { align: 'center' });

    // Map image
    let y = margin + 14;
    try {
      if (dataUrl) {
        const imgW = pageWidth - margin * 2;
        // Estimate height using screenshot aspect ratio when available
        const sW = shot?.width || 1600;
        const sH = shot?.height || 900;
        const imgH = Math.min((imgW * sH) / sW, pageHeight * 0.45);
        const imgFormat = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(dataUrl, imgFormat as any, margin, y, imgW, imgH, undefined, 'FAST');
        y += imgH + 6;
      }
    } catch {}

    // Helpers
    const fmtNum = (n: any, fractionDigits = 1) => {
      const v = Number(n);
      if (!isFinite(v)) return '';
      try { return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(v); } catch { return String(v); }
    };
    const yesNo = (b: any) => (b ? 'Oui' : 'Non');
    const stripUnsupported = (s: any) => {
      if (typeof s !== 'string') return s ?? '';
      try { return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0000-\u001F]/g, ' ').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ''); } catch { return s; }
    };

    // Attributes table (site minier)
    const titulaire = [selectedTitreAttributes?.tnom, selectedTitreAttributes?.tprenom].filter(Boolean).join(' ').trim();
    const location = [selectedTitreAttributes?.wilaya, selectedTitreAttributes?.daira, selectedTitreAttributes?.commune].filter(Boolean).join(' / ');
    const admin = {
      codeDemande: (adminInfo as any)?.codeDemande ?? (labelText || ''),
      typePermis: (adminInfo as any)?.typePermis ?? '',
      titulaire: (adminInfo as any)?.titulaire ?? titulaire,
      wilaya: (adminInfo as any)?.wilaya ?? selectedTitreAttributes?.wilaya ?? '',
      daira: (adminInfo as any)?.daira ?? selectedTitreAttributes?.daira ?? '',
      commune: (adminInfo as any)?.commune ?? selectedTitreAttributes?.commune ?? ''
    };
    const formatDate = (v: any) => {
      try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-DZ'); } catch {}
      return '';
    };
    const rowsAdmin: Array<[string, string]> = [
      ['Code demande', stripUnsupported(admin.codeDemande)],
      ['Type permis', stripUnsupported(admin.typePermis || (selectedTitreAttributes?.typetitre || ''))],
      ['Titulaire', stripUnsupported(admin.titulaire)],
      ['Wilaya', stripUnsupported(admin.wilaya)],
      ['Daira', stripUnsupported(admin.daira)],
      ['Commune', stripUnsupported(admin.commune)]
    ];
    const detectedLieu = [detectedAdmin.ville, detectedAdmin.commune, detectedAdmin.wilaya].filter(Boolean).join(' / ');
    if (detectedLieu) {
      rowsAdmin.push(['Lieu détecté', stripUnsupported(detectedLieu)]);
    }
    const rowsTech: Array<[string, string]> = [
      ['Nombre de points', String((points || []).length)],
      ['Superficie (ha)', fmtNum(selectedTitreAttributes?.sig_area || superficie, 1)],
      ['Superficie déclarée (ha)', (typeof (declaredAreaHa) !== 'undefined' ? fmtNum(declaredAreaHa, 1) : '')],
      ['Situation géographique OK', yesNo((validationSummary as any)?.sitGeoOk)],
      ['Absence d\'empiétements', yesNo((validationSummary as any)?.empietOk)],
      ['Géométrie correcte', yesNo((validationSummary as any)?.geomOk)],
      ['Superficie conforme', yesNo((validationSummary as any)?.superfOk)]
    ];

    // Build administrative table
    try {
      (autoTable as any)(doc, {
        head: [[{ content: 'Informations administratives', colSpan: 2, styles: { halign: 'center' } }]],
        body: rowsAdmin.map(([k, v]) => [k, v]),
        startY: y,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 'auto' } }
      });
    } catch {
      // graceful degrade: write key-values as simple text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let yy = y + 6;
      rowsAdmin.forEach(([k, v]) => { doc.text(`${k}: ${v}`, margin, yy); yy += 5; });
    }

    // Caractéristiques techniques
    let nextY = (doc as any)?.lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : (y + 20);
    try {
      (autoTable as any)(doc, {
        head: [[{ content: 'Caractéristiques techniques', colSpan: 2, styles: { halign: 'center' } }]],
        body: rowsTech.map(([k, v]) => [k, v]),
        startY: nextY,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 'auto' } }
      });
    } catch {
      // ignore if autotable unavailable
    }

    // Chevauchements avec Titres Miniers ANAM
    nextY = (doc as any)?.lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : (nextY + 20);
    try {
      const overlaps = Array.isArray(overlapTitles) ? overlapTitles : null;
      if (overlaps && overlaps.length) {
        const overlapRows = overlaps.slice(0, 50).map((t: any, idx: number) => {
          const ttyp = t.typetitre || t.codetype || 'Titre';
          const tcode = t.code ?? t.idtitre ?? t.objectid ?? '';
          const ttit = [t.tnom, t.tprenom].filter(Boolean).join(' ').trim();
          const tloc = [t.wilaya, t.daira, t.commune].filter(Boolean).join(' / ');
          return [String(idx + 1), stripUnsupported(`${ttyp} ${t.codetype || ''}`.replace(/\s+/g,' ').trim()), String(tcode), stripUnsupported(ttit || ''), stripUnsupported(tloc || '')];
        });
        (autoTable as any)(doc, {
          head: [[{ content: `Chevauchements détectés (${overlaps.length})`, colSpan: 5, styles: { halign: 'center' } }], ['#', 'Type', 'Code', 'Titulaire', 'Localisation']],
          body: overlapRows,
          startY: nextY,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 9 },
          headStyles: { fillColor: [31, 41, 55], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 }, 2: { cellWidth: 25 }, 3: { cellWidth: 55 }, 4: { cellWidth: 'auto' } }
        });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.text('Chevauchements détectés (0)', margin, nextY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Aucun empiètement détecté avec les titres miniers ANAM.', margin, nextY + 6);
      }
    } catch (e) {
      // If the service is unreachable, add a note
      doc.setFont('helvetica', 'bold');
      doc.text('Chevauchements — Information indisponible', margin, nextY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`La vérification des chevauchements n'a pas pu être effectuée.`, margin, nextY + 6);
    }

    // Footer
    try {
      doc.setFontSize(8);
      const ts = new Date().toLocaleString('fr-DZ');
      doc.text(`Généré le ${ts}`, margin, pageHeight - 6);
    } catch {}

    const tsFile = new Date().toISOString().substring(0,19).replace(/[:T]/g, '-');
    const codePart = code ? `-${code}` : '';
    doc.save(`rapport-titre${codePart}-${tsFile}.pdf`);
  };

  const escapeKmlText = (value: string) =>
    (value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const buildSelectionKml = (selections: SelectedPolygon[]) => {
    const placemarks = selections
      .map((selection, idx) => {
        const name = escapeKmlText(getSelectionLabel(selection, idx));
        const rings = selection.wgs84Rings;
        if (!rings.length) return '';
        const polygons = rings.map((ring) => {
          const coords = closeRing(ring)
            .map(([lon, lat]) => `${lon},${lat},0`)
            .join(' ');
          return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
        });
        const geomKml =
          polygons.length > 1 ? `<MultiGeometry>${polygons.join('')}</MultiGeometry>` : polygons[0];
        return `<Placemark><name>${name}</name>${geomKml}</Placemark>`;
      })
      .filter(Boolean)
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>` +
      `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`;
  };

  const exportSelectionKml = () => {
    if (!selectedPolygons.length) return;
    const kml = buildSelectionKml(selectedPolygons);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `selection-polygones-${ts}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copySelectionCoords = async () => {
    if (!selectionCoordsText) return;
    try {
      await navigator.clipboard.writeText(selectionCoordsText);
      setCoordsCopied(true);
      window.setTimeout(() => setCoordsCopied(false), 1500);
    } catch (e) {
      console.error('Erreur copie coordonnees:', e);
    }
  };

  const clearSelection = () => {
    setSelectedPolygons([]);
    setShowSelectedCoords(false);
    setCoordsCopied(false);
  };

  return (
    <div className="arcgis-enterprise-container">
      <div 
        ref={mapRef} 
        className="arcgis-map"
        style={{ 
          width: '100%',
          height: '100%',
          cursor: isDrawing ? 'crosshair' : 'grab'
        }}
      />
      
      {/* Layer toggle button */}
      <button
        className="layer-toggle-btn"
        onClick={() => setIsLayerPanelOpen(v => !v)}
        aria-label={isLayerPanelOpen ? 'Masquer les couches' : 'Afficher les couches'}
      >
        {isLayerPanelOpen ? 'Masquer les couches' : 'Afficher les couches'}
      </button>

      <div className="tools-menu">
        <button
          className="tools-toggle"
          type="button"
          onClick={() => setIsToolsOpen((v) => !v)}
          aria-expanded={isToolsOpen}
        >
          Outils
        </button>
        {isToolsOpen && (
          <div className="tools-panel">
            <div className="tools-section">
              <div className="tools-title">Mesure</div>
              <button
                className={`tools-btn ${activeMeasureTool === 'distance' ? 'active' : ''}`}
                type="button"
                onClick={() => toggleMeasurementTool('distance')}
                disabled={!isMapReady}
                aria-pressed={activeMeasureTool === 'distance'}
              >
                Mesurer distance
              </button>
              <button
                className={`tools-btn ${activeMeasureTool === 'area' ? 'active' : ''}`}
                type="button"
                onClick={() => toggleMeasurementTool('area')}
                disabled={!isMapReady}
                aria-pressed={activeMeasureTool === 'area'}
              >
                Mesurer surface
              </button>
              <button
                className="tools-btn"
                type="button"
                onClick={clearMeasurementTools}
                disabled={!isMapReady || activeMeasureTool === 'none'}
              >
                Effacer mesures
              </button>
            </div>
            <div className="tools-section">
              <div className="tools-title">Navigation</div>
              <button
                className={`tools-btn ${rotationToolsEnabled ? 'active' : ''}`}
                type="button"
                onClick={toggleRotationTools}
                disabled={!isMapReady}
                aria-pressed={rotationToolsEnabled}
              >
                Rotation 3D
              </button>
              <button
                className="tools-btn"
                type="button"
                onClick={resetRotation}
                disabled={!isMapReady}
              >
                Reinitialiser rotation
              </button>
              <button
                className="tools-btn"
                type="button"
                onClick={() => zoomToCurrentPolygon()}
                disabled={!isMapReady}
              >
                Recentrer perimetre
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export controls */}
      <div className="export-controls">
        <button className="export-btn" onClick={exportPNG} disabled={isExporting}>
          {isExporting ? 'Export…' : 'Exporter PNG'}
        </button>
        <button className="export-btn" onClick={exportPDF} disabled={isExporting}>
          {isExporting ? 'Export…' : 'Télécharger PDF'}
        </button>
      </div>

      {enableSelectionTools && (
        <div className="selection-panel">
          <div className="selection-header">
            <div>
              <div className="selection-title">
                Selection ({selectedPolygons.length})
              </div>
              <div className="selection-hint">Ctrl/Shift pour multi-selection</div>
            </div>
            <div className="selection-header-actions">
              <button
                className="selection-toggle"
                onClick={() => setSelectionCollapsed((prev) => !prev)}
                type="button"
              >
                {selectionCollapsed ? 'Afficher' : 'Masquer'}
              </button>
              <button
                className="selection-clear"
                onClick={clearSelection}
                disabled={!selectedPolygons.length}
                type="button"
              >
                Vider
              </button>
            </div>
          </div>
          {!selectionCollapsed && (
            <>
              {selectedPolygons.length ? (
                <div className="selection-list">
                  {selectedPolygons.map((selection, idx) => (
                    <div key={selection.key} className="selection-item">
                      {getSelectionLabel(selection, idx)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="selection-empty">
                  Cliquez sur un polygone pour l'ajouter a la selection.
                </div>
              )}
              <div className="selection-actions">
                <button
                  className="selection-btn selection-primary"
                  onClick={exportSelectionKml}
                  disabled={!selectedPolygons.length}
                  type="button"
                >
                  Telecharger KML
                </button>
                <button
                  className="selection-btn"
                  onClick={() => setShowSelectedCoords((prev) => !prev)}
                  disabled={!selectedPolygons.length}
                  type="button"
                >
                  {showSelectedCoords ? 'Masquer coords' : 'Voir coords'}
                </button>
                <button
                  className="selection-btn"
                  onClick={copySelectionCoords}
                  disabled={!selectedPolygons.length}
                  type="button"
                >
                  {coordsCopied ? 'Copie ok' : 'Copier coords'}
                </button>
              </div>
              {showSelectedCoords && (
                <textarea
                  className="selection-textarea"
                  readOnly
                  value={selectionCoordsText}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Layer control panel */}
      {isLayerPanelOpen && (
      <div className="layer-control-panel">
        <h4>Couches SIGAM (sigam_final)</h4>
        <div className="basemap-section">
          <div className="basemap-title">Fond de carte</div>
          <div className="basemap-buttons">
            {basemapOptions.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`basemap-btn ${basemapMode === key ? 'active' : ''}`}
                onClick={() => setBasemapMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        { (detectedAdmin.ville || detectedAdmin.commune || detectedAdmin.wilaya) && (
          <div className="admin-detected">
            Lieu détecté: {[detectedAdmin.ville, detectedAdmin.commune, detectedAdmin.wilaya].filter(Boolean).join(' / ')}
          </div>
        )}
        <div className="layer-list">
          {layerToggleOptions.map(({ key, label }) => (
            <div className="layer-item" key={key}>
              <input 
                type="checkbox" 
                checked={!!activeLayers[key]}
                onChange={() => toggleLayer(key)}
              />
              <label>{label}</label>
            </div>
          ))}
        </div>
      </div>
      )}

      <style jsx>{`
        .arcgis-enterprise-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        :global(.esri-distance-measurement-2d .esri-button),
        :global(.esri-distance-measurement-2d .esri-measurement__action-button),
        :global(.esri-area-measurement-2d .esri-button),
        :global(.esri-area-measurement-2d .esri-measurement__action-button) {
          font-size: 10px;
          padding: 4px 4px;
          min-height: 20px;
        }
        .layer-toggle-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1001;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          color: #2d3748;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .tools-menu {
          position: absolute;
          bottom: 54px;
          right: 10px;
          z-index: 1001;
        }
        .tools-toggle {
          background: #111827;
          border: 1px solid #111827;
          color: #ffffff;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .tools-panel {
          position: absolute;
          right: 0;
          bottom: 40px;
          width: 220px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tools-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tools-title {
          font-size: 11px;
          font-weight: 700;
          color: #1f2937;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .tools-btn {
          width: 100%;
          text-align: left;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
          color: #111827;
          cursor: pointer;
        }
        .tools-btn.active {
          background: #111827;
          border-color: #111827;
          color: #ffffff;
        }
        .tools-btn[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .layer-control-panel {
          position: fixed;
          top: 48px; /* leave space for toggle btn */
          right: 10px;
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 1000;
          max-width: 220px;
          border: 1px solid #e2e8f0;
        }
        .layer-control-panel h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
        }
        .basemap-section {
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .basemap-title {
          font-size: 12px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 6px;
        }
        .basemap-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .basemap-btn {
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #111827;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
        }
        .basemap-btn.active {
          background: #111827;
          border-color: #111827;
          color: #ffffff;
        }
        .admin-detected {
          font-size: 12px;
          color: #1f2937;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 8px;
        }
        .layer-item {
          display: flex;
          align-items: center;
          margin: 8px 0;
          padding: 4px 0;
        }
        .layer-item label {
          margin-left: 8px;
          font-size: 13px;
          cursor: pointer;
          color: #4a5568;
        }
        .layer-item input[type="checkbox"] {
          cursor: pointer;
        }
        .export-controls {
          position: absolute;
          bottom: 10px;
          right: 10px;
          z-index: 1001;
          display: flex;
          gap: 8px;
        }
        .export-btn {
          background: #1f2937;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 12px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .export-btn[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .selection-panel {
          position: absolute;
          bottom: 10px;
          left: 10px;
          z-index: 1001;
          width: 260px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .selection-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .selection-header-actions {
          display: flex;
          gap: 6px;
        }
        .selection-title {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
        }
        .selection-hint {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }
        .selection-clear {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          color: #374151;
          cursor: pointer;
        }
        .selection-toggle {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          color: #111827;
          cursor: pointer;
        }
        .selection-clear[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .selection-list {
          max-height: 120px;
          overflow: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 6px 8px;
          background: #f9fafb;
        }
        .selection-item {
          font-size: 12px;
          color: #1f2937;
          padding: 4px 0;
          border-bottom: 1px dashed #e5e7eb;
        }
        .selection-item:last-child {
          border-bottom: none;
        }
        .selection-empty {
          font-size: 12px;
          color: #6b7280;
          border: 1px dashed #d1d5db;
          border-radius: 8px;
          padding: 8px;
          background: #f9fafb;
        }
        .selection-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .selection-btn {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 11px;
          color: #111827;
          cursor: pointer;
        }
        .selection-btn[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .selection-primary {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
        }
        .selection-textarea {
          width: 100%;
          min-height: 110px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px;
          font-size: 11px;
          color: #111827;
          background: #f9fafb;
          resize: vertical;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        @media (max-width: 640px) {
          .selection-panel {
            width: auto;
            left: 10px;
            right: 10px;
          }
          .tools-panel {
            width: 180px;
          }
          .tools-menu {
            bottom: 64px;
          }
        }
      `}</style>
    </div>
  );
});

ArcGISMap.displayName = 'ArcGISMap';

export default ArcGISMap;