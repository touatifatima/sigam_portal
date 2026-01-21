import { Injectable, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import proj4 = require('proj4');

export type GisPointInput = {
  x: number;
  y: number;
  system?: string;
  zone?: number | null;
  hemisphere?: string | null;
};

export type GisOverlapLayerKey =
  | 'titres'
  | 'perimetresSig'
  | 'promotion'
  | 'modifications'
  | 'exclusions';

export type GisOverlapLayersSelection = Partial<Record<GisOverlapLayerKey, boolean>>;

export type GisPerimeterMeta = {
  sigam_permis_id?: number | null;
  code_demande?: string | null;
  detenteur?: string | null;
  permis_code?: string | null;
  permis_type_code?: string | null;
  permis_type_label?: string | null;
  permis_titulaire?: string | null;
  permis_area_ha?: number | null;
};

@Injectable()
export class GisService {
  private readonly logger = new Logger(GisService.name);
  private readonly pool: Pool;

  // Nord Sahara -> WGS84 7-parameter transformation (JO 30/11/2022).
  // Published parameters are WGS84 -> Nord Sahara; signs inverted for +towgs84.
 private static readonly NORD_SAHARA_TOWGS84 = {
    dx: -267.407,
    dy: -47.068,
    dz: 446.357,
    rx: -0.179423,
    ry: 5.577661,
    rz: -1.277620,
    ds: 1.204866,
  }; 

  constructor() {
    const connectionString =
      process.env.GIS_DATABASE_URL ||
      'postgresql://postgres:dev12345@localhost:5433/sig_gis';

    const wantsSsl =
      /[?&]sslmode=require/i.test(connectionString) ||
      /[?&]ssl=true/i.test(connectionString) ||
      String(process.env.GIS_DATABASE_SSL || '').toLowerCase() === 'true' ||
      String(process.env.GIS_DB_SSL || '').toLowerCase() === 'true';

    this.pool = new Pool({
      connectionString,
      ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
    });

    try {
      this.configureProj4();
    } catch (e) {
      this.logger.error('Failed to configure proj4 projections', e as Error);
    }
  }

  private async getNextPerimeterId(client: PoolClient): Promise<number> {
    const result = await client.query(
      'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM gis_perimeters',
    );
    const nextId = Number(result.rows[0]?.next_id);
    if (!Number.isFinite(nextId)) {
      throw new Error('Failed to compute next gis_perimeters id');
    }
    return nextId;
  }

  private configureProj4() {
    // Core CRS definitions
    proj4.defs('EPSG:4326', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');
    // UTM zones 29-32 North (main Algerian zones)
    for (let zone = 29; zone <= 32; zone++) {
      proj4.defs(
        `EPSG:326${zone.toString().padStart(2, '0')}`,
        `+proj=utm +zone=${zone} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`,
      );
    }
    // Lambert conformal conic zones used in client (approximate)
    proj4.defs(
      'EPSG:30491',
      '+proj=lcc +lat_1=36 +lat_2=34 +lat_0=32 +lon_0=3 +x_0=0 +y_0=0 +ellps=clrk80 +units=m +no_defs',
    );
    proj4.defs(
      'EPSG:30492',
      '+proj=lcc +lat_1=36 +lat_2=34 +lat_0=32 +lon_0=9 +x_0=0 +y_0=0 +ellps=clrk80 +units=m +no_defs',
    );
    proj4.defs(
      'EPSG:30493',
      '+proj=lcc +lat_1=36 +lat_2=34 +lat_0=32 +lon_0=15 +x_0=0 +y_0=0 +ellps=clrk80 +units=m +no_defs',
    );
    // Web Mercator
    proj4.defs(
      'EPSG:3857',
      '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 ' +
        '+x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
    );
  }

  private getUtmOffset(zone: number): { x: number; y: number } {
    // Optional empirical offsets to align with client display (meters), per fuseau.
    return { x: 0, y: 0 };
  }

  private toWgs84(point: GisPointInput): [number, number] {
    const system = (point.system || 'UTM').toUpperCase();
    const x = point.x;
    const y = point.y;

    try {
      if (system === 'WGS84') {
        return [x, y];
      }

      if (system === 'UTM') {
        const zone = point.zone ?? 31;
        const hemisphere = (point.hemisphere || 'N').toUpperCase();
        const { dx, dy, dz, rx, ry, rz, ds } = GisService.NORD_SAHARA_TOWGS84;
        const offset = this.getUtmOffset(zone);
        // Clarke 1880 UTM with k=0.9996 (align with client and JO 2022 params)
        const src =
          `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +k=0.9996 +x_0=500000 +y_0=0 ` +
          `+towgs84=${dx},${dy},${dz},${rx},${ry},${rz},${ds} ` +
          `+units=m +no_defs`;
        const [lng, lat] = proj4(src, 'EPSG:4326', [x + offset.x, y + offset.y]);
        return [lng, lat];
      }

      if (system === 'LAMBERT') {
        let lambertZone = 'EPSG:30491';
        if (x > 1000000 && x < 2000000) {
          lambertZone = 'EPSG:30492';
        } else if (x >= 2000000) {
          lambertZone = 'EPSG:30493';
        }
        const [lng, lat] = proj4(lambertZone, 'EPSG:4326', [x, y]);
        return [lng, lat];
      }

      if (system === 'MERCATOR') {
        const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [x, y]);
        return [lng, lat];
      }

      this.logger.warn(`Unsupported CRS system "${system}", returning raw x/y`);
      return [x, y];
    } catch (err) {
      this.logger.error(
        `toWgs84 conversion failed for system=${system}, x=${x}, y=${y}`,
        err as Error,
      );
      return [x, y];
    }
  }

  async upsertProcedurePerimeter(params: {
    id_proc: number;
    source?: string;
    typeCode?: string | null;
    points: GisPointInput[];
    meta?: GisPerimeterMeta;
  }): Promise<void> {
    const source = params.source || 'DEMANDE';
    const typeCode = params.typeCode ?? null;
    const idProc = params.id_proc;
    const meta = params.meta || {};

    if (!params.points || params.points.length < 3) {
      this.logger.warn(
        `Not enough points to build perimeter for proc=${idProc}`,
      );
      return;
    }

    // Convert to WGS84 and build a closed ring
    const ring: [number, number][] = params.points.map((p) => this.toWgs84(p));
    if (ring.length < 3) {
      return;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }

    const coordStrings = ring.map(([lng, lat]) => `${lng} ${lat}`);
    const wkt = `POLYGON((${coordStrings.join(', ')}))`;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM gis_perimeters WHERE sigam_proc_id = $1 AND source = $2',
        [idProc, source],
      );
      const nextId = await this.getNextPerimeterId(client);
      await client.query(
        `
        INSERT INTO gis_perimeters (
          id,
          sigam_proc_id,
          sigam_permis_id,
          source,
          type_code,
          detenteur,
          permis_code,
          permis_type_code,
          permis_type_label,
          permis_titulaire,
          permis_area_ha,
          geom
        )
        // VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        //   ST_Multi(ST_SetSRID(ST_GeomFromText($12), 4326))
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          ST_Multi(ST_SetSRID(ST_GeomFromText($13), 4326))
        )
      `,
        [
          nextId,
          idProc,
          meta.sigam_permis_id ?? null,
          source,
          typeCode,
          meta.code_demande ?? null,
          meta.detenteur ?? null,
          meta.permis_code ?? null,
          meta.permis_type_code ?? null,
          meta.permis_type_label ?? null,
          meta.permis_titulaire ?? null,
          meta.permis_area_ha ?? null,
          wkt,
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to upsert perimeter for proc=${idProc}`,
        err as Error,
      );
    } finally {
      client.release();
    }
  }

  async deletePerimetersByProcedure(procId: number): Promise<void> {
    if (!Number.isFinite(procId)) return;
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM gis_perimeters WHERE sigam_proc_id = $1', [
        procId,
      ]);
    } finally {
      client.release();
    }
  }

  async upsertFullPerimeter(params: {
    geomWkt: string;
    id_proc?: number | null;
    id_permis?: number | null;
    source?: string;
    typeCode?: string | null;
    status?: string | null;
    codeDemande?: string | null;
    detenteur?: string | null;
    permisCode?: string | null;
    permisTypeCode?: string | null;
    permisTypeLabel?: string | null;
    permisTitulaire?: string | null;
    areaHa?: number | null;
  }): Promise<void> {
    const source = params.source || 'FUSION';
    const idProc = params.id_proc ?? null;
    const idPermis = params.id_permis ?? null;
    const typeCode = params.typeCode ?? null;
    const status = params.status ?? null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (idProc) {
        await client.query(
          'DELETE FROM gis_perimeters WHERE sigam_proc_id = $1 AND source = $2',
          [idProc, source],
        );
      }
      const nextId = await this.getNextPerimeterId(client);
      await client.query(
        `
        INSERT INTO gis_perimeters (
          id,
          sigam_proc_id,
          sigam_permis_id,
          source,
          type_code,
          status,
          code_demande,
          detenteur,
          geom,
          permis_code,
          permis_type_code,
          permis_type_label,
          permis_titulaire,
          permis_area_ha
        )
        VALUES (
          // $1, $2, $3, $4, $5, $6, $7,
          // ST_Multi(ST_SetSRID(ST_GeomFromText($8), 4326)),
          // $9, $10, $11, $12, $13
          $1, $2, $3, $4, $5, $6, $7, $8,
          ST_Multi(ST_SetSRID(ST_GeomFromText($9), 4326)),
          $10, $11, $12, $13, $14
        )
      `,
        [
          nextId,
          idProc,
          idPermis,
          source,
          typeCode,
          status,
          params.codeDemande ?? null,
          params.detenteur ?? null,
          params.geomWkt,
          params.permisCode ?? null,
          params.permisTypeCode ?? null,
          params.permisTypeLabel ?? null,
          params.permisTitulaire ?? null,
          params.areaHa ?? null,
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to upsert full perimeter (proc=${idProc}, permis=${idPermis})`,
        err as Error,
      );
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Effectue l'union de deux polygones (WKT, SRID 4326) et retourne
   * distance, union et surface.
   */
  async unionPolygons(params: {
    wktA: string;
    wktB: string;
    distanceMeters?: number;
  }): Promise<{
    within100m: boolean;
    distance_m: number;
    shared_boundary_m: number;
    overlap_area_ha: number;
    wkt: string;
    geojson: any;
    outer_geojson: any;
    area_ha: number;
  }> {
    const dist = params.distanceMeters ?? 100;
    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `
        WITH
          a AS (
            SELECT ST_MakeValid(ST_Buffer(ST_SetSRID(ST_GeomFromText($1), 4326), 0)) AS g
          ),
          b AS (
            SELECT ST_MakeValid(ST_Buffer(ST_SetSRID(ST_GeomFromText($2), 4326), 0)) AS g
          ),
          dist AS (
            SELECT
              ST_Distance((SELECT g FROM a)::geography, (SELECT g FROM b)::geography) AS d,
              ST_ShortestLine((SELECT g FROM a), (SELECT g FROM b)) AS sl
          ),
          inter AS (
            SELECT ST_Intersection((SELECT g FROM a), (SELECT g FROM b)) AS g
          ),
          u AS (
            SELECT ST_Multi(
              ST_MakeValid(
                ST_Buffer(
                  ST_Union((SELECT g FROM a), (SELECT g FROM b)),
                  0
                )
              )
            ) AS geom
          )
        SELECT
          (SELECT d <= $3 FROM dist) AS within_100m,
          (SELECT d FROM dist) AS distance_m,
          -- Longueur commune (frontière partagée) en mètres
          (
            SELECT
              COALESCE(
                ST_Length(
                  ST_CollectionExtract((SELECT g FROM inter), 2)::geography
                ),
                0
              )
          ) AS shared_boundary_m,
          -- Superficie de recouvrement en ha
          (
            SELECT
              COALESCE(
                ST_Area((SELECT g FROM inter)::geography) / 10000,
                0
              )
          ) AS overlap_area_ha,
          ST_AsText((SELECT geom FROM u)) AS wkt,
          ST_AsGeoJSON((SELECT geom FROM u)) AS geojson,
          -- Extra: géométrie principale (plus grand polygone) et son anneau extérieur nettoyé
          (
            SELECT ST_AsGeoJSON(
              ST_RemoveRepeatedPoints(
                ST_ExteriorRing(main.geom),
                0.0000001
              )
            )
            FROM (
              SELECT geom
              FROM ST_Dump((SELECT geom FROM u)) d
              ORDER BY ST_Area(d.geom) DESC
              LIMIT 1
            ) AS main
          ) AS outer_geojson,
          (
            SELECT ST_Area(main.geom::geography) / 10000
            FROM (
              SELECT geom
              FROM ST_Dump((SELECT geom FROM u)) d
              ORDER BY ST_Area(d.geom) DESC
              LIMIT 1
            ) AS main
          ) AS area_ha
      `,
        [params.wktA, params.wktB, dist],
      );
      const row = res.rows?.[0];
      return {
        within100m: Boolean(row?.within_100m),
        distance_m: Number(row?.distance_m || 0),
        shared_boundary_m: Number(row?.shared_boundary_m || 0),
        overlap_area_ha: Number(row?.overlap_area_ha || 0),
        wkt: row?.wkt,
        geojson: row?.geojson ? JSON.parse(row.geojson) : null,
        outer_geojson: row?.outer_geojson ? JSON.parse(row.outer_geojson) : null,
        area_ha: Number(row?.area_ha || 0),
      };
    } finally {
      client.release();
    }
  }

  async getPerimetersAsGeoJSON() {
    const sql = `
      SELECT
        gp.id,
        gp.sigam_proc_id,
        gp.sigam_permis_id,
        gp.source,
        gp.type_code,
        gp.permis_code,
        gp.permis_type_code,
        gp.permis_type_label,
        gp.permis_titulaire,
        gp.permis_area_ha,
        ST_AsGeoJSON(gp.geom) AS geojson
      FROM gis_perimeters gp
    `;
    const res = await this.pool.query(sql);
    return res.rows.map((r) => ({
      id: r.id,
      sigam_proc_id: r.sigam_proc_id,
      sigam_permis_id: r.sigam_permis_id,
      source: r.source,
      type_code: r.type_code,
      permis_code: r.permis_code,
      permis_type_code: r.permis_type_code,
      permis_type_label: r.permis_type_label,
      permis_titulaire: r.permis_titulaire,
      permis_area_ha: r.permis_area_ha,
      geometry: JSON.parse(r.geojson),
      // Legacy-style fields for viewers (derived from gis_perimeters)
      idtitre: r.sigam_permis_id,
      typetitre: r.permis_type_label,
      substance1: null,
      substances: null,
      tprenom: null,
      tnom: r.permis_titulaire,
      sig_area: r.permis_area_ha,
    }));
  }

  async getPerimetersByPermisAsGeoJSON(permisId: number) {
    const sql = `
      SELECT
        gp.id,
        gp.sigam_proc_id,
        gp.sigam_permis_id,
        gp.source,
        gp.type_code,
        gp.permis_code,
        gp.permis_type_code,
        gp.permis_type_label,
        gp.permis_titulaire,
        gp.permis_area_ha,
        ST_AsGeoJSON(gp.geom) AS geojson
      FROM gis_perimeters gp
      WHERE gp.sigam_permis_id = $1
        AND gp.geom IS NOT NULL
        AND NOT ST_IsEmpty(gp.geom)
    `;
    const res = await this.pool.query(sql, [permisId]);
    return res.rows.map((r) => ({
      id: r.id,
      sigam_proc_id: r.sigam_proc_id,
      sigam_permis_id: r.sigam_permis_id,
      source: r.source,
      type_code: r.type_code,
      permis_code: r.permis_code,
      permis_type_code: r.permis_type_code,
      permis_type_label: r.permis_type_label,
      permis_titulaire: r.permis_titulaire,
      permis_area_ha: r.permis_area_ha,
      geometry: JSON.parse(r.geojson),
      // Legacy-style fields for viewers (derived from gis_perimeters)
      idtitre: r.sigam_permis_id,
      typetitre: r.permis_type_label,
      substance1: null,
      substances: null,
      tprenom: null,
      tnom: r.permis_titulaire,
      sig_area: r.permis_area_ha,
    }));
  }

  /**
   * Detect administrative location (wilaya/commune/ville) for a given point.
   * Point can be in any supported CRS; we convert to WGS84 then test contains.
   */
  async detectAdminByPoint(
    payload:
      | GisPointInput
      | { points?: GisPointInput[]; x?: number; y?: number },
  ) {
    let lng: number | null = null;
    let lat: number | null = null;

    // If a polygon is provided, take its centroid in WGS84
    const pts = (payload as any)?.points as GisPointInput[] | undefined;
    if (pts && pts.length >= 3) {
      const ring = pts.map((p) => this.toWgs84(p));
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
      }
      // simple centroid of polygon
      let area = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        const f = x0 * y1 - x1 * y0;
        area += f;
        cx += (x0 + x1) * f;
        cy += (y0 + y1) * f;
      }
      area *= 0.5;
      if (area !== 0) {
        cx /= 6 * area;
        cy /= 6 * area;
        lng = cx;
        lat = cy;
      }
    }

    // Fallback to single point if provided
    if (lng === null || lat === null) {
      const point = payload as GisPointInput;
      const res = this.toWgs84(point);
      lng = res[0];
      lat = res[1];
    }

    if (lng === null || lat === null) {
      return { wilaya: null, commune: null, ville: null };
    }
    const client = await this.pool.connect();
    try {
      const sqlWilaya = `
        SELECT wilaya
        FROM cmasig_wilayas
        WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
        LIMIT 1
      `;
      const sqlCommune = `
        SELECT commune, wilaya
        FROM cmasig_communes
        WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
        LIMIT 1
      `;
      const sqlVille = `
        SELECT city_name, admin_name
        FROM cmasig_villes
        WHERE ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography,
          25000
        )
        ORDER BY ST_Distance(
          geom::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography
        )
        LIMIT 1
      `;
      const [wilayaRes, communeRes, villeRes] = await Promise.all([
        client.query(sqlWilaya, [lng, lat]),
        client.query(sqlCommune, [lng, lat]),
        client.query(sqlVille, [lng, lat]),
      ]);
      return {
        wilaya: wilayaRes.rows?.[0]?.wilaya ?? null,
        commune: communeRes.rows?.[0]?.commune ?? null,
        ville:
          villeRes.rows?.[0]?.city_name ??
          villeRes.rows?.[0]?.admin_name ??
          null,
      };
    } catch (err) {
      this.logger.error('Failed to detect admin location', err as Error);
      return { wilaya: null, commune: null, ville: null };
    } finally {
      client.release();
    }
  }

  /**
   * Return one "current" perimeter per mining title (permis), derived from gis_perimeters.
   *
   * Logic:
   * - Group by sigam_permis_id (the titre / permis id).
   * - Within each group, pick the row with the highest sigam_proc_id
   *   (latest procedure), falling back to the highest internal id.
   * - This mimics the old cmasig_titres table, which only stored the
   *   latest perimeter per title, while gis_perimeters keeps the full history.
   */
  async getTitresAsGeoJSON() {
    const sql = `
      WITH ranked AS (
        SELECT
          gp.id,
          gp.sigam_permis_id,
          gp.permis_code,
          gp.permis_type_label,
          gp.permis_titulaire,
          gp.permis_area_ha,
          gp.sigam_proc_id,
          ST_AsGeoJSON(gp.geom) AS geojson,
          ROW_NUMBER() OVER (
            PARTITION BY gp.sigam_permis_id
            ORDER BY gp.sigam_proc_id DESC NULLS LAST, gp.id DESC
          ) AS rn
        FROM gis_perimeters gp
        WHERE gp.geom IS NOT NULL
          AND NOT ST_IsEmpty(gp.geom)
          AND gp.sigam_permis_id IS NOT NULL
      )
      SELECT
        id,
        sigam_permis_id,
        permis_code,
        permis_type_label,
        permis_titulaire,
        permis_area_ha,
        geojson
      FROM ranked
      WHERE rn = 1
    `;
    const res = await this.pool.query(sql);
    return res.rows.map((r) => ({
      id: r.id,
      geometry: JSON.parse(r.geojson),
      idtitre: r.sigam_permis_id,
      code: r.permis_code,
      typetitre: r.permis_type_label,
      substance1: null,
      substances: null,
      pp: null,
      tprenom: null,
      tnom: r.permis_titulaire,
      dateoctroi: null,
      dateexpiration: null,
      carte: null,
      lieudit: null,
      commune: null,
      daira: null,
      wilaya: null,
      idtypetitre: null,
      idsubstance: null,
      idtitulair: null,
      idstatustitre: null,
      sig_area: r.permis_area_ha,
      codetype: null,
      shape_length: null,
      shape_area: null,
    }));
  }

  async getPromotionZonesAsGeoJSON() {
    const sql = `
      SELECT
        objectid,
        idzone,
        nom,
        sig_area,
        ST_AsGeoJSON(geom) AS geojson
      FROM cmasig_promotion
    `;
    const res = await this.pool.query(sql);
    return res.rows.map((r) => ({
      id: r.objectid,
      idzone: r.idzone,
      nom: r.nom,
      sig_area: r.sig_area,
      geometry: JSON.parse(r.geojson),
    }));
  }

  /**
   * Move a promotion polygon to a target table (default: corbeille_promotion) and remove it from cmasig_promotion.
   * Keeps original attributes and adds deletion metadata.
   */
  async movePromotionToTrash(params: {
    objectId: number;
    deletedBy?: string | null;
    commentaire?: string | null;
    targetLayer?: string | null;
  }) {
    const targetMap: Record<string, string> = {
      corbeille: 'corbeille_promotion',
      // Historic buckets
      avis: 'promotion_avis',
      aw: 'promotion_aw',
      attribution: 'promotion_attribution',
      promotion: 'promotion_promotion',
      annule: 'promotion_annule',
      expire: 'promotion_expire',
      refuse: 'promotion_refuse',
      abandon: 'promotion_abandon',
      prorogation: 'promotion_prorogation',
      ville_nouvelle: 'promotion_ville_nouvelle',
      autres: 'promotion_autres',
      // Extended buckets used by the promotion UI
      demande: 'promotion_demande',
      avis_wali: 'promotion_avis_wali',
      avis_defav: 'promotion_avis_defav',
      extension: 'promotion_extension',
      corrige: 'promotion_corrige',
      substitution: 'promotion_substitution',
      fusion: 'promotion_fusion',
      rectification: 'promotion_rectification',
      modification: 'promotion_modification',
      renonce: 'promotion_renonce',
    };
    const requestedTable =
      (params.targetLayer && targetMap[params.targetLayer]) ||
      targetMap.corbeille;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate destination table; if it does not exist, fallback to another known table
      const candidates = Array.from(
        new Set([requestedTable, targetMap.corbeille, 'corbielle_promotion']),
      );
      let targetTable: string | null = null;
      for (const candidate of candidates) {
        const exists = await client.query(
          'SELECT to_regclass($1) AS tbl',
          [candidate],
        );
        if (exists.rows?.[0]?.tbl) {
          targetTable = candidate;
          break;
        }
      }
      if (!targetTable) {
        throw new Error('Aucune table de destination trouvée pour la corbeille Promotion');
      }

      const src = await client.query(
        `
        SELECT
          objectid,
          idzone,
          nom,
          -- use stored value or compute on the fly to avoid NULLs
          COALESCE(sig_area, ST_Area(geom::geography) / 10000) AS sig_area,
          COALESCE(shape_length, ST_Perimeter(geom::geography)) AS shape_length,
          COALESCE(shape_area, ST_Area(geom::geography)) AS shape_area,
          geom
        FROM cmasig_promotion
        WHERE objectid = $1
        FOR UPDATE
      `,
        [params.objectId],
      );
      if (!src.rowCount) {
        throw new Error('Promotion not found');
      }
      const row = src.rows[0];

      // Insert into trash
      await client.query(
        `
        INSERT INTO ${targetTable}
          (objectid, idzone, nom, sig_area, shape_length, shape_area, geom, deleted_by, commentaire, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7,
          $8, $9, NOW())
      `,
        [
          row.objectid,
          row.idzone,
          row.nom,
          row.sig_area,
          row.shape_length,
          row.shape_area,
          row.geom,
          params.deletedBy ?? null,
          params.commentaire ?? null,
        ],
      );

      // Delete from source
      await client.query('DELETE FROM cmasig_promotion WHERE objectid = $1', [
        params.objectId,
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to move promotion to trash', err as Error);
      throw err;
    } finally {
      client.release();
    }
  }

  async getWilayasAsGeoJSON() {
    const sql = `
      SELECT
        objectid,
        wilaya,
        shape_area,
        ST_AsGeoJSON(geom) AS geojson
      FROM cmasig_wilayas
    `;
    const res = await this.pool.query(sql);
    return res.rows.map((r) => ({
      id: r.objectid,
      wilaya: r.wilaya,
      sig_area: r.shape_area,
      geometry: JSON.parse(r.geojson),
    }));
  }

  async getCommunesAsGeoJSON() {
    const sql = `
      SELECT
        objectid,
        commune,
        wilaya,
        code,
        shape_area,
        ST_AsGeoJSON(geom) AS geojson
      FROM cmasig_communes
    `;
    const res = await this.pool.query(sql);
    return res.rows.map((r) => ({
      id: r.objectid,
      commune: r.commune,
      wilaya: r.wilaya,
      code: r.code,
      sig_area: r.shape_area,
      geometry: JSON.parse(r.geojson),
    }));
  }

  async getVillesAsGeoJSON() {
    const sql = `
      SELECT
        objectid,
        city_name,
        admin_name,
        status,
        pop_rank,
        ST_AsGeoJSON(geom) AS geojson
      FROM cmasig_villes
    `;
    const res = await this.pool.query(sql);
    return res.rows.map((r) => ({
      id: r.objectid,
      city_name: r.city_name,
      admin_name: r.admin_name,
      status: r.status,
      pop_rank: r.pop_rank,
      geometry: JSON.parse(r.geojson),
    }));
  }

  /**
   * Analyse a perimeter defined by client-side points using core PostGIS functions:
   * - ST_Area: compute area in hectares
   * - ST_Intersects: find intersecting features (selectable layers)
   * - ST_Distance: compute minimum distance to the nearest non-intersecting mining title (optional)
   */
  async analyzePerimeter(params: {
    points: GisPointInput[];
    layers?: GisOverlapLayersSelection;
  }) {
    const pts = params.points || [];
    if (!pts.length) {
      return {
        areaHa: null,
        overlaps: [],
        minDistanceM: null,
      };
    }

    // Convert to WGS84 and build closed polygon WKT
    const ring: [number, number][] = pts.map((p) => this.toWgs84(p));
    if (ring.length < 3) {
      return {
        areaHa: null,
        overlaps: [],
        minDistanceM: null,
      };
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }

    const coordStrings = ring.map(([lng, lat]) => `${lng} ${lat}`);
    const wkt = `POLYGON((${coordStrings.join(', ')}))`;
    // Tiny epsilon (m²) to ignore numerical slivers when polygons just touch
    const overlapEpsilonM2 = 10; // ~10 m²

    const client = await this.pool.connect();
    try {
      const selection: Record<GisOverlapLayerKey, boolean> = {
        titres: false,
        perimetresSig: false,
        promotion: false,
        modifications: false,
        exclusions: false,
        ...(params.layers || { titres: true }),
      };

      // 1) ST_Area: area in hectares using geography for accurate metric area
      const areaRes = await client.query(
        `
        WITH poly AS (
          SELECT ST_SetSRID(ST_GeomFromText($1), 4326) AS geom
        )
        SELECT ST_Area(geom::geography) / 10000 AS area_ha
        FROM poly
      `,
        [wkt],
      );
      const areaHa = areaRes.rows?.[0]?.area_ha ?? null;

      // 2) Intersections on selected couches
      const overlaps: any[] = [];

      if (selection.titres) {
        const res = await client.query(
          `
          WITH poly AS (
            SELECT
              ST_SetSRID(ST_GeomFromText($1), 4326) AS geom4326,
              ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857) AS geom3857
          ), inter AS (
            SELECT
              t.objectid,
              t.idtitre,
              t.code,
              t.codetype,
              t.typetitre,
              t.substance1,
              t.substances,
              t.pp,
              t.tprenom,
              t.tnom,
              t.dateoctroi,
              t.dateexpiration,
              t.carte,
              t.lieudit,
              t.commune,
              t.daira,
              t.wilaya,
              t.idtypetitre,
              t.idsubstance,
              t.idtitulair,
              t.idstatustitre,
              t.sig_area,
              ST_Intersection(
                ST_Transform(ST_MakeValid(t.geom), 3857),
                (SELECT geom3857 FROM poly)
              ) AS inter_geom
            FROM cmasig_titres t, poly
            WHERE t.geom IS NOT NULL
              AND NOT ST_IsEmpty(t.geom)
              AND t.geom && (SELECT geom4326 FROM poly)
              AND ST_Intersects(t.geom, (SELECT geom4326 FROM poly))
              AND NOT ST_Touches(t.geom, (SELECT geom4326 FROM poly))
          )
          SELECT
            'titres' AS layer_type,
            objectid,
            idtitre,
            code,
            codetype,
            typetitre,
            substance1,
            substances,
            pp,
            tprenom,
            tnom,
            dateoctroi,
            dateexpiration,
            carte,
            lieudit,
            commune,
            daira,
            wilaya,
            idtypetitre,
            idsubstance,
            idtitulair,
            idstatustitre,
            sig_area,
            ST_Area(inter_geom) AS overlap_area_m2,
            ST_Area(inter_geom) / 10000 AS overlap_area_ha
          FROM inter
          WHERE inter_geom IS NOT NULL
            AND NOT ST_IsEmpty(inter_geom)
            AND ST_Dimension(inter_geom) = 2
            AND ST_Area(inter_geom) > $2
        `,
          [wkt, overlapEpsilonM2],
        );
        overlaps.push(...(res.rows || []));
      }

      if (selection.perimetresSig) {
        const res = await client.query(
          `
          WITH poly AS (
            SELECT
              ST_SetSRID(ST_GeomFromText($1), 4326) AS geom4326,
              ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857) AS geom3857
          ), inter AS (
            SELECT
              gp.id,
              gp.sigam_proc_id,
              gp.sigam_permis_id,
              gp.source,
              gp.type_code,
              gp.status,
              gp.permis_code,
              gp.permis_type_code,
              gp.permis_type_label,
              gp.permis_titulaire,
              gp.permis_area_ha,
              ST_Intersection(
                ST_Transform(ST_MakeValid(gp.geom), 3857),
                (SELECT geom3857 FROM poly)
              ) AS inter_geom
            FROM gis_perimeters gp, poly
            WHERE gp.geom IS NOT NULL
              AND NOT ST_IsEmpty(gp.geom)
              AND gp.geom && (SELECT geom4326 FROM poly)
              AND ST_Intersects(gp.geom, (SELECT geom4326 FROM poly))
              AND NOT ST_Touches(gp.geom, (SELECT geom4326 FROM poly))
          )
          SELECT
            'perimetresSig' AS layer_type,
            id,
            sigam_proc_id,
            sigam_permis_id,
            source,
            type_code,
            status,
            permis_code,
            permis_type_code,
            permis_type_label,
            permis_titulaire,
            permis_area_ha,
            ST_Area(inter_geom) AS overlap_area_m2,
            ST_Area(inter_geom) / 10000 AS overlap_area_ha
          FROM inter
          WHERE inter_geom IS NOT NULL
            AND NOT ST_IsEmpty(inter_geom)
            AND ST_Dimension(inter_geom) = 2
            AND ST_Area(inter_geom) > $2
        `,
          [wkt, overlapEpsilonM2],
        );
        overlaps.push(...(res.rows || []));
      }

      if (selection.promotion) {
        const res = await client.query(
          `
          WITH poly AS (
            SELECT
              ST_SetSRID(ST_GeomFromText($1), 4326) AS geom4326,
              ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857) AS geom3857
          ), inter AS (
            SELECT
              p.objectid,
              p.idzone,
              p.nom,
              p.sig_area,
              ST_Intersection(
                ST_Transform(ST_MakeValid(p.geom), 3857),
                (SELECT geom3857 FROM poly)
              ) AS inter_geom
            FROM cmasig_promotion p, poly
            WHERE p.geom IS NOT NULL
              AND NOT ST_IsEmpty(p.geom)
              AND p.geom && (SELECT geom4326 FROM poly)
              AND ST_Intersects(p.geom, (SELECT geom4326 FROM poly))
              AND NOT ST_Touches(p.geom, (SELECT geom4326 FROM poly))
          )
          SELECT
            'promotion' AS layer_type,
            objectid,
            idzone,
            nom,
            sig_area,
            ST_Area(inter_geom) AS overlap_area_m2,
            ST_Area(inter_geom) / 10000 AS overlap_area_ha
          FROM inter
          WHERE inter_geom IS NOT NULL
            AND NOT ST_IsEmpty(inter_geom)
            AND ST_Dimension(inter_geom) = 2
            AND ST_Area(inter_geom) > $2
        `,
          [wkt, overlapEpsilonM2],
        );
        overlaps.push(...(res.rows || []));
      }

      if (selection.modifications) {
        const res = await client.query(
          `
          WITH poly AS (
            SELECT
              ST_SetSRID(ST_GeomFromText($1), 4326) AS geom4326,
              ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857) AS geom3857
          ), inter AS (
            SELECT
              m.objectid,
              m.typemodification,
              m.idtitre,
              m.code,
              m.codetype,
              m.typetitre,
              m.substance1,
              m.pp,
              m.tprenom,
              m.tnom,
              m.sig_area,
              ST_Intersection(
                ST_Transform(ST_MakeValid(m.geom), 3857),
                (SELECT geom3857 FROM poly)
              ) AS inter_geom
            FROM cmasig_modifications m, poly
            WHERE m.geom IS NOT NULL
              AND NOT ST_IsEmpty(m.geom)
              AND m.geom && (SELECT geom4326 FROM poly)
              AND ST_Intersects(m.geom, (SELECT geom4326 FROM poly))
              AND NOT ST_Touches(m.geom, (SELECT geom4326 FROM poly))
          )
          SELECT
            'modifications' AS layer_type,
            objectid,
            typemodification,
            idtitre,
            code,
            codetype,
            typetitre,
            substance1,
            pp,
            tprenom,
            tnom,
            sig_area,
            ST_Area(inter_geom) AS overlap_area_m2,
            ST_Area(inter_geom) / 10000 AS overlap_area_ha
          FROM inter
          WHERE inter_geom IS NOT NULL
            AND NOT ST_IsEmpty(inter_geom)
            AND ST_Dimension(inter_geom) = 2
            AND ST_Area(inter_geom) > $2
        `,
          [wkt, overlapEpsilonM2],
        );
        overlaps.push(...(res.rows || []));
      }

      if (selection.exclusions) {
        const res = await client.query(
          `
          WITH poly AS (
            SELECT
              ST_SetSRID(ST_GeomFromText($1), 4326) AS geom4326,
              ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857) AS geom3857
          ), inter AS (
            SELECT
              e.objectid,
              e.idzone,
              e.nom,
              ST_Intersection(
                ST_Transform(ST_MakeValid(e.geom), 3857),
                (SELECT geom3857 FROM poly)
              ) AS inter_geom
            FROM cmasig_exclusion e, poly
            WHERE e.geom IS NOT NULL
              AND NOT ST_IsEmpty(e.geom)
              AND e.geom && (SELECT geom4326 FROM poly)
              AND ST_Intersects(e.geom, (SELECT geom4326 FROM poly))
              AND NOT ST_Touches(e.geom, (SELECT geom4326 FROM poly))
          )
          SELECT
            'exclusions' AS layer_type,
            objectid,
            idzone,
            nom,
            ST_Area(inter_geom) AS overlap_area_m2,
            ST_Area(inter_geom) / 10000 AS overlap_area_ha
          FROM inter
          WHERE inter_geom IS NOT NULL
            AND NOT ST_IsEmpty(inter_geom)
            AND ST_Dimension(inter_geom) = 2
            AND ST_Area(inter_geom) > $2
        `,
          [wkt, overlapEpsilonM2],
        );
        overlaps.push(...(res.rows || []));
      }

      // 3) Distance to nearest mining title (only if Titres are checked)
      let nearestRow: any = null;
      let minDistanceM: number | null = null;
      if (selection.titres) {
        const distRes = await client.query(
          `
          WITH poly AS (
            SELECT ST_SetSRID(ST_GeomFromText($1), 4326) AS geom
          ),
          non_intersect AS (
            SELECT
              t.geom,
              t.code,
              t.typetitre,
              t.idtitre
            FROM cmasig_titres t, poly
            WHERE t.geom IS NOT NULL
              AND NOT ST_IsEmpty(t.geom)
              AND NOT ST_Intersects(t.geom, (SELECT geom FROM poly))
          )
          SELECT
            ni.code,
            ni.typetitre,
            ni.idtitre,
            ST_Distance(
              ST_Transform(ni.geom, 3857),
              ST_Transform((SELECT geom FROM poly), 3857)
            ) AS min_dist_m
          FROM non_intersect ni
          ORDER BY min_dist_m ASC
          LIMIT 1
        `,
          [wkt],
        );
        nearestRow = distRes.rows?.[0] || null;
        minDistanceM = nearestRow?.min_dist_m ?? null;
      }

      return {
        areaHa,
        overlaps,
        minDistanceM,
        nearestTitle: nearestRow
          ? {
              code: nearestRow.code,
              label: nearestRow.typetitre,
              idtitre: nearestRow.idtitre,
              distance: nearestRow.min_dist_m,
            }
          : null,
      };
    } catch (err) {
      this.logger.error(
        'Failed to analyze perimeter via PostGIS',
        err as Error,
      );
      return {
        areaHa: null,
        overlaps: [],
        minDistanceM: null,
        nearestTitle: null,
      };
    } finally {
      client.release();
    }
  }

  async getLatestPerimeterAreaHa(procId: number): Promise<number | null> {
    if (!Number.isFinite(procId)) return null;

    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `
        SELECT ST_Area(geom::geography) / 10000 AS area_ha
        FROM public.gis_perimeters
        WHERE sigam_proc_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [procId],
      );
      const raw = res.rows?.[0]?.area_ha as number | string | null | undefined;
      const n = raw == null ? null : Number(raw);
      return n != null && Number.isFinite(n) ? n : null;
    } catch (err) {
      this.logger.error(
        `Failed to read perimeter area for proc=${procId}`,
        err as Error,
      );
      return null;
    } finally {
      client.release();
    }
  }

  async upsertTitreFromPerimeter(params: {
    procId: number;
    titreId: number;
    codePermis?: string | null;
    typeLabel?: string | null;
    typeCode?: string | null;
    titulaire?: string | null;
    dateOctroi?: Date | null;
    dateExpiration?: Date | null;
    lieuDit?: string | null;
    commune?: string | null;
    daira?: string | null;
    wilaya?: string | null;
    idTypeTitre?: number | null;
    idSubstance?: number | null;
    idTitulaire?: number | null;
    substance1?: string | null;
    substances?: string | null;
    pp?: number | null;
    mode?: 'insert' | 'upsert';
    throwOnError?: boolean;
  }): Promise<void> {
    const {
      procId,
      titreId,
      codePermis,
      typeLabel,
      typeCode,
      titulaire,
      dateOctroi,
      dateExpiration,
      lieuDit,
      commune,
      daira,
      wilaya,
      idTypeTitre,
      idSubstance,
      idTitulaire,
      substance1,
      substances,
      pp,
      mode = 'insert',
      throwOnError = false,
    } = params;

    const client = await this.pool.connect();
    try {
      // Normalize fields before persisting to CMASIG titles
      const codeNumeric = (() => {
        const raw = (codePermis ?? '').toString().trim();
        if (!raw) return null;
        // Prefer digits at end (e.g. "725"), fallback to last digit group (e.g. "PXC-725A")
        const match = raw.match(/(\d+)$/) ?? raw.match(/(\d+)(?!.*\d)/);
        if (!match?.[1]) return null;
        const n = Number(match[1]);
        return Number.isFinite(n) ? n : null;
      })();

      const typeTitre = (() => {
        const label = (typeLabel ?? '').toString().trim();
        const code = (typeCode ?? '').toString().trim();
        if (!label && !code) return null;
        if (!label) return code;
        if (!code) return label;
        // Avoid duplicating the code if it's already part of the label
        return label.toUpperCase().includes(code.toUpperCase())
          ? label
          : `${label} ${code}`.trim();
      })();

      await client.query('BEGIN');
      const geomRes = await client.query(
        `SELECT ST_AsEWKT(geom) AS ewkt FROM public.gis_perimeters WHERE sigam_proc_id = $1 ORDER BY id DESC LIMIT 1`,
        [procId],
      );
      const ewkt = geomRes.rows?.[0]?.ewkt as string | undefined;
      if (!ewkt) {
        this.logger.warn(
          `No perimeter geometry found for proc=${procId} to upsert titre=${titreId}`,
        );
        await client.query('ROLLBACK');
        if (throwOnError) {
          throw new Error(
            `No perimeter geometry found in sig_gis.gis_perimeters for procedure ${procId}`,
          );
        }
        return;
      }

      let targetObjectId: number | null = null;

      if (mode === 'upsert') {
        // 1) Prefer updating the SIGAM-created row (idtitre = permisId) when present.
        const byIdTitre = await client.query(
          `
          SELECT objectid
          FROM public.cmasig_titres
          WHERE idtitre = $1
          ORDER BY objectid DESC
          LIMIT 1
          `,
          [titreId],
        );
        targetObjectId = (byIdTitre.rows?.[0]?.objectid as number | undefined) ?? null;

        // 2) Fallback: update the latest row matching (code, codetype). This covers historic CMASIG titles.
        if (!targetObjectId && codeNumeric != null) {
          const byCode = await client.query(
            `
            SELECT objectid
            FROM public.cmasig_titres
            WHERE code = $1
              AND (
                $2::text IS NULL
                OR TRIM(UPPER(codetype)) = TRIM(UPPER($2))
                OR codetype IS NULL
              )
            ORDER BY objectid DESC
            LIMIT 1
            `,
            [codeNumeric, typeCode ?? null],
          );
          targetObjectId =
            (byCode.rows?.[0]?.objectid as number | undefined) ?? null;
        }
      }

      if (targetObjectId) {
        await client.query(
          `
          WITH g AS (
            SELECT ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(
                  ST_Force2D(
                    ST_SetSRID(ST_GeomFromEWKT($1), 4326)
                  )
                ),
                3
              )
            ) AS geom
          )
          UPDATE public.cmasig_titres t
          SET
            geom = g.geom,
            shape_length = ST_Perimeter(g.geom),
            shape_area = ST_Area(g.geom),
            sig_area = ST_Area(g.geom::geography) / 10000,
            idtitre = COALESCE(t.idtitre, $2),
            code = COALESCE($3, t.code),
            typetitre = COALESCE($4, t.typetitre),
            codetype = COALESCE($5, t.codetype),
            substance1 = COALESCE($6, t.substance1),
            substances = COALESCE($7, t.substances),
            pp = COALESCE($8, t.pp),
            tnom = COALESCE($9, t.tnom),
            dateoctroi = COALESCE($10, t.dateoctroi),
            dateexpiration = COALESCE($11, t.dateexpiration),
            lieudit = COALESCE($12, t.lieudit),
            commune = COALESCE($13, t.commune),
            daira = COALESCE($14, t.daira),
            wilaya = COALESCE($15, t.wilaya),
            idtypetitre = COALESCE(t.idtypetitre, $16),
            idsubstance = COALESCE(t.idsubstance, $17),
            idtitulair = COALESCE(t.idtitulair, $18)
          FROM g
          WHERE t.objectid = $19
          `,
          [
            ewkt,
            titreId,
            codeNumeric,
            typeTitre,
            typeCode ?? null,
            substance1 ?? null,
            substances ?? null,
            pp ?? null,
            titulaire ?? null,
            dateOctroi ?? null,
            dateExpiration ?? null,
            lieuDit ?? null,
            commune ?? null,
            daira ?? null,
            wilaya ?? null,
            idTypeTitre ?? null,
            idSubstance ?? null,
            idTitulaire ?? null,
            targetObjectId,
          ],
        );
      } else {
        await client.query(
          `
          WITH g AS (
            SELECT ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(
                  ST_Force2D(
                    ST_SetSRID(ST_GeomFromEWKT($1), 4326)
                  )
                ),
                3
              )
            ) AS geom
          )
          INSERT INTO public.cmasig_titres (
            geom,
            shape_length,
            shape_area,
            sig_area,
            idtitre,
            code,
            typetitre,
            codetype,
            substance1,
            substances,
            pp,
            tprenom,
            tnom,
            dateoctroi,
            dateexpiration,
            carte,
            lieudit,
            commune,
            daira,
            wilaya,
            idtypetitre,
            idsubstance,
            idtitulair,
            idstatustitre
          )
          SELECT
            g.geom,
            ST_Perimeter(g.geom),
            ST_Area(g.geom),
            ST_Area(g.geom::geography) / 10000,
            $2,  -- idtitre (SIGAM permis id)
            $3,  -- code (numeric part)
            $4,  -- typetitre
            $5,  -- codetype
            $6,  -- substance1
            $7,  -- substances
            $8,  -- pp
            NULL, -- tprenom
            $9,  -- tnom
            $10, -- dateoctroi
            $11, -- dateexpiration
            NULL, -- carte
            $12, -- lieudit
            $13, -- commune
            $14, -- daira
            $15, -- wilaya
            $16, -- idtypetitre
            $17, -- idsubstance
            $18, -- idtitulair
            NULL  -- idstatustitre
          FROM g
        `,
          [
            ewkt,
            titreId,
            codeNumeric,
            typeTitre,
            typeCode ?? null,
            substance1 ?? null,
            substances ?? null,
            pp ?? 0,
            titulaire ?? null,
            dateOctroi ?? null,
            dateExpiration ?? null,
            lieuDit ?? null,
            commune ?? null,
            daira ?? null,
            wilaya ?? null,
            idTypeTitre ?? null,
            idSubstance ?? null,
            idTitulaire ?? null,
          ],
        );
      }

      // Once the titre is created, the "reserved perimeter" is no longer needed.
      await client.query(`DELETE FROM public.gis_perimeters WHERE sigam_proc_id = $1`, [
        procId,
      ]);

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      this.logger.error(
        `Failed to upsert titre ${titreId} from perimeter proc=${procId}`,
        err as Error,
      );
      if (throwOnError) {
        throw err;
      }
    } finally {
      client.release();
    }
  }

  async linkPermisToPerimeter(
    id_proc: number,
    permisId: number,
    meta?: {
      codePermis?: string | null;
      typeCode?: string | null;
      typeLabel?: string | null;
      titulaire?: string | null;
    },
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        UPDATE gis_perimeters
        SET sigam_permis_id = $2,
            permis_code = COALESCE($3, permis_code),
            permis_type_code = COALESCE($4, permis_type_code),
            permis_type_label = COALESCE($5, permis_type_label),
            permis_titulaire = COALESCE($6, permis_titulaire),
            permis_area_ha = ST_Area(geom::geography) / 10000
        WHERE sigam_proc_id = $1
        `,
        [
          id_proc,
          permisId,
          meta?.codePermis ?? null,
          meta?.typeCode ?? null,
          meta?.typeLabel ?? null,
          meta?.titulaire ?? null,
        ],
      );
      if (result.rowCount === 0) {
        this.logger.warn(
          `No GIS perimeter found to link for proc=${id_proc}, permis=${permisId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to link permis ${permisId} to GIS perimeter for proc=${id_proc}`,
        err as Error,
      );
    } finally {
      client.release();
    }
  }

  // Best-effort removal of legacy titre rows (e.g., old TEC) from CMASIG
  async removeLegacyTitre(titreId: number): Promise<void> {
    if (!titreId) return;
    const client = await this.pool.connect();
    try {
      await client.query(
        `DELETE FROM public.cmasig_titres WHERE idtitre = $1`,
        [titreId],
      );
    } catch (err) {
      this.logger.warn(
        `Failed to delete legacy cmasig_titres row for titre ${titreId}`,
        err as Error,
      );
    } finally {
      client.release();
    }
  }

  async removeLegacyTitreByCode(codePermis: string, keepId?: number): Promise<void> {
    if (!codePermis) return;
    const client = await this.pool.connect();
    try {
      const params: any[] = [codePermis];
      let clause = '';
      if (keepId) {
        params.push(keepId);
        clause = 'AND idtitre <> $2';
      }
      await client.query(
        `DELETE FROM public.cmasig_titres
         WHERE lower(trim(code::text)) = lower(trim($1::text))
         ${clause}`,
        params,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to delete legacy cmasig_titres rows for code ${codePermis}`,
        err as Error,
      );
    } finally {
      client.release();
    }
  }
}