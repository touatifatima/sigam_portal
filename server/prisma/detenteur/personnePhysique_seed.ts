import * as fs from 'fs';
const csv = require('csv-parser');
import { Prisma } from '@prisma/client';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

const prisma = createPrismaClient();

function parseId(value: string | undefined): number | null {
  const parsed = parseInt(value ?? "", 10);
  if (isNaN(parsed) || parsed === 0) return null;
  return parsed;
}

export async function main() {
  await prisma.$connect();
  let recordCount = 0;
  let successCount = 0;
  const failedRecords: { line: number; id: number | null }[] = [];

  const personnePhysiqueData: { data: Prisma.PersonnePhysiquePortailCreateManyInput }[] = [];
  const csvFilePath = "C:\\Users\\ANAM1408\\Desktop\\BaseSicma_Urgence\\df_personnePhysique.csv";

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }: { header: string }) => header.trim().replace(/\uFEFF/g, ""),
      })
    )
    .on('data', (row: any) => {
      recordCount++;

      const data: Prisma.PersonnePhysiquePortailCreateManyInput = {
        id_personne: parseInt(row.id_personne),
        id_pays: parseId(row.Repr_PaysOrigine)!,
        nomFR: row.NomRepresentant || null,
        prenomFR: row.PrenomRepresentant || null,
        nomAR: row.nomAR || null,
        prenomAR: row.prenomAR || null,
        qualification: row.QualiteRepresentant || null,
        adresse_domicile: row.Repr_Adresse || null,
        telephone: row.Repr_Telephone || null,
        fax: row.Repr_Fax || null,
        email: row.Repr_Email || null,
        siteWeb: row.Repr_Web || null,
      };

      personnePhysiqueData.push({ data });
    })
    .on('end', async () => {
      console.log('CSV loaded, début des insertions...');

      for (let i = 0; i < personnePhysiqueData.length; i++) {
        const { data } = personnePhysiqueData[i];

        try {
          await prisma.personnePhysiquePortail.create({ data });
          successCount++;
        } catch (error: any) {
          failedRecords.push({
            line: i + 1,
            id: data.id_personne ?? null,
          });
        }
      }

      console.log(`\n📌 Total lignes lues : ${recordCount}`);
      console.log(`✅ Lignes insérées : ${successCount}`);
      console.log(`❌ Lignes échouées : ${failedRecords.length}`);

      if (failedRecords.length > 0) {
        console.log("\n❌ Détails des erreurs :");
        console.table(failedRecords);
      }

      await prisma.$disconnect();
      process.exit(0);
    });
}

main().catch(async (e) => {
  console.error("Erreur globale:", e);
  await prisma.$disconnect();
  process.exit(1);
});
