import * as fs from 'fs';
import csv = require('csv-parser');
import { createPrismaClient } from '../../src/prisma/prisma-factory';
import * as path from 'path';

const prisma = createPrismaClient();

type procedurePermisCSV = {
  id_procedurePermis: string;
  id_proc: string;
  id_permis: string;


};

export async function main() {
  const procedurePermisData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_procedurePermis.csv');

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
      )
    .on("data", (row: procedurePermisCSV) => {
      procedurePermisData.push({
        id_procedurePermis: Number(row.id_procedurePermis.trim()),
        id_proc: Number(row.id_proc.trim()),
        id_permis: Number(row.id_permis.trim()),

      });
    })
    .on("end", async () => {
      console.log("CSV loaded, checking foreign keys before insert...");

      try {
        // Load existing Permis and Procedure IDs to avoid FK violations
        const [permisIds, procedureIds] = await Promise.all([
          prisma.permisPortail.findMany({ select: { id: true } }),
          prisma.procedurePortail.findMany({ select: { id_proc: true } }),
        ]);

        const permisIdSet = new Set(permisIds.map((p) => p.id));
        const procIdSet = new Set(procedureIds.map((p) => p.id_proc));

        const validData = procedurePermisData.filter((row) => {
          const hasPermis = permisIdSet.has(row.id_permis);
          const hasProc = procIdSet.has(row.id_proc);
          if (!hasPermis || !hasProc) {
            console.warn(
              `Skipping permisProcedure row id_procedurePermis=${row.id_procedurePermis} ` +
                `(id_permis=${row.id_permis}, id_proc=${row.id_proc}) - missing referenced Permis or Procedure`
            );
          }
          return hasPermis && hasProc;
        });

        console.log(
          `Inserting ${validData.length} permisProcedure rows (out of ${procedurePermisData.length})...`
        );

        if (validData.length > 0) {
          await prisma.permisProcedure.createMany({
            data: validData,
            skipDuplicates: true,
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
