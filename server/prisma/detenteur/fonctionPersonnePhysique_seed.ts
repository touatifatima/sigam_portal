import * as fs from 'fs';
const csv = require('csv-parser');
import { createPrismaClient } from '../../src/prisma/prisma-factory';

const prisma = createPrismaClient();
const csvFilePath = 'T:\\Amina\\BaseSicma_Urgence\\df_fonctionpersonnePhysique.csv';

type FonctionRow = {
  id_fonctionDetent: number | null;
  id_personne: number | null;
  id_detenteur: number | null;
  type_fonction: string | null;
  taux_participation: number | null;
  statut_personne: string | null;
};

const parseNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

async function main() {
  await prisma.$connect();

  const rows: FonctionRow[] = [];
  let total = 0;
  let success = 0;
  const failures: Array<{ line: number; reason: string }> = [];

  // Lecture du CSV
  await new Promise<void>((resolve, reject) => {
    interface CsvRawRow {
      id_fonctionDetent?: string;
      id_personne?: string;
      id_detenteur?: string;
      type_fonction?: string;
      taux_participation?: string;
      statut_personne?: string;
      [key: string]: string | undefined;
    }

    interface CsvParserOptions {
      separator: string;
      mapHeaders: (args: { header: string }) => string;
    }

    const parserOptions: CsvParserOptions = {
      separator: ';',
      mapHeaders: ({ header }: { header: string }) => header.trim().replace(/\uFEFF/g, ''),
    };

    fs.createReadStream(csvFilePath)
      .pipe(csv(parserOptions))
      .on('data', (row: CsvRawRow) => {
        total += 1;
        rows.push({
          id_fonctionDetent: parseNumber(row.id_fonctionDetent),
          id_personne: parseNumber(row.id_personne),
          id_detenteur: parseNumber(row.id_detenteur),
          type_fonction: row.type_fonction || null,
          taux_participation: parseNumber(row.taux_participation),
          statut_personne: row.statut_personne || null,
        });
      })
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error));
  });

  // Insertion ligne par ligne
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];

    // Vérification des IDs
    if (!row.id_personne || !row.id_detenteur) {
      failures.push({
        line: index + 1,
        reason: `Identifiants manquants (personne: ${row.id_personne}, detenteur: ${row.id_detenteur})`,
      });
      continue;
    }

    const personneExists = await prisma.personnePhysiquePortail.findUnique({ where: { id_personne: row.id_personne } });
    const detenteurExists = await prisma.detenteurMoralePortail.findUnique({ where: { id_detenteur: row.id_detenteur } });

    if (!personneExists || !detenteurExists) {
      failures.push({
        line: index + 1,
        reason: `Personne ou détenteur introuvable (personne: ${row.id_personne}, detenteur: ${row.id_detenteur})`,
      });
      continue;
    }

    // Préparation des données
    const data: any = {
      type_fonction: row.type_fonction,
      taux_participation: row.taux_participation ?? 0,
      statut_personne: row.statut_personne,
      personne: { connect: { id_personne: row.id_personne } },
      detenteur: { connect: { id_detenteur : row.id_detenteur } },
    };

    if (row.id_fonctionDetent) {
      data.id_fonctionDetent = row.id_fonctionDetent;
    }

    // Tentative d'insertion
    try {
      await prisma.fonctionPersonneMoral.create({ data });
      success += 1;
    } catch (error: any) {
      failures.push({
        line: index + 1,
        reason: error?.message ?? 'Erreur inconnue',
      });
    }
  }

  // Résumé
  console.log(`\n--- Résumé ---`);
  console.log(`Lignes CSV lues        : ${total}`);
  console.log(`Insertions réussies    : ${success}`);
  console.log(`Insertions échouées    : ${failures.length}`);

  if (failures.length > 0) {
    console.log(`\nDétails des échecs :`);
    failures.forEach(f => console.log(`Ligne ${f.line} : ${f.reason}`));
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Erreur globale :', error);
  await prisma.$disconnect();
  process.exit(1);
});
