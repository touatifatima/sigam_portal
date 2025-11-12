// prisma/antenne_seed.ts
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { PrismaClient, AntennePortail } from '@prisma/client'; // CORRIGÉ

const prisma = new PrismaClient();

type AntenneCSV = {
  id_antenne: string;
  nom: string;
  localisation: string;
};

export async function main() {
  const antenneData: AntennePortail[] = []; // CORRIGÉ
  const csvFilePath = "C:\\Users\\A\\Desktop\\cleaned_df\\df_antenne.csv";

  // Vérifie que le fichier existe
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Vérifie les permissions de lecture
  try {
    fs.accessSync(csvFilePath, fs.constants.R_OK);
  } catch (error) {
    console.error(`Impossible de lire le fichier : ${csvFilePath}`);
    console.error('Erreur :', error);
    await prisma.$disconnect();
    process.exit(1);
  }

  fs.createReadStream(csvFilePath)
    .pipe(csv({ separator: ',' }))
    .on('data', (row: AntenneCSV) => {
      console.log("Ligne CSV :", row);

      if (!row.id_antenne || !row.nom) {
        console.warn('Ligne ignorée (données manquantes) :', row);
        return;
      }

      const localisation = row.localisation?.trim() || null;

      antenneData.push({
        id_antenne: Number(row.id_antenne),
        nom: row.nom.trim(),
        localisation: localisation,
      });
    })
    .on('end', async () => {
      console.log('CSV chargé, insertion en base...');
      console.log(`${antenneData.length} enregistrements à insérer`);

      if (antenneData.length === 0) {
        console.log('Aucune donnée à insérer');
        await prisma.$disconnect();
        return;
      }

      try {
        await prisma.antennePortail.createMany({ // CORRIGÉ
          data: antenneData,
          skipDuplicates: true,
        });

        console.log(`Succès : ${antenneData.length} antennes insérées`);
        console.log("Seed Antenne terminé avec succès");
      } catch (error: any) {
        console.error("Erreur lors de l'insertion :", error.message);
        if (error.code === 'P2002') {
          console.error("Conflit de clé unique (duplicate) détecté");
        }
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
  console.error('Erreur fatale :', e);
  await prisma.$disconnect();
  process.exit(1);
});