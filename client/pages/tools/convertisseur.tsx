'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, Dispatch, SetStateAction } from 'react';
import proj4 from 'proj4';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import styles from './convertisseur.module.css';
import { FiCopy, FiDownload, FiExternalLink, FiMapPin, FiPlus, FiRefreshCw, FiTarget, FiTrash2, FiX } from 'react-icons/fi';

type Coord = [number, number];
type Coord3 = [number, number, number];
type CoordRow = { x: string; y: string; z: string };
type TransformParams = { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number; ds: number };
type CoordFormat = 'EN' | 'XY' | 'DD_DEC' | 'DMS' | 'CART';
type CoordSystem = 'WGS84' | 'NORD_SAHARA';
type BBox = [number, number, number, number];
type MapView = 'ALGERIE' | 'WILAYA' | 'COMMUNE';
type OffsetKey = '2022_2006' | '2006_NONE' | '2022_NONE';
type MapPan = { x: number; y: number };
type ParamPolygonKey = ParamSetKey | 'NONE';

type PccCommune = {
  id: number;
  name: string | null;
  nameAr?: string | null;
  nature?: string | null;
  types: string[];
  bbox: BBox;
  polygons: Coord[][];
  wilaya?: { id: number | null; name: string | null; nameAr?: string | null; zone?: string | null };
  daira?: { id: number | null; name: string | null; nameAr?: string | null } | null;
};

type PccWilaya = {
  id: number | null;
  name: string | null;
  nameAr?: string | null;
  zone?: string | null;
  bbox: BBox;
  communeIds: number[];
};

type PccSheet = {
  id: number;
  scaleLabel: string | null;
  scaleRaw?: string | null;
  zone?: number | null;
  code?: string | null;
  name?: string | null;
  notes?: string | null;
  status?: string | null;
  bbox: BBox;
  polygon: Coord[];
};

type PccData = {
  communes: PccCommune[];
  wilayas: PccWilaya[];
  sheets: PccSheet[];
  algeriaBbox: BBox;
};

type ConversionMeta = {
  direction: 'WGS_TO_NS' | 'NS_TO_WGS';
  rows: CoordRow[];
  format: CoordFormat;
  zone: number;
};

type OffsetRow = {
  key: OffsetKey;
  label: string;
  dE: number;
  dN: number;
  distance: number;
};

type LocalisationInfo = {
  pointIndex: number;
  lon: number;
  lat: number;
  utm: { e: number; n: number; zone: number };
  dms: { lat: string; lon: string };
  commune: PccCommune | null;
  wilaya: PccWilaya | null;
  sheetsByScale: Record<string, PccSheet[]>;
  offsets: OffsetRow[];
};

const NORD_SAHARA_ELLIPSOID = { a: 6378249.145, b: 6356514.869, rf: 293.465006 };
const WGS84_ELLIPSOID = { a: 6378137.0, rf: 298.257223563 };
const WGS84_B = WGS84_ELLIPSOID.a * (1 - 1 / WGS84_ELLIPSOID.rf);
const UTM_PARAMS = { k0: 0.9996, x0: 500000, y0: 0 };
const UTM_FUSEAUX = [
  { zone: 29, lon0: -9 },
  { zone: 30, lon0: -3 },
  { zone: 31, lon0: 3 },
  { zone: 32, lon0: 9 },
];

const FORMAT_OPTIONS: Array<{ value: CoordFormat; label: string }> = [
  { value: 'EN', label: 'Carte (E, N)' },
  { value: 'DMS', label: 'DMS (lat, long)' },
  { value: 'DD_DEC', label: 'D.DEC (lat, long)' },
  { value: 'XY', label: 'X, Y' },
  { value: 'CART', label: 'Cart. (X,Y,Z)' },
];

const TRANSFORM_SETS = {
  '2022': {
    label: '2022',
    source: 'Arrete 10/11/2022',
    wgs84ToNordSahara: {
      dx: 267.407,
      dy: 47.068,
      dz: -446.357,
      rx: 0.179423,
      ry: -5.577661,
      rz: 1.277620,
      ds: -1.204866,
    },
  },
  '2006': {
    label: '2006',
    source: 'INCT 02/2006',
    wgs84ToNordSahara: {
      dx: 209.36,
      dy: 87.82,
      dz: -404.62,
      rx: -0.0046,
      ry: -3.4784,
      rz: -0.5805,
      ds: 0,
    },
  },
} as const;

type ParamSetKey = keyof typeof TRANSFORM_SETS;

const PARAM_SET_OPTIONS: Array<{ key: ParamSetKey; label: string }> = [
  { key: '2022', label: '2022' },
  { key: '2006', label: '2006' },
];

const ZERO_PARAMS: TransformParams = { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, ds: 0 };
const MAP_ZOOM_MIN = 0.2;
const MAP_ZOOM_MAX = 30;
const SHIFT_COLORS = {
  '2022_2006': '#0f766e',
  '2022_NONE': '#2563eb',
  '2006_NONE': '#f97316',
};

const invertParams = (params: TransformParams): TransformParams => ({
  dx: -params.dx,
  dy: -params.dy,
  dz: -params.dz,
  rx: -params.rx,
  ry: -params.ry,
  rz: -params.rz,
  ds: -params.ds,
});

const PARAM_VARIANTS = [
  {
    key: '2022',
    label: '2022',
    wgs84ToNs: TRANSFORM_SETS['2022'].wgs84ToNordSahara,
    nsToWgs84: invertParams(TRANSFORM_SETS['2022'].wgs84ToNordSahara),
  },
  {
    key: '2006',
    label: '2006',
    wgs84ToNs: TRANSFORM_SETS['2006'].wgs84ToNordSahara,
    nsToWgs84: invertParams(TRANSFORM_SETS['2006'].wgs84ToNordSahara),
  },
  {
    key: 'NONE',
    label: 'Parametres nuls (0)',
    wgs84ToNs: ZERO_PARAMS,
    nsToWgs84: ZERO_PARAMS,
  },
] as const;

const MAP_VIEW_OPTIONS: Array<{ value: MapView; label: string }> = [
  { value: 'ALGERIE', label: 'Algerie' },
  { value: 'WILAYA', label: 'Wilaya' },
  { value: 'COMMUNE', label: 'Commune' },
];

const OFFSET_OPTIONS: Array<{ value: OffsetKey; label: string }> = [
  { value: '2022_2006', label: '2022 vs 2006' },
  { value: '2006_NONE', label: '2006 vs Parametres nuls (0)' },
  { value: '2022_NONE', label: '2022 vs Parametres nuls (0)' },
];

const formatParam = (value: number) => {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(6).replace(/\.?0+$/, '');
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildTransformRows = (params: TransformParams) => [
  { label: 'Tx', value: `${formatParam(params.dx)} m` },
  { label: 'Ty', value: `${formatParam(params.dy)} m` },
  { label: 'Tz', value: `${formatParam(params.dz)} m` },
  { label: 'Rx', value: `${formatParam(params.rx)} arcsec` },
  { label: 'Ry', value: `${formatParam(params.ry)} arcsec` },
  { label: 'Rz', value: `${formatParam(params.rz)} arcsec` },
  { label: 'ds', value: `${formatParam(params.ds)} ppm` },
];

const toDms = (value: number, kind: 'lat' | 'lon') => {
  const hemi =
    kind === 'lat'
      ? value >= 0
        ? 'N'
        : 'S'
      : value >= 0
        ? 'E'
        : 'W';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${deg}deg ${min}' ${sec.toFixed(2)}" ${hemi}`;
};

const isUtmFormat = (format: CoordFormat) => format === 'EN' || format === 'XY';
const formatLabel = (format: CoordFormat) => FORMAT_OPTIONS.find((opt) => opt.value === format)?.label || format;

const getFormatMeta = (format: CoordFormat) => {
  switch (format) {
    case 'CART':
      return {
        labelA: 'X (m)',
        labelB: 'Y (m)',
        labelC: 'Z (m)',
        placeholderA: '5054873',
        placeholderB: '653420',
        placeholderC: '3821454',
      };
    case 'DMS':
      return {
        labelA: 'Latitude (DMS)',
        labelB: 'Longitude (DMS)',
        placeholderA: '26 12 15.76 N',
        placeholderB: '6 39 18.77 W',
      };
    case 'DD_DEC':
      return {
        labelA: 'Latitude',
        labelB: 'Longitude',
        placeholderA: '26.204379',
        placeholderB: '-6.655214',
      };
    case 'XY':
      return {
        labelA: 'X (m)',
        labelB: 'Y (m)',
        placeholderA: '734300',
        placeholderB: '2900200',
      };
    case 'EN':
    default:
      return {
        labelA: 'E (m)',
        labelB: 'N (m)',
        placeholderA: '734300',
        placeholderB: '2900200',
      };
  }
};

const utmDef = (zone: number, toWgs84: TransformParams) =>
  `+proj=utm +zone=${zone} +a=${NORD_SAHARA_ELLIPSOID.a} +b=${NORD_SAHARA_ELLIPSOID.b} +units=m ` +
  `+k=${UTM_PARAMS.k0} +x_0=${UTM_PARAMS.x0} +y_0=${UTM_PARAMS.y0} ` +
  `+towgs84=${toWgs84.dx},${toWgs84.dy},${toWgs84.dz},${toWgs84.rx},${toWgs84.ry},${toWgs84.rz},${toWgs84.ds} ` +
  `+no_defs`;

const wgs84UtmDef = (zone: number) =>
  `+proj=utm +zone=${zone} +a=${WGS84_ELLIPSOID.a} +rf=${WGS84_ELLIPSOID.rf} +units=m ` +
  `+k=${UTM_PARAMS.k0} +x_0=${UTM_PARAMS.x0} +y_0=${UTM_PARAMS.y0} +no_defs`;

const nordSaharaGeoDef = (toWgs84: TransformParams) =>
  `+proj=longlat +a=${NORD_SAHARA_ELLIPSOID.a} +b=${NORD_SAHARA_ELLIPSOID.b} ` +
  `+towgs84=${toWgs84.dx},${toWgs84.dy},${toWgs84.dz},${toWgs84.rx},${toWgs84.ry},${toWgs84.rz},${toWgs84.ds} ` +
  `+no_defs`;

const geocentDef = (system: CoordSystem, toWgs84: TransformParams) => {
  const isWgs84 = system === 'WGS84';
  const a = isWgs84 ? WGS84_ELLIPSOID.a : NORD_SAHARA_ELLIPSOID.a;
  const b = isWgs84 ? WGS84_B : NORD_SAHARA_ELLIPSOID.b;
  const towgs84 = isWgs84
    ? ''
    : ` +towgs84=${toWgs84.dx},${toWgs84.dy},${toWgs84.dz},${toWgs84.rx},${toWgs84.ry},${toWgs84.rz},${toWgs84.ds}`;
  return `+proj=geocent +a=${a} +b=${b} +units=m${towgs84} +no_defs`;
};

const emptyRow = (): CoordRow => ({ x: '', y: '', z: '' });

const makeEmptyRows = (count: number): CoordRow[] => Array.from({ length: count }, () => emptyRow());

const normalizeNumber = (value: string) =>
  value
    .trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');

const parseCoordRows = (rows: CoordRow[], labelX: string, labelY: string): Coord[] => {
  const usable = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => row.x.trim().length > 0 || row.y.trim().length > 0);

  if (!usable.length) {
    throw new Error('Aucune coordonnée à convertir');
  }

  return usable.map(({ x, y, index }) => {
    if (!x.trim() || !y.trim()) {
      throw new Error(`Valeur manquante à la ligne ${index + 1} (${labelX}/${labelY})`);
    }

    const a = Number(normalizeNumber(x));
    const b = Number(normalizeNumber(y));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error(`Coordonnées non numériques à la ligne ${index + 1}`);
    }

    return [a, b] as Coord;
  });
};

const parseDecimal = (value: string) => {
  const num = Number(normalizeNumber(value));
  return Number.isFinite(num) ? num : NaN;
};

const parseDms = (value: string, kind: 'lat' | 'lon') => {
  if (!value) return NaN;
  const cleaned = value.trim().toUpperCase().replace(/,/g, '.');
  const hemiMatch = cleaned.match(/[NSEW]/);
  let sign = 1;
  if (hemiMatch) {
    const hemi = hemiMatch[0];
    if (hemi === 'S' || hemi === 'W') sign = -1;
  }
  const parts = cleaned.replace(/[NSEW]/g, '').match(/-?\d+(?:\.\d+)?/g);
  if (!parts || !parts.length) return NaN;
  let deg = Number(parts[0]);
  const min = parts[1] ? Number(parts[1]) : 0;
  const sec = parts[2] ? Number(parts[2]) : 0;
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return NaN;
  if (deg < 0) {
    sign = -1;
    deg = Math.abs(deg);
  }
  const dec = deg + min / 60 + sec / 3600;
  if (kind === 'lat' && dec > 90) return NaN;
  if (kind === 'lon' && dec > 180) return NaN;
  return sign * dec;
};

const parseRows = (
  rows: CoordRow[],
  labelA: string,
  labelB: string,
  parseA: (value: string) => number,
  parseB: (value: string) => number,
): Coord[] => {
  const usable = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => row.x.trim().length > 0 || row.y.trim().length > 0);

  if (!usable.length) {
    throw new Error('Aucune coordonnee a convertir');
  }

  return usable.map(({ x, y, index }) => {
    if (!x.trim() || !y.trim()) {
      throw new Error(`Valeur manquante a la ligne ${index + 1} (${labelA}/${labelB})`);
    }

    const a = parseA(x);
    const b = parseB(y);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error(`Coordonnees invalides a la ligne ${index + 1}`);
    }

    return [a, b] as Coord;
  });
};

const parseRows3 = (
  rows: CoordRow[],
  labelA: string,
  labelB: string,
  labelC: string,
  parseA: (value: string) => number,
  parseB: (value: string) => number,
  parseC: (value: string) => number,
): Coord3[] => {
  const usable = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => row.x.trim().length > 0 || row.y.trim().length > 0 || row.z.trim().length > 0);

  if (!usable.length) {
    throw new Error('Aucune coordonnee a convertir');
  }

  return usable.map(({ x, y, z, index }) => {
    if (!x.trim() || !y.trim()) {
      throw new Error(`Valeur manquante a la ligne ${index + 1} (${labelA}/${labelB})`);
    }

    const a = parseA(x);
    const b = parseB(y);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error(`Coordonnees invalides a la ligne ${index + 1}`);
    }

    let c = 0;
    if (z.trim()) {
      c = parseC(z);
      if (!Number.isFinite(c)) {
        throw new Error(`Coordonnees invalides a la ligne ${index + 1} (${labelC})`);
      }
    }

    return [a, b, c] as Coord3;
  });
};

const toWgs84 = (
  rows: CoordRow[],
  system: CoordSystem,
  format: CoordFormat,
  zone: number,
  toWgs84Params: TransformParams,
): Coord[] => {
  const meta = getFormatMeta(format);
  if (format === 'CART') {
    const coords = parseRows3(
      rows,
      meta.labelA,
      meta.labelB,
      meta.labelC || 'Z',
      parseDecimal,
      parseDecimal,
      parseDecimal,
    );
    const proj = geocentDef(system, toWgs84Params);
    return coords.map(([x, y, z]) => {
      const [lon, lat] = proj4(proj, 'EPSG:4326', [x, y, z] as [number, number, number]) as [
        number,
        number,
        number,
      ];
      return [lon, lat];
    });
  }
  if (isUtmFormat(format)) {
    const coords = parseRows(rows, meta.labelA, meta.labelB, parseDecimal, parseDecimal);
    const proj = system === 'WGS84' ? wgs84UtmDef(zone) : utmDef(zone, toWgs84Params);
    return coords.map(([x, y]) => {
      const [lon, lat] = proj4(proj, 'EPSG:4326', [x, y]) as [number, number];
      return [lon, lat];
    });
  }

  const coords = parseRows(
    rows,
    meta.labelA,
    meta.labelB,
    (value) => (format === 'DMS' ? parseDms(value, 'lat') : parseDecimal(value)),
    (value) => (format === 'DMS' ? parseDms(value, 'lon') : parseDecimal(value)),
  );

  if (system === 'WGS84') {
    return coords.map(([lat, lon]) => [lon, lat] as Coord);
  }

  const nsGeo = nordSaharaGeoDef(toWgs84Params);
  return coords.map(([lat, lon]) => {
    const [wgsLon, wgsLat] = proj4(nsGeo, 'EPSG:4326', [lon, lat]) as [number, number];
    return [wgsLon, wgsLat];
  });
};

const formatFromWgs84 = (
  coords: Coord[],
  system: CoordSystem,
  format: CoordFormat,
  zone: number,
  toWgs84Params: TransformParams,
  roundMeter: boolean,
) => {
  if (format === 'CART') {
    const proj = geocentDef(system, toWgs84Params);
    return coords
      .map(([lon, lat]) => {
        let [x, y, z] = proj4('EPSG:4326', proj, [lon, lat, 0]) as [number, number, number];
        if (roundMeter) {
          x = Math.round(x);
          y = Math.round(y);
          z = Math.round(z);
        }
        const xStr = roundMeter ? x.toFixed(0) : x.toFixed(3);
        const yStr = roundMeter ? y.toFixed(0) : y.toFixed(3);
        const zStr = roundMeter ? z.toFixed(0) : z.toFixed(3);
        return `${xStr}\t${yStr}\t${zStr}`;
      })
      .join('\n');
  }
  if (isUtmFormat(format)) {
    const proj = system === 'WGS84' ? wgs84UtmDef(zone) : utmDef(zone, toWgs84Params);
    return coords
      .map(([lon, lat]) => {
        let [x, y] = proj4('EPSG:4326', proj, [lon, lat]) as [number, number];
        if (roundMeter) {
          x = Math.round(x);
          y = Math.round(y);
        }
        const xStr = roundMeter ? x.toFixed(0) : x.toFixed(3);
        const yStr = roundMeter ? y.toFixed(0) : y.toFixed(3);
        return `${xStr}\t${yStr}`;
      })
      .join('\n');
  }

  let geoCoords = coords;
  if (system === 'NORD_SAHARA') {
    const nsGeo = nordSaharaGeoDef(toWgs84Params);
    geoCoords = coords.map(([lon, lat]) => {
      const [nsLon, nsLat] = proj4('EPSG:4326', nsGeo, [lon, lat]) as [number, number];
      return [nsLon, nsLat];
    });
  }

  if (format === 'DMS') {
    return geoCoords.map(([lon, lat]) => `${toDms(lat, 'lat')}\t${toDms(lon, 'lon')}`).join('\n');
  }

  return geoCoords.map(([lon, lat]) => `${lat.toFixed(6)}\t${lon.toFixed(6)}`).join('\n');
};

const parseClipboardMatrix = (text: string): string[][] =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
      if (line.includes(';')) return line.split(';').map((c) => c.trim());
      return line.split(/\s+/).map((c) => c.trim());
    })
    .filter((cells) => cells.length > 0);

const isPointInBbox = (point: Coord, bbox: BBox) =>
  point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3];

const padBbox = (bbox: BBox, ratio: number) => {
  const [minX, minY, maxX, maxY] = bbox;
  const width = maxX - minX;
  const height = maxY - minY;
  const padX = width === 0 ? 0.1 : width * ratio;
  const padY = height === 0 ? 0.1 : height * ratio;
  return [minX - padX, minY - padY, maxX + padX, maxY + padY] as BBox;
};

const addPolygonPath = (
  ctx: CanvasRenderingContext2D,
  polygon: Coord[],
  toCanvas: (coord: Coord) => Coord,
  minPixelDelta = 0,
) => {
  if (!polygon.length) return;
  let lastX = 0;
  let lastY = 0;
  const minDistSq = minPixelDelta * minPixelDelta;
  polygon.forEach((coord, index) => {
    const [x, y] = toCanvas(coord);
    if (index === 0) {
      ctx.moveTo(x, y);
      lastX = x;
      lastY = y;
      return;
    }
    if (minPixelDelta > 0) {
      const dx = x - lastX;
      const dy = y - lastY;
      if (dx * dx + dy * dy < minDistSq && index < polygon.length - 1) return;
    }
    ctx.lineTo(x, y);
    lastX = x;
    lastY = y;
  });
  ctx.closePath();
};

const computeCentroid = (points: Coord[]) => {
  if (!points.length) return null;
  let sumX = 0;
  let sumY = 0;
  points.forEach(([x, y]) => {
    sumX += x;
    sumY += y;
  });
  return [sumX / points.length, sumY / points.length] as Coord;
};

const isPointInPolygon = (point: Coord, polygon: Coord[]) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const findCommuneForPoint = (point: Coord, communes: PccCommune[]): PccCommune | null => {
  for (const commune of communes) {
    if (!isPointInBbox(point, commune.bbox)) continue;
    for (const polygon of commune.polygons) {
      if (isPointInPolygon(point, polygon)) {
        return commune;
      }
    }
  }
  return null;
};

const findSheetsForPoint = (point: Coord, sheets: PccSheet[]) => {
  const matches: Record<string, PccSheet[]> = {};
  sheets.forEach((sheet) => {
    if (!isPointInBbox(point, sheet.bbox)) return;
    if (isPointInPolygon(point, sheet.polygon)) {
      const key = sheet.scaleLabel || 'C50';
      if (!matches[key]) matches[key] = [];
      matches[key].push(sheet);
    }
  });
  return matches;
};

const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
const formatMeters = (value: number) => value.toFixed(3);

const computeOffsets = (meta: ConversionMeta | null, pointIndex: number): OffsetRow[] => {
  if (!meta) return [];
  try {
    if (meta.direction === 'WGS_TO_NS') {
      const coords = toWgs84(meta.rows, 'WGS84', meta.format, meta.zone, ZERO_PARAMS);
      const point = coords[pointIndex];
      if (!point) return [];
      const [lon, lat] = point;
      const projected = PARAM_VARIANTS.map((variant) => {
        const proj = utmDef(meta.zone, variant.nsToWgs84);
        const [e, n] = proj4('EPSG:4326', proj, [lon, lat]) as [number, number];
        return { key: variant.key, label: variant.label, e, n };
      });
      const byKey = Object.fromEntries(projected.map((row) => [row.key, row]));
      if (!byKey['2022'] || !byKey['2006'] || !byKey['NONE']) return [];
      return [
        {
          key: '2022_2006',
          label: '2022 vs 2006',
          dE: byKey['2022'].e - byKey['2006'].e,
          dN: byKey['2022'].n - byKey['2006'].n,
          distance: Math.hypot(byKey['2022'].e - byKey['2006'].e, byKey['2022'].n - byKey['2006'].n),
        },
        {
          key: '2006_NONE',
          label: '2006 vs Parametres nuls (0)',
          dE: byKey['2006'].e - byKey['NONE'].e,
          dN: byKey['2006'].n - byKey['NONE'].n,
          distance: Math.hypot(byKey['2006'].e - byKey['NONE'].e, byKey['2006'].n - byKey['NONE'].n),
        },
        {
          key: '2022_NONE',
          label: '2022 vs Parametres nuls (0)',
          dE: byKey['2022'].e - byKey['NONE'].e,
          dN: byKey['2022'].n - byKey['NONE'].n,
          distance: Math.hypot(byKey['2022'].e - byKey['NONE'].e, byKey['2022'].n - byKey['NONE'].n),
        },
      ];
    }

    const projected = PARAM_VARIANTS.map((variant) => {
      const coords = toWgs84(meta.rows, 'NORD_SAHARA', meta.format, meta.zone, variant.nsToWgs84);
      const point = coords[pointIndex];
      if (!point) return null;
      const [lon, lat] = point;
      const [e, n] = proj4('EPSG:4326', wgs84UtmDef(meta.zone), [lon, lat]) as [number, number];
      return { key: variant.key, label: variant.label, e, n };
    }).filter(Boolean) as Array<{ key: string; label: string; e: number; n: number }>;
    const byKey = Object.fromEntries(projected.map((row) => [row.key, row]));
    if (!byKey['2022'] || !byKey['2006'] || !byKey['NONE']) return [];
    return [
      {
        key: '2022_2006',
        label: '2022 vs 2006',
        dE: byKey['2022'].e - byKey['2006'].e,
        dN: byKey['2022'].n - byKey['2006'].n,
        distance: Math.hypot(byKey['2022'].e - byKey['2006'].e, byKey['2022'].n - byKey['2006'].n),
      },
      {
        key: '2006_NONE',
        label: '2006 vs Parametres nuls (0)',
        dE: byKey['2006'].e - byKey['NONE'].e,
        dN: byKey['2006'].n - byKey['NONE'].n,
        distance: Math.hypot(byKey['2006'].e - byKey['NONE'].e, byKey['2006'].n - byKey['NONE'].n),
      },
      {
        key: '2022_NONE',
        label: '2022 vs Parametres nuls (0)',
        dE: byKey['2022'].e - byKey['NONE'].e,
        dN: byKey['2022'].n - byKey['NONE'].n,
        distance: Math.hypot(byKey['2022'].e - byKey['NONE'].e, byKey['2022'].n - byKey['NONE'].n),
      },
    ];
  } catch {
    return [];
  }
};

const fetchPccData = async (onStage?: (stage: string) => void, signal?: AbortSignal): Promise<PccData> => {
  const baseUrl = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  const apiUrl =
    (typeof process !== 'undefined' && (process as any)?.env?.NEXT_PUBLIC_API_URL) ||
    (typeof process !== 'undefined' && (process as any)?.env?.NEXT_PUBLIC_API_BASE) ||
    '';

  const normalizeBase = (value: string) => {
    if (!value) return '';
    if (value.endsWith('/')) return value;
    return `${value}/`;
  };

  const candidates = [
    normalizeBase(baseUrl),
    normalizeBase('/'),
    normalizeBase(apiUrl),
    typeof window !== 'undefined' ? normalizeBase(window.location.origin + baseUrl) : '',
  ];
  const bases = Array.from(new Set(candidates.filter(Boolean)));

  const errors: string[] = [];

  const fetchJson = async (url: string, label: string) => {
    onStage?.(`${label} (${url})`);
    const res = await fetch(url, { signal, cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`${label} ${res.status} (${res.statusText})`);
    }
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      throw new Error(`${label} renvoie une page HTML (chemin incorrect)`);
    }
    const size = (text.length / (1024 * 1024)).toFixed(1);
    onStage?.(`Analyse ${label.toLowerCase()} (${size} MB)...`);
    return JSON.parse(text);
  };

  const communePaths = ['pcc/communes.json', 'pcc/communes'];
  const sheetPaths = ['pcc/sheets.json', 'pcc/sheets'];

  for (const base of bases) {
    for (const communePath of communePaths) {
      for (const sheetPath of sheetPaths) {
        try {
          const communePayload = await fetchJson(`${base}${communePath}`, 'Communes PCC');
          const sheetsPayload = await fetchJson(`${base}${sheetPath}`, 'Feuilles C50');

          return {
            communes: communePayload.communes || [],
            wilayas: communePayload.wilayas || [],
            algeriaBbox: communePayload.algeriaBbox || [0, 0, 0, 0],
            sheets: sheetsPayload.sheets || [],
          };
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
          errors.push(`${base}${communePath} | ${base}${sheetPath}: ${err?.message || 'Erreur PCC'}`);
        }
      }
    }
  }

  throw new Error(`Chargement PCC impossible. ${errors.join(' | ')}`);
};

function CoordTable({
  rows,
  setRows,
  xLabel,
  yLabel,
  zLabel,
  xPlaceholder,
  yPlaceholder,
  zPlaceholder,
  inputMode = 'decimal',
}: {
  rows: CoordRow[];
  setRows: Dispatch<SetStateAction<CoordRow[]>>;
  xLabel: string;
  yLabel: string;
  zLabel?: string;
  xPlaceholder?: string;
  yPlaceholder?: string;
  zPlaceholder?: string;
  inputMode?: 'decimal' | 'text';
}) {
  const showZ = Boolean(zLabel);
  const gridTemplate = showZ ? '44px 1fr 1fr 1fr 40px' : undefined;
  const updateCell = (rowIndex: number, key: keyof CoordRow, value: string) => {
    setRows((prev) => prev.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (rowIndex: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, index) => index !== rowIndex);
    });
  };

  const handlePaste =
    (rowIndex: number, column: keyof CoordRow) => (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      if (!text) return;
      if (!/[\r\n\t;]/.test(text)) return;

      const matrix = parseClipboardMatrix(text);
      if (!matrix.length) return;

      e.preventDefault();
      const hasThreeColumns = showZ && matrix.some((cells) => cells.length >= 3);
      const hasTwoColumns = matrix.some((cells) => cells.length >= 2);

      setRows((prev) => {
        const next = [...prev];
        const needed = rowIndex + matrix.length;
        while (next.length < needed) next.push(emptyRow());

        matrix.forEach((cells, offset) => {
          const cell0 = cells[0] ?? '';
          const cell1 = cells[1] ?? '';
          const cell2 = cells[2] ?? '';
          const index = rowIndex + offset;

          if (hasThreeColumns) {
            next[index] = { x: cell0, y: cell1, z: cell2 };
            return;
          }

          if (hasTwoColumns) {
            next[index] = showZ ? { ...next[index], x: cell0, y: cell1, z: cell2 } : { x: cell0, y: cell1, z: '' };
            return;
          }

          if (column === 'x') {
            next[index] = { ...next[index], x: cell0 };
            return;
          }
          if (column === 'y') {
            next[index] = { ...next[index], y: cell0 };
            return;
          }
          next[index] = { ...next[index], z: cell0 };
        });

        return next;
      });
    };

  return (
    <div className={styles.coordTable}>
      <div className={styles.coordTableHeader} style={{ gridTemplateColumns: gridTemplate }}>
        <div>#</div>
        <div>{xLabel}</div>
        <div>{yLabel}</div>
        {showZ && <div>{zLabel}</div>}
        <div />
      </div>
      <div className={styles.coordTableBody}>
        {rows.map((row, rowIndex) => (
          <div className={styles.coordTableRow} style={{ gridTemplateColumns: gridTemplate }} key={rowIndex}>
            <div className={styles.rowIndex}>{rowIndex + 1}</div>
            <input
              className={`${styles.input} ${styles.coordCellInput}`}
              type="text"
              inputMode={inputMode}
              placeholder={xPlaceholder}
              value={row.x}
              onChange={(e) => updateCell(rowIndex, 'x', e.target.value)}
              onPaste={handlePaste(rowIndex, 'x')}
            />
            <input
              className={`${styles.input} ${styles.coordCellInput}`}
              type="text"
              inputMode={inputMode}
              placeholder={yPlaceholder}
              value={row.y}
              onChange={(e) => updateCell(rowIndex, 'y', e.target.value)}
              onPaste={handlePaste(rowIndex, 'y')}
            />
            {showZ && (
              <input
                className={`${styles.input} ${styles.coordCellInput}`}
                type="text"
                inputMode={inputMode}
                placeholder={zPlaceholder}
                value={row.z}
                onChange={(e) => updateCell(rowIndex, 'z', e.target.value)}
                onPaste={handlePaste(rowIndex, 'z')}
              />
            )}
            <button
              className={styles.iconBtn}
              type="button"
              onClick={() => removeRow(rowIndex)}
              disabled={rows.length <= 1}
              aria-label="Supprimer la ligne"
              title="Supprimer la ligne"
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>
      <div className={styles.coordTableFooter}>
        <button className={styles.btn} type="button" onClick={addRow}>
          <FiPlus /> Ajouter une ligne
        </button>
      </div>
      <span className={styles.muted}>Astuce : collez directement depuis Excel (2 colonnes) dans le tableau.</span>
    </div>
  );
}

export default function ConvertisseurPage() {
  const { currentView, navigateTo } = useViewNavigator('convertisseur');
  const [paramSetKey, setParamSetKey] = useState<ParamSetKey>('2022');
  const activeParamSet = TRANSFORM_SETS[paramSetKey];
  const nordSaharaToWgs84 = invertParams(activeParamSet.wgs84ToNordSahara);
  const [utmZone, setUtmZone] = useState(31);

  const [geogRows, setGeogRows] = useState<CoordRow[]>([
    { x: '26.204379', y: '-6.655214', z: '' },
    { x: '26.204330', y: '-6.652213', z: '' },
    { x: '26.201623', y: '-6.652268', z: '' },
    emptyRow(),
  ]);

  const [utmRows, setUtmRows] = useState<CoordRow[]>([
    { x: '354700', y: '4100900', z: '' },
    { x: '354700', y: '4100700', z: '' },
    { x: '354400', y: '4100700', z: '' },
    { x: '354400', y: '4100900', z: '' },
    emptyRow(),
  ]);

  const [wgsInputFormat, setWgsInputFormat] = useState<CoordFormat>('XY');
  const [nsOutputFormat, setNsOutputFormat] = useState<CoordFormat>('XY');
  const [nsInputFormat, setNsInputFormat] = useState<CoordFormat>('XY');
  const [wgsOutputFormat, setWgsOutputFormat] = useState<CoordFormat>('XY');

  const [wgsToNsOutput, setWgsToNsOutput] = useState('');
  const [nsToWgsOutput, setNsToWgsOutput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [kmlUrl, setKmlUrl] = useState<string | null>(null);
  const [lastGeog, setLastGeog] = useState<Coord[]>([]);
  const [roundMeter, setRoundMeter] = useState(true);
  const [lastConversion, setLastConversion] = useState<ConversionMeta | null>(null);
  const [localiserOpen, setLocaliserOpen] = useState(false);
  const [pccData, setPccData] = useState<PccData | null>(null);
  const [pccLoading, setPccLoading] = useState(false);
  const [pccError, setPccError] = useState<string | null>(null);
  const [pccStage, setPccStage] = useState<string | null>(null);
  const [pccRetryKey, setPccRetryKey] = useState(0);
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [localisation, setLocalisation] = useState<LocalisationInfo | null>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseMapRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const [mapView, setMapView] = useState<MapView>('ALGERIE');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('2022_2006');
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState<MapPan>({ x: 0, y: 0 });
  const mapZoomRef = useRef(1);
  const mapPanRef = useRef<MapPan>({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const [showResultPolygon, setShowResultPolygon] = useState(true);
  const [showParam2022, setShowParam2022] = useState(true);
  const [showParam2006, setShowParam2006] = useState(true);
  const [showParamNone, setShowParamNone] = useState(true);
  const [showShift, setShowShift] = useState(true);
  const wgsInputMeta = getFormatMeta(wgsInputFormat);
  const nsInputMeta = getFormatMeta(nsInputFormat);
  const selectedOffset = localisation?.offsets.find((row) => row.key === offsetKey) || null;
  const paramPolygons = useMemo(() => {
    if (!lastConversion || lastConversion.direction !== 'NS_TO_WGS') return [];
    try {
      return PARAM_VARIANTS.map((variant) => ({
        key: variant.key as ParamPolygonKey,
        label: variant.label,
        coords: toWgs84(lastConversion.rows, 'NORD_SAHARA', lastConversion.format, lastConversion.zone, variant.nsToWgs84),
      }));
    } catch {
      return [];
    }
  }, [lastConversion]);
  const hasParamPolygons = paramPolygons.length > 0;
  const paramCentroids = useMemo(() => {
    const centroids = new Map<ParamPolygonKey, Coord>();
    paramPolygons.forEach((polygon) => {
      const centroid = computeCentroid(polygon.coords);
      if (centroid) centroids.set(polygon.key, centroid);
    });
    return centroids;
  }, [paramPolygons]);

  useEffect(() => {
    setWgsToNsOutput('');
    setNsToWgsOutput('');
    setLastGeog([]);
    setKmlUrl(null);
    setMessage(null);
  }, [paramSetKey, wgsInputFormat, nsOutputFormat, nsInputFormat, wgsOutputFormat]);

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    mapPanRef.current = mapPan;
  }, [mapPan]);

  useEffect(() => {
    if (!localiserOpen) return;
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  }, [mapView, localiserOpen]);

  useEffect(() => {
    if (!localiserOpen || pccData) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    setPccLoading(true);
    setPccError(null);
    setPccStage('Chargement PCC...');
    fetchPccData(
      (stage) => {
        if (cancelled) return;
        setPccStage(stage);
      },
      controller.signal,
    )
      .then((data) => {
        if (cancelled) return;
        setPccData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === 'AbortError') {
          setPccError('Chargement PCC trop long. Verifiez que les fichiers sont servis.');
        } else {
          setPccError(err?.message || 'Erreur de chargement PCC');
        }
      })
      .finally(() => {
        if (cancelled) return;
        setPccLoading(false);
        setPccStage(null);
        window.clearTimeout(timeoutId);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [localiserOpen, pccData, pccRetryKey]);

  useEffect(() => {
    if (!localiserOpen || !pccData || !lastGeog.length) {
      setLocalisation(null);
      return;
    }
    const index = Math.min(selectedPointIndex, lastGeog.length - 1);
    const [lon, lat] = lastGeog[index];
    const commune = findCommuneForPoint([lon, lat], pccData.communes);
    const wilaya = commune?.wilaya?.id
      ? pccData.wilayas.find((entry) => entry.id === commune.wilaya?.id) || null
      : null;
    const sheetsByScale = findSheetsForPoint([lon, lat], pccData.sheets);
    const [e, n] = proj4('EPSG:4326', wgs84UtmDef(utmZone), [lon, lat]) as [number, number];
    const offsets = computeOffsets(lastConversion, index);
    setLocalisation({
      pointIndex: index,
      lon,
      lat,
      utm: { e, n, zone: utmZone },
      dms: { lat: toDms(lat, 'lat'), lon: toDms(lon, 'lon') },
      commune,
      wilaya,
      sheetsByScale,
      offsets,
    });
  }, [localiserOpen, pccData, lastGeog, selectedPointIndex, utmZone, lastConversion]);

  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!localiserOpen || !canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const zoom = mapZoomRef.current;
      const pan = mapPanRef.current;
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      const nextZoom = clamp(zoom * factor, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      if (nextZoom === zoom) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseX = (mx - cx - pan.x) / zoom + cx;
      const baseY = (my - cy - pan.y) / zoom + cy;
      const nextPanX = mx - (baseX - cx) * nextZoom - cx;
      const nextPanY = my - (baseY - cy) * nextZoom - cy;
      setMapZoom(nextZoom);
      setMapPan({ x: nextPanX, y: nextPanY });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragRef.current = { active: true, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      setMapPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
    };

    const handlePointerLeave = () => {
      dragRef.current.active = false;
      canvas.style.cursor = 'grab';
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.style.cursor = 'default';
    };
  }, [localiserOpen]);

  useEffect(() => {
    if (!localiserOpen || !pccData || !localisation) return;
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { algeriaBbox } = pccData;
    const padding = 16;
    const width = canvas.width;
    const height = canvas.height;

    const viewBbox = (() => {
      if (mapView === 'COMMUNE' && localisation.commune?.bbox) return localisation.commune.bbox;
      if (mapView === 'WILAYA' && localisation.wilaya?.bbox) return localisation.wilaya.bbox;
      return algeriaBbox;
    })();

    const paddedBbox = padBbox(viewBbox, mapView === 'ALGERIE' ? 0.03 : 0.08);
    const scaleX = (width - padding * 2) / (paddedBbox[2] - paddedBbox[0]);
    const scaleY = (height - padding * 2) / (paddedBbox[3] - paddedBbox[1]);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = padding - paddedBbox[0] * scale;
    const offsetY = padding + paddedBbox[3] * scale;
    const toBase = ([lon, lat]: Coord) => [offsetX + lon * scale, offsetY - lat * scale] as Coord;

    const viewKey = `${mapView}-${paddedBbox.join(',')}`;
    let baseCanvas = baseMapRef.current?.key === viewKey ? baseMapRef.current.canvas : null;

    if (!baseCanvas && typeof document !== 'undefined') {
      baseCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      const baseCtx = baseCanvas.getContext('2d');
      if (!baseCtx) return;

      baseCtx.clearRect(0, 0, width, height);
      baseCtx.fillStyle = '#f8fafc';
      baseCtx.fillRect(0, 0, width, height);

      if (mapView === 'ALGERIE') {
        baseCtx.strokeStyle = '#cbd5e1';
        baseCtx.lineWidth = 0.7;
        baseCtx.beginPath();
        pccData.communes.forEach((commune) => {
          commune.polygons.forEach((polygon) => {
            addPolygonPath(baseCtx, polygon, toBase, 0.5);
          });
        });
        baseCtx.stroke();
      } else if (mapView === 'WILAYA' && localisation.wilaya?.id) {
        baseCtx.fillStyle = 'rgba(148, 163, 184, 0.08)';
        baseCtx.strokeStyle = '#94a3b8';
        baseCtx.lineWidth = 0.9;
        baseCtx.beginPath();
        pccData.communes.forEach((commune) => {
          if (commune.wilaya?.id !== localisation.wilaya?.id) return;
          commune.polygons.forEach((polygon) => addPolygonPath(baseCtx, polygon, toBase));
        });
        baseCtx.fill();
        baseCtx.stroke();
      } else if (mapView === 'COMMUNE' && localisation.commune) {
        baseCtx.fillStyle = 'rgba(148, 163, 184, 0.1)';
        baseCtx.strokeStyle = '#94a3b8';
        baseCtx.lineWidth = 1;
        baseCtx.beginPath();
        localisation.commune.polygons.forEach((polygon) => addPolygonPath(baseCtx, polygon, toBase));
        baseCtx.fill();
        baseCtx.stroke();
      }

      baseMapRef.current = { key: viewKey, canvas: baseCanvas };
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const drawWithTransform = (drawFn: () => void) => {
      ctx.save();
      ctx.translate(width / 2 + mapPan.x, height / 2 + mapPan.y);
      ctx.scale(mapZoom, mapZoom);
      ctx.translate(-width / 2, -height / 2);
      drawFn();
      ctx.restore();
    };

    const setScaledLine = (value: number) => {
      ctx.lineWidth = value / mapZoom;
    };

    drawWithTransform(() => {
      if (baseCanvas) {
        ctx.drawImage(baseCanvas, 0, 0);
      }

      const wilayaCommunes = localisation.wilaya?.id
        ? pccData.communes.filter((commune) => commune.wilaya?.id === localisation.wilaya?.id)
        : [];

      if (wilayaCommunes.length) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
        ctx.strokeStyle = '#1d4ed8';
        setScaledLine(1.4);
        ctx.beginPath();
        wilayaCommunes.forEach((commune) => {
          commune.polygons.forEach((polygon) => addPolygonPath(ctx, polygon, toBase));
        });
        ctx.fill();
        ctx.stroke();
      }

      if (localisation.commune) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = '#ef4444';
        setScaledLine(1.6);
        ctx.beginPath();
        localisation.commune.polygons.forEach((polygon) => addPolygonPath(ctx, polygon, toBase));
        ctx.fill();
        ctx.stroke();
      }

      if (showResultPolygon && lastGeog.length >= 2) {
        ctx.fillStyle = 'rgba(15, 118, 110, 0.14)';
        ctx.strokeStyle = '#0f766e';
        ctx.setLineDash([]);
        setScaledLine(1.6);
        ctx.beginPath();
        addPolygonPath(ctx, lastGeog, toBase);
        ctx.fill();
        ctx.stroke();
      }

      if (hasParamPolygons) {
        const dashScale = 1 / mapZoom;
        paramPolygons.forEach((polygon) => {
          if (polygon.key === '2022' && !showParam2022) return;
          if (polygon.key === '2006' && !showParam2006) return;
          if (polygon.key === 'NONE' && !showParamNone) return;
          const stroke =
            polygon.key === '2022' ? '#16a34a' : polygon.key === '2006' ? '#f59e0b' : '#94a3b8';
          const dash =
            polygon.key === '2022' ? [] : polygon.key === '2006' ? [6 * dashScale, 6 * dashScale] : [2 * dashScale, 6 * dashScale];
          ctx.strokeStyle = stroke;
          ctx.setLineDash(dash);
          ctx.fillStyle = 'transparent';
          setScaledLine(1.4);
          ctx.beginPath();
          addPolygonPath(ctx, polygon.coords, toBase);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      if (showShift && hasParamPolygons) {
        const c2022 = paramCentroids.get('2022');
        const c2006 = paramCentroids.get('2006');
        const cNone = paramCentroids.get('NONE');
        const drawArrow = (from: Coord, to: Coord, color: string) => {
          const [x1, y1] = toBase(from);
          const [x2, y2] = toBase(to);
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          const dash = 4 / mapZoom;
          ctx.setLineDash([dash, dash]);
          setScaledLine(1.6);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const head = 8 / mapZoom;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        };
        if (showParam2006 && showParam2022 && c2006 && c2022) {
          drawArrow(c2006, c2022, SHIFT_COLORS['2022_2006']);
        }
        if (showParamNone && showParam2022 && cNone && c2022) {
          drawArrow(cNone, c2022, SHIFT_COLORS['2022_NONE']);
        }
        if (showParamNone && showParam2006 && cNone && c2006) {
          drawArrow(cNone, c2006, SHIFT_COLORS['2006_NONE']);
        }
      }

      const [px, py] = toBase([localisation.lon, localisation.lat]);
      const outer = 4 / mapZoom;
      const inner = 2 / mapZoom;
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(px, py, outer, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, inner, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [
    localiserOpen,
    pccData,
    localisation,
    mapView,
    mapZoom,
    mapPan,
    lastGeog,
    showResultPolygon,
    hasParamPolygons,
    paramPolygons,
    paramCentroids,
    showParam2022,
    showParam2006,
    showParamNone,
    showShift,
  ]);

  const handleZoomIn = () => {
    setMapZoom((prev) => clamp(prev * 1.2, MAP_ZOOM_MIN, MAP_ZOOM_MAX));
  };

  const handleZoomOut = () => {
    setMapZoom((prev) => clamp(prev / 1.2, MAP_ZOOM_MIN, MAP_ZOOM_MAX));
  };

  const handleFitMap = () => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  };

  const handleGeogToUtm = () => {
    try {
      const coordsWgs = toWgs84(geogRows, 'WGS84', wgsInputFormat, utmZone, nordSaharaToWgs84);
      const output = formatFromWgs84(
        coordsWgs,
        'NORD_SAHARA',
        nsOutputFormat,
        utmZone,
        nordSaharaToWgs84,
        roundMeter,
      );
      setWgsToNsOutput(output);
      setLastGeog(coordsWgs);
      setLastConversion({
        direction: 'WGS_TO_NS',
        rows: geogRows.map((row) => ({ ...row })),
        format: wgsInputFormat,
        zone: utmZone,
      });
      const zoneInfo = isUtmFormat(wgsInputFormat) || isUtmFormat(nsOutputFormat) ? `, zone ${utmZone}` : '';
      setMessage(
        `Converti ${coordsWgs.length} point(s) WGS84 -> Nord Sahara (${formatLabel(wgsInputFormat)} -> ${formatLabel(
          nsOutputFormat,
        )}${zoneInfo}, params ${activeParamSet.label})`,
      );
    } catch (e: any) {
      setMessage(e?.message || 'Erreur de conversion');
    }
  };

  const handleUtmToGeog = () => {
    try {
      const coordsWgs = toWgs84(utmRows, 'NORD_SAHARA', nsInputFormat, utmZone, nordSaharaToWgs84);
      const output = formatFromWgs84(
        coordsWgs,
        'WGS84',
        wgsOutputFormat,
        utmZone,
        nordSaharaToWgs84,
        roundMeter,
      );
      setNsToWgsOutput(output);
      setLastGeog(coordsWgs);
      setLastConversion({
        direction: 'NS_TO_WGS',
        rows: utmRows.map((row) => ({ ...row })),
        format: nsInputFormat,
        zone: utmZone,
      });
      const zoneInfo = isUtmFormat(nsInputFormat) || isUtmFormat(wgsOutputFormat) ? `, zone ${utmZone}` : '';
      setMessage(
        `Converti ${coordsWgs.length} point(s) Nord Sahara -> WGS84 (${formatLabel(nsInputFormat)} -> ${formatLabel(
          wgsOutputFormat,
        )}${zoneInfo}, params ${activeParamSet.label})`,
      );
    } catch (e: any) {
      setMessage(e?.message || 'Erreur de conversion');
    }
  };

  const handleLocaliser = () => {
    if (!lastGeog.length) {
      setMessage('Aucune coordonnee a localiser');
      return;
    }
    setPccError(null);
    setPccStage(null);
    setSelectedPointIndex(0);
    setLocaliserOpen(true);
  };

  const handleKml = () => {
    if (!lastGeog.length) {
      setMessage('Aucune coordonnée à exporter');
      return;
    }
    const closed = [...lastGeog];
    if (closed.length >= 3) {
      const [flon, flat] = closed[0];
      const [llon, llat] = closed[closed.length - 1];
      if (Math.abs(flon - llon) > 1e-8 || Math.abs(flat - llat) > 1e-8) {
        closed.push([flon, flat]);
      }
    }
    const coordStr = closed.map(([lon, lat]) => `${lon},${lat},0`).join(' ');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Sigam Export</name>
      <Style>
        <LineStyle><color>ff2a5ad0</color><width>3</width></LineStyle>
        <PolyStyle><color>332a5ad0</color></PolyStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordStr}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    setKmlUrl(url);
    setMessage('KML prêt');
  };

  const handleOpenEarth = () => {
    if (!lastGeog.length) return;
    const [lon, lat] = lastGeog[0];
    const url = `https://earth.google.com/web/@${lat},${lon},8000d`;
    window.open(url, '_blank');
  };

  const handleReset = () => {
    setGeogRows(makeEmptyRows(3));
    setUtmRows(makeEmptyRows(3));
    setWgsToNsOutput('');
    setNsToWgsOutput('');
    setLastGeog([]);
    setMessage(null);
    setKmlUrl(null);
    setLastConversion(null);
    setLocalisation(null);
    setLocaliserOpen(false);
    setSelectedPointIndex(0);
    setPccLoading(false);
    setPccError(null);
    setPccStage(null);
  };

  const handleCopy = async (text: string) => {
    if (!text.trim()) {
      setMessage('Rien à copier');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Résultat copié');
    } catch {
      setMessage("Impossible de copier (droits du navigateur)");
    }
  };

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.layout}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.main}>
          <div className={styles.header}>
            <div>
              <div className={styles.title}>
                <FiMapPin /> Convertisseur Coordonnées
              </div>
              <p className={styles.subtitle}>
                UTM Nord Sahara 1959 {'<->'} WGS84 (parametres 2006/2022) + export KML.
              </p>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleReset}>
                <FiRefreshCw /> Réinitialiser
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.title} style={{ fontSize: 18 }}>
                Parametres de transformation
              </div>
              <div className={styles.paramToggle}>
                {PARAM_SET_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.toggleBtn} ${paramSetKey === option.key ? styles.toggleBtnActive : ''}`}
                    onClick={() => setParamSetKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.paramMeta}>
              <span className={styles.muted}>Source: {activeParamSet.source}</span>
            </div>
            <div className={styles.paramGrid}>
              <div className={styles.paramBlock}>
                <div className={styles.paramTitle}>Transformation WGS84 -{'>'} Nord Sahara</div>
                {buildTransformRows(activeParamSet.wgs84ToNordSahara).map((row) => (
                  <div className={styles.paramRow} key={row.label}>
                    <span>{row.label}</span>
                    <span className={styles.paramValue}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className={styles.paramBlock}>
                <div className={styles.paramTitle}>Transformation Nord Sahara -{'>'} WGS84 (utilise)</div>
                {buildTransformRows(nordSaharaToWgs84).map((row) => (
                  <div className={styles.paramRow} key={row.label}>
                    <span>{row.label}</span>
                    <span className={styles.paramValue}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className={styles.paramBlock}>
                <div className={styles.paramTitle}>UTM</div>
                <div className={styles.paramRow}>
                  <span>k0</span>
                  <span className={styles.paramValue}>{UTM_PARAMS.k0}</span>
                </div>
                <div className={styles.paramRow}>
                  <span>Faux Est</span>
                  <span className={styles.paramValue}>{UTM_PARAMS.x0} m</span>
                </div>
                <div className={styles.paramRow}>
                  <span>Faux Nord</span>
                  <span className={styles.paramValue}>{UTM_PARAMS.y0} m</span>
                </div>
              </div>
              <div className={styles.paramBlock}>
                <div className={styles.paramTitle}>Fuseaux UTM Algerie</div>
                {UTM_FUSEAUX.map((fuseau) => (
                  <div className={styles.paramRow} key={fuseau.zone}>
                    <span>Zone {fuseau.zone}</span>
                    <span className={styles.paramValue}>lon0 {fuseau.lon0} deg</span>
                  </div>
                ))}
              </div>
              <div className={styles.paramBlock}>
                <div className={styles.paramTitle}>Ellipsoide Nord Sahara 1959 (Clarke 1880)</div>
                <div className={styles.paramRow}>
                  <span>a</span>
                  <span className={styles.paramValue}>{NORD_SAHARA_ELLIPSOID.a} m</span>
                </div>
                <div className={styles.paramRow}>
                  <span>b</span>
                  <span className={styles.paramValue}>{NORD_SAHARA_ELLIPSOID.b} m</span>
                </div>
                <div className={styles.paramRow}>
                  <span>f</span>
                  <span className={styles.paramValue}>1/{NORD_SAHARA_ELLIPSOID.rf}</span>
                </div>
              </div>
              <div className={styles.paramBlock}>
                <div className={styles.paramTitle}>Ellipsoide WGS84 (GRS80)</div>
                <div className={styles.paramRow}>
                  <span>a</span>
                  <span className={styles.paramValue}>{WGS84_ELLIPSOID.a} m</span>
                </div>
                <div className={styles.paramRow}>
                  <span>f</span>
                  <span className={styles.paramValue}>1/{WGS84_ELLIPSOID.rf}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.title} style={{ fontSize: 18 }}>
                  WGS84 -{'>'} Nord Sahara 1959
                </div>
                <span className={styles.pill}>Zone {utmZone}</span>
              </div>
              <div className={styles.formRow}>
                <div className={styles.labelRow}>
                  <label>Zone UTM</label>
                  <input
                    className={styles.numberInput}
                    type="number"
                    min={29}
                    max={32}
                    value={utmZone}
                    onChange={(e) => setUtmZone(parseInt(e.target.value || '31', 10))}
                    style={{ width: 100 }}
                  />
                </div>
                <label className={styles.labelRow} style={{ alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={roundMeter}
                    onChange={(e) => setRoundMeter(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Arrondir au mètre</span>
                </label>

                <div className={styles.pairGrid}>
                  <div className={styles.labelRow}>
                    <label>Format entree</label>
                    <select
                      className={styles.input}
                      value={wgsInputFormat}
                      onChange={(e) => setWgsInputFormat(e.target.value as CoordFormat)}
                      style={{ width: 180 }}
                    >
                      {FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.labelRow}>
                    <label>Format sortie</label>
                    <select
                      className={styles.input}
                      value={nsOutputFormat}
                      onChange={(e) => setNsOutputFormat(e.target.value as CoordFormat)}
                      style={{ width: 180 }}
                    >
                      {FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <CoordTable
                  rows={geogRows}
                  setRows={setGeogRows}
                  xLabel={wgsInputMeta.labelA}
                  yLabel={wgsInputMeta.labelB}
                  zLabel={wgsInputMeta.labelC}
                  xPlaceholder={wgsInputMeta.placeholderA}
                  yPlaceholder={wgsInputMeta.placeholderB}
                  zPlaceholder={wgsInputMeta.placeholderC}
                  inputMode={wgsInputFormat === 'DMS' ? 'text' : 'decimal'}
                />

                <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={handleGeogToUtm}>
                  Convertir vers Nord Sahara
                </button>
                <div className={styles.outputHeader}>
                  <span className={styles.muted}>Resultat ({formatLabel(nsOutputFormat)})</span>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={() => handleCopy(wgsToNsOutput)}
                    disabled={!wgsToNsOutput.trim()}
                  >
                    <FiCopy /> Copier
                  </button>
                </div>
                <textarea
                  className={styles.output}
                  readOnly
                  value={wgsToNsOutput}
                  placeholder={`Resultat ${formatLabel(nsOutputFormat)}...`}
                />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.title} style={{ fontSize: 18 }}>
                  Nord Sahara 1959 -{'>'} WGS84
                </div>
                <span className={styles.pill}>Zone {utmZone}</span>
              </div>
              <div className={styles.formRow}>
                <div className={styles.labelRow}>
                  <label>Zone UTM</label>
                  <input
                    className={styles.numberInput}
                    type="number"
                    min={29}
                    max={32}
                    value={utmZone}
                    onChange={(e) => setUtmZone(parseInt(e.target.value || '31', 10))}
                    style={{ width: 100 }}
                  />
                </div>

                <div className={styles.pairGrid}>
                  <div className={styles.labelRow}>
                    <label>Format entree</label>
                    <select
                      className={styles.input}
                      value={nsInputFormat}
                      onChange={(e) => setNsInputFormat(e.target.value as CoordFormat)}
                      style={{ width: 180 }}
                    >
                      {FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.labelRow}>
                    <label>Format sortie</label>
                    <select
                      className={styles.input}
                      value={wgsOutputFormat}
                      onChange={(e) => setWgsOutputFormat(e.target.value as CoordFormat)}
                      style={{ width: 180 }}
                    >
                      {FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <CoordTable
                  rows={utmRows}
                  setRows={setUtmRows}
                  xLabel={nsInputMeta.labelA}
                  yLabel={nsInputMeta.labelB}
                  zLabel={nsInputMeta.labelC}
                  xPlaceholder={nsInputMeta.placeholderA}
                  yPlaceholder={nsInputMeta.placeholderB}
                  zPlaceholder={nsInputMeta.placeholderC}
                  inputMode={nsInputFormat === 'DMS' ? 'text' : 'decimal'}
                />

                <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={handleUtmToGeog}>
                  Convertir vers WGS84
                </button>
                <div className={styles.outputHeader}>
                  <span className={styles.muted}>Resultat ({formatLabel(wgsOutputFormat)})</span>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={() => handleCopy(nsToWgsOutput)}
                    disabled={!nsToWgsOutput.trim()}
                  >
                    <FiCopy /> Copier
                  </button>
                </div>
                <textarea
                  className={styles.output}
                  readOnly
                  value={nsToWgsOutput}
                  placeholder={`Resultat ${formatLabel(wgsOutputFormat)}...`}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.title} style={{ fontSize: 18 }}>
                Export & Visualisation
              </div>
              <span className={styles.pill}>{lastGeog.length} point(s)</span>
            </div>
            <div className={styles.actions}>
              <button className={styles.btn} onClick={handleLocaliser} disabled={!lastGeog.length}>
                <FiTarget /> Localiser
              </button>
              <button className={styles.btn} onClick={handleKml} disabled={!lastGeog.length}>
                <FiDownload /> Préparer KML
              </button>
              {kmlUrl && (
                <a className={`${styles.btn} ${styles.btnPrimary}`} href={kmlUrl} download="sigam_convert.kml">
                  <FiDownload /> Télécharger KML
                </a>
              )}
              <button className={styles.btn} onClick={handleOpenEarth} disabled={!lastGeog.length}>
                <FiExternalLink /> Ouvrir Google Earth Web
              </button>
              {message && <span className={styles.message}>{message}</span>}
            </div>
          </div>

          {localiserOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <div>
                    <div className={styles.modalTitle}>Localisation PCC</div>
                    <div className={styles.modalSubtitle}>
                      Wilaya, daira, commune et feuille geographique (C50).
                    </div>
                  </div>
                  <button
                    className={`${styles.iconBtn} ${styles.modalClose}`}
                    type="button"
                    onClick={() => setLocaliserOpen(false)}
                    aria-label="Fermer"
                    title="Fermer"
                  >
                    <FiX />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.modalLeft}>
                    <div className={styles.mapCard}>
                      <div className={styles.mapToolbar}>
                        <div className={styles.mapControls}>
                          <span>Vue</span>
                          <select
                            className={`${styles.input} ${styles.mapSelect}`}
                            value={mapView}
                            onChange={(e) => setMapView(e.target.value as MapView)}
                          >
                            {MAP_VIEW_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.mapButtons}>
                          <button className={styles.mapBtn} type="button" onClick={handleZoomIn}>
                            +
                          </button>
                          <button className={styles.mapBtn} type="button" onClick={handleZoomOut}>
                            -
                          </button>
                          <button className={styles.mapBtn} type="button" onClick={handleFitMap}>
                            Fit
                          </button>
                        </div>
                      </div>
                      <div className={styles.mapLayers}>
                        <label className={styles.mapToggle}>
                          <input
                            type="checkbox"
                            checked={showResultPolygon}
                            onChange={(e) => setShowResultPolygon(e.target.checked)}
                          />
                          Resultat
                        </label>
                        <label className={styles.mapToggle}>
                          <input
                            type="checkbox"
                            checked={showParam2022}
                            onChange={(e) => setShowParam2022(e.target.checked)}
                            disabled={!hasParamPolygons}
                          />
                          2022
                        </label>
                        <label className={styles.mapToggle}>
                          <input
                            type="checkbox"
                            checked={showParam2006}
                            onChange={(e) => setShowParam2006(e.target.checked)}
                            disabled={!hasParamPolygons}
                          />
                          2006
                        </label>
                        <label className={styles.mapToggle}>
                          <input
                            type="checkbox"
                            checked={showParamNone}
                            onChange={(e) => setShowParamNone(e.target.checked)}
                            disabled={!hasParamPolygons}
                          />
                          Parametres nuls (0)
                        </label>
                        <label className={styles.mapToggle}>
                          <input
                            type="checkbox"
                            checked={showShift}
                            onChange={(e) => setShowShift(e.target.checked)}
                            disabled={!hasParamPolygons}
                          />
                          Decalage
                        </label>
                        <span className={styles.mapHint}>Molette: zoom, glisser: deplacer.</span>
                        {!hasParamPolygons && (
                          <span className={styles.mapHint}>Polygones 2006/2022: Nord Sahara -&gt; WGS84.</span>
                        )}
                      </div>
                      <canvas ref={mapCanvasRef} width={520} height={420} />
                      <div className={styles.mapLegend}>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legendAlgeria}`} /> Algerie
                        </span>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legendWilaya}`} /> Wilaya
                        </span>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legendCommune}`} /> Commune
                        </span>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legendResult}`} /> Resultat
                        </span>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legend2022}`} /> 2022
                        </span>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legend2006}`} /> 2006
                        </span>
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legendNone}`} /> Parametres nuls
                        </span>
                        {showShift && hasParamPolygons && (
                          <>
                            <span className={styles.legendItem}>
                              <span className={`${styles.legendDot} ${styles.legendShift2022}`} /> Shift 22-06
                            </span>
                            <span className={styles.legendItem}>
                              <span className={`${styles.legendDot} ${styles.legendShift2022None}`} /> Shift 22-0
                            </span>
                            <span className={styles.legendItem}>
                              <span className={`${styles.legendDot} ${styles.legendShift2006None}`} /> Shift 06-0
                            </span>
                          </>
                        )}
                        <span className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.legendPoint}`} /> Point
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.modalRight}>
                    {pccLoading && <div className={styles.muted}>{pccStage || 'Chargement PCC...'}</div>}
                    {pccError && (
                      <div className={styles.error}>
                        <div>{pccError}</div>
                        <button
                          className={`${styles.btn} ${styles.btnSmall}`}
                          type="button"
                          onClick={() => {
                            setPccData(null);
                            setPccRetryKey((prev) => prev + 1);
                          }}
                        >
                          Reessayer
                        </button>
                      </div>
                    )}
                    {!pccLoading && !pccError && localisation && (
                      <>
                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>Point selectionne</div>
                          <div className={styles.fieldRow}>
                            <label>Point</label>
                            <select
                              className={styles.input}
                              value={selectedPointIndex}
                              onChange={(e) => setSelectedPointIndex(parseInt(e.target.value, 10))}
                            >
                              {lastGeog.map((_, idx) => (
                                <option value={idx} key={`pt-${idx}`}>
                                  Point {idx + 1}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>Latitude</span>
                            <span className={styles.valueMono}>{localisation.lat.toFixed(6)}</span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>Longitude</span>
                            <span className={styles.valueMono}>{localisation.lon.toFixed(6)}</span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>DMS</span>
                            <span className={styles.valueMono}>
                              {localisation.dms.lat} / {localisation.dms.lon}
                            </span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>UTM (WGS84)</span>
                            <span className={styles.valueMono}>
                              {Math.round(localisation.utm.e)} / {Math.round(localisation.utm.n)} (zone{' '}
                              {localisation.utm.zone})
                            </span>
                          </div>
                        </div>

                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>Localisation administrative</div>
                          <div className={styles.fieldRow}>
                            <span>Wilaya</span>
                            <span>
                              {localisation.wilaya?.id ? `${localisation.wilaya.id} - ` : ''}
                              {localisation.wilaya?.name || 'Non trouve'}
                            </span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>Daira</span>
                            <span>
                              {localisation.commune?.daira?.id ? `${localisation.commune.daira.id} - ` : ''}
                              {localisation.commune?.daira?.name || 'Non trouve'}
                            </span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>Commune</span>
                            <span>
                              {localisation.commune
                                ? `${localisation.commune.id} - ${localisation.commune.name || ''}`.trim()
                                : 'Non trouve'}
                            </span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>Type</span>
                            <span>{localisation.commune?.types?.join(' / ') || '--'}</span>
                          </div>
                        </div>

                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>Localisation geographique</div>
                          <div className={styles.fieldRow}>
                            <span>50 000</span>
                            <span>
                              {localisation.sheetsByScale['50 000']?.length
                                ? localisation.sheetsByScale['50 000']
                                    .map(
                                      (sheet) =>
                                        `${sheet.code || ''} ${sheet.name || ''} ${sheet.status || ''}`.trim(),
                                    )
                                    .join(' | ')
                                : 'Non encore implemente'}
                            </span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>25 000</span>
                            <span>Non encore implemente</span>
                          </div>
                          <div className={styles.fieldRow}>
                            <span>100 000</span>
                            <span>Non encore implemente</span>
                          </div>
                        </div>

                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>Decalage parametres (m)</div>
                          {localisation.offsets.length ? (
                            <>
                              <div className={styles.fieldRow}>
                                <span>Comparaison</span>
                                <select
                                  className={`${styles.input} ${styles.offsetSelect}`}
                                  value={offsetKey}
                                  onChange={(e) => setOffsetKey(e.target.value as OffsetKey)}
                                >
                                  {OFFSET_OPTIONS.map((option) => (
                                    <option value={option.value} key={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className={styles.muted}>
                                Parametres nuls = transformation sans parametres (tous a 0).
                              </div>
                              <div className={styles.offsetTable}>
                                <div className={styles.offsetHeader}>
                                  <span>Comparaison</span>
                                  <span>dE</span>
                                  <span>dN</span>
                                  <span>Distance</span>
                                </div>
                                {localisation.offsets.map((row) => (
                                  <div
                                    className={`${styles.offsetRow} ${
                                      row.key === offsetKey ? styles.offsetRowActive : ''
                                    }`}
                                    key={row.label}
                                  >
                                    <span>{row.label}</span>
                                    <span className={styles.valueMono}>{formatSigned(row.dE)}</span>
                                    <span className={styles.valueMono}>{formatSigned(row.dN)}</span>
                                    <span className={styles.valueMono}>{formatMeters(row.distance)}</span>
                                  </div>
                                ))}
                              </div>
                              {selectedOffset && (
                                <div className={styles.offsetSummary}>
                                  <span>Selection</span>
                                  <span className={styles.valueMono}>
                                    {formatSigned(selectedOffset.dE)} / {formatSigned(selectedOffset.dN)} (m)
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className={styles.muted}>Aucun decalage calcule.</div>
                          )}
                        </div>
                      </>
                    )}
                    {!pccLoading && !pccError && !localisation && (
                      <div className={styles.muted}>Aucune localisation disponible.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
