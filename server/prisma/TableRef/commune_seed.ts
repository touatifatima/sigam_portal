import * as fs from 'fs';
import * as path from 'path';
import csv = require('csv-parser');
import { PrismaClient, Commune } from '@prisma/client';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

const prisma: PrismaClient = createPrismaClient();

type CommuneCSV = {
  id_commune: string;
  id_daira: string;
  nom_communeFR: string;
  nom_communeAR: string;
  nature: string;
};

export async function main() {
  const communeData: Commune[] = [];
  const csvFilePath = path.join('T:', 'cleaned_df', 'df_commune.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Précharge les id_daira existants pour éviter les violations de FK
  const existingDairas = new Set(
    (await prisma.daira.findMany({ select: { id_daira: true } })).map((d) => d.id_daira),
  );

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ''), // supprime BOM + espaces
      }),
    )
    .on('data', (row: CommuneCSV) => {
      if (!row.id_commune) {
        console.warn('Ligne ignorée (id_commune manquant) :', row);
        return;
      }

      const id_commune = Number(row.id_commune.trim());
      const id_daira_raw = row.id_daira?.trim();
      const id_daira =
        id_daira_raw && existingDairas.has(Number(id_daira_raw))
          ? Number(id_daira_raw)
          : null;

      communeData.push({
        id_commune,
        id_daira,
        nom_communeFR: row.nom_communeFR?.trim() ?? '',
        nom_communeAR: row.nom_communeAR?.trim() ?? '',
        nature: row.nature?.trim() ?? '',
      });
    })
    .on('end', async () => {
      console.log('CSV loaded, insertion en base...');

      try {
        await prisma.commune.createMany({
          data: communeData,
          skipDuplicates: true,
        });
        console.log('Seed communes terminé avec succès.');
      } catch (error) {
        console.error('Error inserting data:', error);
      } finally {
        await prisma.$disconnect();
      }
    })
    .on('error', (error) => {
      console.error('Erreur lecture CSV :', error);
      prisma.$disconnect().then(() => process.exit(1));
    });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
