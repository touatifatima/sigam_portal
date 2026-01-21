import * as fs from 'fs';
import csv = require('csv-parser');

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment.');
}

const prisma = createPrismaClient();
type combinaisonPermisProcCSV = {
  id_combinaison: string;
  id_typePermis: string;
  id_proc: string;
};

export async function main() {
  const combinaisonPermisProcData: any[] = [];
  // Précharge les IDs existants pour éviter les FK manquantes
  const [typePermisList, typeProcList] = await Promise.all([
    prisma.typePermis.findMany({ select: { id: true } }),
    prisma.typeProcedure.findMany({ select: { id: true } }),
  ]);
  const typePermisSet = new Set(typePermisList.map(t => t.id));
  const typeProcSet = new Set(typeProcList.map(t => t.id));
  let skippedMissingFK = 0;

  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_combinaisonPermisProc.csv');

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""),
      })
    )
    .on("data", (row: combinaisonPermisProcCSV) => {
      const id_combinaison = parseInt(row.id_combinaison?.trim() || '', 10);
      const id_typePermis = parseInt(row.id_typePermis?.trim() || '', 10);
      const id_typeProc = parseInt(row.id_proc?.trim() || '', 10);

      if (!typePermisSet.has(id_typePermis) || !typeProcSet.has(id_typeProc)) {
        skippedMissingFK++;
        return;
      }

      combinaisonPermisProcData.push({
        id_combinaison,
        id_typePermis,
        id_typeProc,
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      const failedRows: any[] = [];

      // insertion ligne par ligne pour identifier les erreurs
      for (const row of combinaisonPermisProcData) {
        try {
          await prisma.combinaisonPermisProc.create({
            data: row,
          });
        } catch (error: any) {
          console.error("Error inserting row:", row);
          console.error("Error message:", error.message);
          failedRows.push({ row, error: error.message });
        }
      }

      if (failedRows.length > 0) {
        console.log(`Total rows failed: ${failedRows.length}`);
        fs.writeFileSync(
          "combinaisonPermisProc_failed_rows.json",
          JSON.stringify(failedRows, null, 2),
          "utf-8"
        );
        console.log("Failed rows saved to combinaisonPermisProc_failed_rows.json");
      } else {
        console.log("All rows inserted successfully!");
      }
      if (skippedMissingFK > 0) {
        console.warn(`Skipped ${skippedMissingFK} rows (missing typePermis/typeProcedure parents).`);
      }

      await prisma.$disconnect();
    });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
