import * as fs from 'fs';
import csv = require('csv-parser');

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();
type procedurePhaseEtapesCSV = {
  id_phase: string;
  id_proc: string;
  id_etape: string;
  statut_etape: string;
  date_debut: string;
  date_fin: string;
  link: string;
};
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr === "None" || dateStr === "NaT" || dateStr.trim() === "") {
    // console.log('Inside parseDate, invalid or empty input:', dateStr);
    return null;
  }

//   console.log('Inside parseDate, input:', dateStr);

  let date: Date | null = null;

  // 1️⃣ Format DD/MM/YYYY HH:mm (with optional time)
  const dmMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmMatch) {
    const [, day, month, year, hour = "0", minute = "0"] = dmMatch;
    date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    ));
  }

  // 2️⃣ Format YYYY-MM-DD HH:mm:ss (with optional seconds)
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!date && ymdMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = ymdMatch;
    date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ));
  }

  // 3️⃣ Format YYYY-MM-DD (date only)
  if (!date) {
    const simpleMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (simpleMatch) {
      const [, year, month, day] = simpleMatch;
      date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    }
  }

  // 4️⃣ Format ISO-8601 (e.g., 2025-10-07T14:30:00.000Z)
  if (!date) {
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3}Z)?$/);
    if (isoMatch) {
      const [, year, month, day, hour, minute, second] = isoMatch;
      date = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      ));
    }
  }

  if (!date || isNaN(date.getTime())) {
    console.warn('Failed to parse date:', dateStr);
    return null;
  }

//   console.log('Inside parseDate, parsed:', date.toISOString());
  return date;
}


export async function main() {
  const procedurePhaseEtapesData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_ProcedurePhaseEtapes.csv');

  // Preload ManyEtape map (phase+etape -> id_manyEtape)
  const manyEtapes = await prisma.manyEtape.findMany({
    select: { id_manyEtape: true, id_phase: true, id_etape: true },
  });
  const manyMap = new Map<string, number>();
  manyEtapes.forEach((m) => {
    manyMap.set(`${m.id_phase}-${m.id_etape}`, m.id_manyEtape);
  });

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
      )
    .on("data", (row: procedurePhaseEtapesCSV) => {
      const id_phase = Number(row.id_phase.trim());
      const id_proc = Number(row.id_proc.trim());
      const id_etape = row.id_etape ? Number(row.id_etape.trim()) : null;
      const key = id_etape != null ? `${id_phase}-${id_etape}` : null;
      const id_manyEtape = key ? manyMap.get(key) ?? null : null;

      procedurePhaseEtapesData.push({
        id_proc,
        id_manyEtape,
        statut_etape: row.statut_etape || null,
        date_debut: parseDate(row.date_debut) || null,
        date_fin: parseDate(row.date_fin) || null,
        link: row.link || null,
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        // insert one by one to handle missing id_manyEtape gracefully
        for (const row of procedurePhaseEtapesData) {
          if (!row.id_manyEtape) {
            continue; // skip if mapping missing
          }
          await prisma.procedurePhaseEtapes.create({
            data: row,
          });
        }

        console.log("Seed finished.");
      } catch (error) {
        console.error("Error inserting data:", error);
      } finally {
        await prisma.$disconnect();
      }
    });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
