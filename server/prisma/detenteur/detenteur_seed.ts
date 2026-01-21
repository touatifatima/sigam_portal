import * as fs from 'fs';
import * as csv from 'csv-parser';
import { DetenteurMoralePortail, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DetenteurCSV = {
  id_detenteur: string;
  id_pays: string;
  nom_socFR: string;
  nom_socAR: string;
  adresse_siege: string;
  telephone: string;
  fax: string;
  email: string;
  site_web: string;
  date_constitution?: string;
};

export async function main() {
  const DetenteurData: any[] = [];
  const csvFilePath =
    "T:\\cleaned_df\\df_detenteur.csv";

  const validPaysIds = new Set<number>(
    (await prisma.pays.findMany({ select: { id_pays: true } })).map(
      (p) => p.id_pays,
    ),
  );

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
      )
    .on("data", (row: DetenteurCSV) => {
      const parsedPays = Number(row.id_pays);
      const id_pays =
        Number.isFinite(parsedPays) && validPaysIds.has(parsedPays)
          ? parsedPays
          : null;

      DetenteurData.push({
        id_detenteur: Number(row.id_detenteur?.trim()),
        id_pays,
        nom_societeFR: row.nom_socFR,
        nom_societeAR: row.nom_socAR,
        adresse_siege: row.adresse_siege,
        telephone: row.telephone,
        fax: row.fax,
        email: row.email,
        site_web: row.site_web,
        // Schema requires date_constitution; fallback to a default if missing/invalid
        date_constitution: row.date_constitution
          ? new Date(row.date_constitution)
          : new Date('1970-01-01'),
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.detenteurMoralePortail.createMany({
          data: DetenteurData,
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
