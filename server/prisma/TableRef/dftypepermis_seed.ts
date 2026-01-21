import * as fs from 'fs';
import * as path from 'path';
import csv = require('csv-parser');
import { createPrismaClient } from '../../src/prisma/prisma-factory';

const prisma = createPrismaClient();

type TypePermisCSV = {
  id_typePermis: string;
  id_taxe: string;
  lib_type: string;
  code_type: string;
  regime: string;
  duree_initiale: string;
  nbr_renouv_max: string;
  duree_renouv: string;
  delai_renouv: string;
  superficie_max: string;
  ref_legales: string; // header sans accent
};

export async function main() {
  const typePermisData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_Typepermis.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  try {
    fs.accessSync(csvFilePath, fs.constants.R_OK);
  } catch (error) {
    console.error(`Impossible de lire le fichier : ${csvFilePath}`);
    console.error('Erreur :', error);
    await prisma.$disconnect();
    process.exit(1);
  }

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ''), // supprime BOM + espaces
      }),
    )
    .on('data', (row: TypePermisCSV) => {
      typePermisData.push({
        id: Number(row.id_typePermis?.trim()),
        id_taxe: row.id_taxe && Number(row.id_taxe) !== 0 ? Number(row.id_taxe) : null,
        lib_type: row.lib_type?.trim(),
        code_type: row.code_type?.trim(),
        regime: row.regime || null,
        duree_initiale: row.duree_initiale ? parseFloat(row.duree_initiale.trim().replace(',', '.')) : null,
        nbr_renouv_max: row.nbr_renouv_max ? parseInt(row.nbr_renouv_max.trim().replace(',', '.')) : null,
        duree_renouv: row.duree_renouv ? parseFloat(row.duree_renouv.trim().replace(',', '.')) : null,
        delai_renouv: row.delai_renouv ? parseInt(row.delai_renouv.trim().replace(',', '.')) : null,
        superficie_max: row.superficie_max ? parseFloat(row.superficie_max.trim().replace(',', '.')) : null,
        ref_legales: (row as any).ref_legales || (row as any)['ref_lÇ¸gales'] || null,
      });
    })
    .on('end', async () => {
      console.log(`CSV chargé (${typePermisData.length} lignes). Insertion...`);

      try {
        await prisma.typePermis.createMany({
          data: typePermisData,
          skipDuplicates: true,
        });
        console.log('Insertion terminée !');
      } catch (error) {
        console.error('Erreur Prisma :', error);
      } finally {
        await prisma.$disconnect();
      }
    })
    .on('error', async (error) => {
      console.error('Erreur lecture CSV :', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
