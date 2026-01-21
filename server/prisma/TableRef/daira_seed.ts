import * as fs from 'fs';
import csv = require('csv-parser');
import { Daira } from "@prisma/client";

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();
type DairaCSV = {
  id_daira: string;
  id_wilaya: string;
  nom_dairaFR: string;
  nom_dairaAR: string;
};

export async function main() {
  const dairaData: any[] = [];
  const csvFilePath = path.join('T:', 'cleaned_df', 'df_daira.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Précharge les wilayas existantes pour éviter les violations de FK
  const existingWilayas = new Set(
    (await prisma.wilaya.findMany({ select: { id_wilaya: true } })).map((w) => w.id_wilaya),
  );

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), // supprime BOM + espaces
        })
      )
    .on("data", (row: DairaCSV) => {
      if (!row.id_daira) {
        console.warn('Ligne ignorée (id_daira manquant) :', row);
        return;
      }

      const id_daira = Number(row.id_daira?.trim());
      const id_wilaya_raw = row.id_wilaya?.trim();
      const id_wilaya =
        id_wilaya_raw && existingWilayas.has(Number(id_wilaya_raw))
          ? Number(id_wilaya_raw)
          : null;

      dairaData.push({
        id_daira,
        id_wilaya,
        nom_dairaFR: row.nom_dairaFR?.trim() ?? '',
        nom_dairaAR: row.nom_dairaAR?.trim() ?? '',
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.daira.createMany({
          data: dairaData,
          skipDuplicates: true,
        });

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

