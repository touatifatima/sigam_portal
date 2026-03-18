import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { GisService } from '../gis/gis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InscriptionProvisoireService } from './inscription-provisoire.service';

function createGisPool(): Pool {
  const connectionString =
    process.env.GIS_DATABASE_URL ||
    'postgresql://postgres:ANAM2025@localhost:5433/sig_gis';

  const wantsSsl =
    /[?&]sslmode=require/i.test(connectionString) ||
    /[?&]ssl=true/i.test(connectionString) ||
    String(process.env.GIS_DATABASE_SSL || '').toLowerCase() === 'true' ||
    String(process.env.GIS_DB_SSL || '').toLowerCase() === 'true';

  return new Pool({
    connectionString,
    ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

async function bootstrap() {
  const logger = new Logger('SyncInscriptionProvisoire');
  const prisma = new PrismaService();
  const gisPool = createGisPool();

  try {
    await prisma.$connect();

    const gisService = new GisService();
    const inscriptionService = new InscriptionProvisoireService(
      prisma,
      null as any,
      gisService,
    );

    const sourceCount = await prisma.inscriptionProvisoirePortail.count();
    const beforeRes = await gisPool.query(
      `SELECT COUNT(*)::int AS count FROM public.inscription_provisoire`,
    );
    const beforeCount = Number(beforeRes.rows?.[0]?.count ?? 0);

    logger.log(
      `Start sync: source(SIGAM)=${sourceCount}, target(SIG_GIS before)=${beforeCount}`,
    );

    await inscriptionService.syncAllToGisLayer();

    const afterRes = await gisPool.query(
      `SELECT COUNT(*)::int AS count FROM public.inscription_provisoire`,
    );
    const duplicatesRes = await gisPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM public.inscription_provisoire ip
      JOIN public.gis_perimeters gp
        ON gp.sigam_proc_id = ip.sigam_proc_id
      WHERE gp.geom IS NOT NULL
        AND NOT ST_IsEmpty(gp.geom)
      `,
    );

    const afterCount = Number(afterRes.rows?.[0]?.count ?? 0);
    const duplicatesCount = Number(duplicatesRes.rows?.[0]?.count ?? 0);

    logger.log(
      `Sync done: target(SIG_GIS after)=${afterCount}, overlap with gis_perimeters=${duplicatesCount}`,
    );
  } finally {
    await Promise.allSettled([prisma.$disconnect(), gisPool.end()]);
  }
}

bootstrap()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('sync:inscription-provisoire failed', err);
    process.exit(1);
  });

