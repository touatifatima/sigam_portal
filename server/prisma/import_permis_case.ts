import * as fs from 'fs';
import * as path from 'path';
import {
  PrismaClient,
  StatutProcedure,
  StatutCoord,
  EnumStatutPaiement,
  EnumTypeFonction,
} from '@prisma/client';

// csv-parser export shape differs across TS/CJS interop configs.
// This loader keeps the script stable in both cases.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const csvModule = require('csv-parser');
const csvParser = (csvModule.default ?? csvModule) as (options?: Record<string, unknown>) => NodeJS.ReadWriteStream;

type Row = Record<string, string>;
const prisma = new PrismaClient();
const BASE = 'T:\\Amina\\BaseSicma_Urgence';
const CODE = '1';

const c = (v: unknown) => String(v ?? '').trim();
const i = (v: unknown) => {
  const n = Number(c(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const f = (v: unknown) => {
  const n = Number(c(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const b = (v: unknown) => {
  const s = c(v).toLowerCase();
  if (!s) return null;
  if (['true', '1', 'oui', 'yes', 'vrai'].includes(s)) return true;
  if (['false', '0', 'non', 'no', 'faux'].includes(s)) return false;
  return null;
};
const d = (v: unknown) => {
  const s = c(v);
  if (!s || s === '0' || s === '0000-00-00') return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hour = Number(m[4] ?? 0);
    const minute = Number(m[5] ?? 0);
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};
const tf = (v: unknown): EnumTypeFonction | null => {
  const s = c(v).toLowerCase();
  if (!s) return null;
  if (s.includes('representant') && s.includes('actionnaire')) return EnumTypeFonction.Representant_Actionnaire;
  if (s.includes('actionnaire')) return EnumTypeFonction.Actionnaire;
  if (s.includes('representant')) return EnumTypeFonction.Representant;
  return null;
};
const ps = (v: unknown): StatutProcedure => {
  const s = c(v).toUpperCase();
  if (s.includes('TERMINE')) return StatutProcedure.TERMINEE;
  if (s.includes('ATTENTE')) return StatutProcedure.EN_ATTENTE;
  return StatutProcedure.EN_COURS;
};
const cs = (v: unknown): StatutCoord => {
  const s = c(v).toLowerCase();
  if (s.includes('initial')) return StatutCoord.DEMANDE_INITIALE;
  if (s.includes('ancien')) return StatutCoord.ANCIENNE;
  return StatutCoord.NOUVEAU;
};
const os = (v: unknown): EnumStatutPaiement => {
  const s = c(v).replace(/\s+/g, '_');
  if (s === 'Paye') return EnumStatutPaiement.Paye;
  if (s === 'En_retard') return EnumStatutPaiement.En_retard;
  if (s === 'Annule') return EnumStatutPaiement.Annule;
  if (s === 'Partiellement_paye') return EnumStatutPaiement.Partiellement_paye;
  return EnumStatutPaiement.A_payer;
};

const readCsv = (file: string) =>
  new Promise<Row[]>((resolve, reject) => {
    const rows: Row[] = [];
    const seen = new Map<string, number>();
    fs.createReadStream(file)
      .pipe(
        csvParser({
          separator: ';',
          mapHeaders: ({ header }) => {
            const h = c(header).replace(/\uFEFF/g, '');
            if (!h) return null;
            const n = (seen.get(h) ?? 0) + 1;
            seen.set(h, n);
            return n === 1 ? h : `${h}__${n}`;
          },
        }),
      )
      .on('data', (r) => rows.push(r as Row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

async function main() {
  const forcedPermisId = i(process.argv.find((a) => a.startsWith('--permis-id='))?.split('=')[1]);
  const code = c(process.argv.find((a) => a.startsWith('--code-permis='))?.split('=')[1]) || CODE;

  const files = {
    titres: 'df_titres.csv',
    procedure: 'df_procedure.csv',
    demande: 'df_demandeGeneral.csv',
    demInit: 'df_demInitial.csv',
    obligation: 'df_obligationFiscale.csv',
    coord: 'df_coordonneesGeneral.csv',
    procCoord: 'df_procedureCoord.csv',
    phase: 'df_phases.csv',
    etape: 'df_EtapeProc.csv',
    manyEtape: 'df_ManyEtape.csv',
    ppe: 'df_ProcedurePhaseEtapes.csv',
    detenteur: 'df_detenteur.csv',
    detDem: 'df_detenteurDemande.csv',
    typePermis: 'df_Typepermis.csv',
    typeProc: 'df_typeProcedures.csv',
    statutPermis: 'df_newStatutPermis.csv',
    typePaiement: 'df_typePaiement.csv',
    permisProc: 'df_procedurePermis.csv',
    personnePhysique: 'df_personnePhysique.csv',
    fonctionPersonne: 'df_fonctionpersonnePhysique.csv',
    registreCommerce: 'df_registreCommerce.csv',
    substanceAssocieeDemande: 'df_substanceAssocieeDemande.csv',
  };

  const paths = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, path.join(BASE, v)]));
  for (const p of Object.values(paths)) if (!fs.existsSync(p)) throw new Error(`CSV introuvable: ${p}`);

  const [
    titres, procedures, demandes, demInits, obligations, coords, procCoords, phases, etapes, manyEtapes,
    ppes, detenteurs, detDems, typePermisRows, typeProcRows, statutPermisRows, typePaiementRows, permisProcs,
    personnesPhysiques, fonctionsPersonnes, registresCommerce, substancesAssociees,
  ] = await Promise.all([
    readCsv(paths.titres), readCsv(paths.procedure), readCsv(paths.demande), readCsv(paths.demInit),
    readCsv(paths.obligation), readCsv(paths.coord), readCsv(paths.procCoord), readCsv(paths.phase),
    readCsv(paths.etape), readCsv(paths.manyEtape), readCsv(paths.ppe), readCsv(paths.detenteur),
    readCsv(paths.detDem), readCsv(paths.typePermis), readCsv(paths.typeProc), readCsv(paths.statutPermis),
    readCsv(paths.typePaiement), readCsv(paths.permisProc),
    readCsv(paths.personnePhysique), readCsv(paths.fonctionPersonne), readCsv(paths.registreCommerce),
    readCsv(paths.substanceAssocieeDemande),
  ]);

  const candidates = titres
    .filter((r) => c(r.code_permis) === code)
    .map((r) => {
      const pid = i(r.id_permis);
      if (!pid) return null;
      const dms = demandes.filter((x) => c(x.idTitre) === String(pid));
      const procRows = permisProcs.filter((x) => c(x.id_permis) === String(pid));
      const pids = new Set<number>([
        ...procRows.map((x) => i(x.id_proc)).filter((x): x is number => x !== null),
        ...dms.map((x) => i(x.id_proc)).filter((x): x is number => x !== null),
      ]);
      const score =
        (dms.length ? 3 : 0) +
        (demInits.some((x) => dms.some((d0) => c(d0.id_demande) === c(x.id_demande))) ? 2 : 0) +
        (procRows.length ? 2 : 0) +
        (procCoords.some((x) => pids.has(i(x.id_proc) ?? -1)) ? 2 : 0) +
        (ppes.some((x) => pids.has(i(x.id_proc) ?? -1)) ? 2 : 0) +
        (obligations.some((x) => c(x.id_permis).replace(/\.0$/, '') === String(pid)) ? 1 : 0);
      return { row: r, pid, score };
    })
    .filter((x): x is { row: Row; pid: number; score: number } => x !== null);

  if (!candidates.length) throw new Error(`Aucun permis pour code_permis=${code}`);
  const selected = forcedPermisId
    ? candidates.find((x) => x.pid === forcedPermisId)
    : [...candidates].sort((a, b2) => b2.score - a.score)[0];
  if (!selected) throw new Error('permis-id force invalide');

  const permis = selected.row;
  const permisId = selected.pid;
  const detenteurId = i(permis.id_detenteur);
  const dms = demandes.filter((x) => c(x.idTitre) === String(permisId));
  const dmIds = new Set<number>(dms.map((x) => i(x.id_demande)).filter((x): x is number => x !== null));
  const procRel = permisProcs.filter((x) => c(x.id_permis) === String(permisId));
  const procIds = new Set<number>([
    ...procRel.map((x) => i(x.id_proc)).filter((x): x is number => x !== null),
    ...dms.map((x) => i(x.id_proc)).filter((x): x is number => x !== null),
  ]);
  const procRows = procedures.filter((x) => procIds.has(i(x.id) ?? -1));
  const procCoordRows = procCoords.filter((x) => procIds.has(i(x.id_proc) ?? -1));
  const coordIds = new Set<number>(procCoordRows.map((x) => i(x.id_coord ?? x.id_coordonnees)).filter((x): x is number => x !== null));
  const coordRows = coords.filter((x) => coordIds.has(i(x.id_coord ?? x.id_coordonnees) ?? -1));
  const ppeRows = ppes.filter((x) => procIds.has(i(x.id_proc) ?? -1));
  const manyIds = new Set<number>(ppeRows.map((x) => i(x.id_manyetape ?? x.id_manyEtape)).filter((x): x is number => x !== null));
  const manyRows = manyEtapes.filter((x) => manyIds.has(i(x.id_manyEtape ?? x.id_manyetape) ?? -1));
  const phaseIds = new Set<number>(manyRows.map((x) => i(x.id_phase)).filter((x): x is number => x !== null));
  const etapeIds = new Set<number>(manyRows.map((x) => i(x.id_etape)).filter((x): x is number => x !== null));
  const phaseRows = phases.filter((x) => phaseIds.has(i(x.id_phase) ?? -1));
  const etapeRows = etapes.filter((x) => etapeIds.has(i(x.id_etape) ?? -1));
  const demInitRows = demInits.filter((x) => dmIds.has(i(x.id_demande) ?? -1));
  const oblRows = obligations.filter((x) => c(x.id_permis).replace(/\.0$/, '') === String(permisId));
  const detenteur = detenteurs.find((x) => i(x.id) === detenteurId) ?? null;
  const fonctionRows = detenteurId
    ? fonctionsPersonnes.filter((x) => c(x.id_detenteur).replace(/\.0$/, '') === String(detenteurId))
    : [];
  const personneIds = new Set<number>(
    fonctionRows.map((x) => i(x.id_personne)).filter((x): x is number => x !== null),
  );
  const personneRows = personnesPhysiques.filter((x) => personneIds.has(i(x.id_personne) ?? -1));
  const registreRows = detenteurId
    ? registresCommerce.filter((x) => c(x.id_detenteur).replace(/\.0$/, '') === String(detenteurId))
    : [];
  const substanceRows = substancesAssociees.filter(
    (x) =>
      c(x.idTitre).replace(/\.0$/, '') === String(permisId) &&
      procIds.has(i(x.id_proc) ?? -1),
  );
  const detDemRows = detDems.filter((x) => dmIds.has(i(x.id_demandeGeneral) ?? -1));
  const typePermisId = i(permis.id_typePermis);
  const typePermis = typePermisRows.find((x) => i(x.id_typePermis) === typePermisId) ?? null;
  const statutPermisId = i(permis.id_statut);
  const statutPermis = statutPermisRows.find((x) => i(x.id) === statutPermisId) ?? null;
  const neededTypeProc = new Set<number>([
    ...dms.map((x) => i(x.id_typeProc)).filter((x): x is number => x !== null),
    ...procRows.map((x) => i(x.typeProcedureId)).filter((x): x is number => x !== null),
  ]);
  const typeProcNeeded = typeProcRows.filter((x) => neededTypeProc.has(i(x.id_typeProc) ?? -1));
  const tpById = new Map<number, Row>(); typePaiementRows.forEach((r, idx) => tpById.set(idx + 1, r));
  let resolvedStatutPermisId = statutPermisId;
  const typePaiementIdMap = new Map<number, number>();

  await prisma.$transaction(async (tx) => {
    const user = (await tx.utilisateurPortail.findFirst({ where: detenteurId ? { detenteurId } : undefined, select: { id: true } }))
      ?? (await tx.utilisateurPortail.findFirst({ orderBy: { id: 'asc' }, select: { id: true } }));
    if (!user) throw new Error('Aucun utilisateur pour rattacher la demande');

    if (typePermis && typePermisId) await tx.typePermis.upsert({
      where: { id: typePermisId },
      update: { code_type: c(typePermis.code_type) || null, lib_type: c(typePermis.lib_type) || null, regime: c(typePermis.regime) || null },
      create: { id: typePermisId, code_type: c(typePermis.code_type) || null, lib_type: c(typePermis.lib_type) || null, regime: c(typePermis.regime) || null },
    });
    if (statutPermisId) {
      const statutLabel = c(statutPermis?.lib_statut || permis.lib_statut) || `Statut ${statutPermisId}`;
      const statutDesc = c(statutPermis?.description) || 'Import CSV';
      const byLabel = await tx.statutPermis.findUnique({ where: { lib_statut: statutLabel }, select: { id: true } });
      if (byLabel) {
        resolvedStatutPermisId = byLabel.id;
      } else {
        const byId = await tx.statutPermis.findUnique({ where: { id: statutPermisId }, select: { id: true } });
        if (byId) {
          await tx.statutPermis.update({
            where: { id: statutPermisId },
            data: { lib_statut: statutLabel, description: statutDesc },
          });
          resolvedStatutPermisId = statutPermisId;
        } else {
          await tx.statutPermis.create({
            data: { id: statutPermisId, lib_statut: statutLabel, description: statutDesc },
          });
          resolvedStatutPermisId = statutPermisId;
        }
      }
    }
    if (detenteur && detenteurId) await tx.detenteurMoralePortail.upsert({
      where: { id_detenteur: detenteurId },
      update: { date_constitution: d(detenteur.date_constitution) ?? new Date('1970-01-01'), id_pays: i(detenteur.id_pays), nom_societeFR: c(detenteur.nom_socFR) || null, nom_societeAR: c(detenteur.nom_socAR) || null, adresse_siege: c(detenteur.adresse_siege) || null, telephone: c(detenteur.telephone) || null, fax: c(detenteur.fax) || null, email: c(detenteur.email) || null, PP: b(detenteur.PP), National: b(detenteur.National) },
      create: { id_detenteur: detenteurId, date_constitution: d(detenteur.date_constitution) ?? new Date('1970-01-01'), id_pays: i(detenteur.id_pays), nom_societeFR: c(detenteur.nom_socFR) || null, nom_societeAR: c(detenteur.nom_socAR) || null, adresse_siege: c(detenteur.adresse_siege) || null, telephone: c(detenteur.telephone) || null, fax: c(detenteur.fax) || null, email: c(detenteur.email) || null, PP: b(detenteur.PP), National: b(detenteur.National) },
    });
    for (const r of personneRows) {
      const idPersonne = i(r.id_personne); if (!idPersonne) continue;
      const nin = c(r.num_carteId) || null;
      let safeNin = nin;
      if (nin) {
        const existingNin = await tx.personnePhysiquePortail.findFirst({
          where: {
            num_carte_identite: nin,
            NOT: { id_personne: idPersonne },
          },
          select: { id_personne: true },
        });
        if (existingNin) safeNin = null;
      }
      await tx.personnePhysiquePortail.upsert({
        where: { id_personne: idPersonne },
        update: {
          nomFR: c(r.NomRepresentant) || 'Non renseigne',
          prenomFR: c(r.PrenomRepresentant) || 'Non renseigne',
          qualification: c(r.QualiteRepresentant) || null,
          nomAR: c(r.nomAR) || null,
          prenomAR: c(r.prenomAR) || null,
          adresse_domicile: c(r.Repr_Adresse) || null,
          telephone: c(r.Repr_Telephone) || null,
          fax: c(r.Repr_Fax) || null,
          email: c(r.Repr_Email) || null,
          siteWeb: c(r.Rep_Web) || null,
          ref_professionnelles: c(r.ref_professionnelles) || null,
          id_pays: i(r.Repr_PaysOrigine),
          ...(safeNin ? { num_carte_identite: safeNin } : {}),
        },
        create: {
          id_personne: idPersonne,
          nomFR: c(r.NomRepresentant) || 'Non renseigne',
          prenomFR: c(r.PrenomRepresentant) || 'Non renseigne',
          qualification: c(r.QualiteRepresentant) || null,
          nomAR: c(r.nomAR) || null,
          prenomAR: c(r.prenomAR) || null,
          adresse_domicile: c(r.Repr_Adresse) || null,
          telephone: c(r.Repr_Telephone) || null,
          fax: c(r.Repr_Fax) || null,
          email: c(r.Repr_Email) || null,
          siteWeb: c(r.Rep_Web) || null,
          ref_professionnelles: c(r.ref_professionnelles) || null,
          id_pays: i(r.Repr_PaysOrigine),
          num_carte_identite: safeNin,
        },
      });
    }
    for (const r of fonctionRows) {
      const idFonction = i(r.id_fonctionDetent), idPersonne = i(r.id_personne), idDet = i(r.id_detenteur);
      if (!idFonction || !idPersonne || !idDet) continue;
      await tx.fonctionPersonneMoral.upsert({
        where: { id_fonctionDetent: idFonction },
        update: {
          id_personne: idPersonne,
          id_detenteur: idDet,
          type_fonction: tf(r.type_fonction),
          statut_personne: c(r.statut_personne) || null,
          taux_participation: f(r.taux_participation),
        },
        create: {
          id_fonctionDetent: idFonction,
          id_personne: idPersonne,
          id_detenteur: idDet,
          type_fonction: tf(r.type_fonction),
          statut_personne: c(r.statut_personne) || null,
          taux_participation: f(r.taux_participation),
        },
      });
    }
    for (const r of registreRows) {
      const idReg = i(r.id_registre); if (!idReg || !detenteurId) continue;
      await tx.registreCommercePortail.upsert({
        where: { id: idReg },
        update: {
          id_detenteur: detenteurId,
          numero_rc: c(r.num_rc) || null,
          date_enregistrement: d(r.date_rc),
          capital_social: f(r.capital_social),
          nis: c(r.num_ident_statistiqueNIS) || null,
          nif: c(r.num_immat_fiscalNIF) || null,
          adresse_legale: c(r.adresse_legal) || null,
        },
        create: {
          id: idReg,
          id_detenteur: detenteurId,
          numero_rc: c(r.num_rc) || null,
          date_enregistrement: d(r.date_rc),
          capital_social: f(r.capital_social),
          nis: c(r.num_ident_statistiqueNIS) || null,
          nif: c(r.num_immat_fiscalNIF) || null,
          adresse_legale: c(r.adresse_legal) || null,
        },
      });
    }
    for (const r of typeProcNeeded) {
      const id = i(r.id_typeProc); if (!id) continue;
      await tx.typeProcedure.upsert({ where: { id }, update: { libelle: c(r.libelle_type) || null, description: c(r.description) || null }, create: { id, libelle: c(r.libelle_type) || null, description: c(r.description) || null } });
    }
    for (const idTp of new Set(oblRows.map((x) => i(x.id_typePaiement)).filter((x): x is number => x !== null))) {
      const tpr = tpById.get(idTp);
      const label = c(tpr?.libelle) || `Type paiement ${idTp}`;
      const frequence = c(tpr?.frequence) || 'ANNUELLE';
      const details = c(tpr?.details_calculs) || null;
      const byLabel = await tx.typePaiement.findUnique({ where: { libelle: label }, select: { id: true } });
      if (byLabel) {
        typePaiementIdMap.set(idTp, byLabel.id);
        await tx.typePaiement.update({
          where: { id: byLabel.id },
          data: { frequence, details_calcul: details },
        });
        continue;
      }
      const byId = await tx.typePaiement.findUnique({ where: { id: idTp }, select: { id: true } });
      if (byId) {
        typePaiementIdMap.set(idTp, idTp);
        await tx.typePaiement.update({
          where: { id: idTp },
          data: { libelle: label, frequence, details_calcul: details },
        });
        continue;
      }
      await tx.typePaiement.create({
        data: { id: idTp, libelle: label, frequence, details_calcul: details },
      });
      typePaiementIdMap.set(idTp, idTp);
    }

    for (const r of phaseRows) { const id = i(r.id_phase); if (!id) continue; await tx.phase.upsert({ where: { id_phase: id }, update: { libelle: c(r.libelle) || `Phase ${id}`, ordre: i(r.ordre) ?? id, description: c(r.description) || null }, create: { id_phase: id, libelle: c(r.libelle) || `Phase ${id}`, ordre: i(r.ordre) ?? id, description: c(r.description) || null } }); }
    for (const r of etapeRows) { const id = i(r.id_etape); if (!id) continue; await tx.etapeProc.upsert({ where: { id_etape: id }, update: { lib_etape: c(r.lib_etape) || `Etape ${id}` }, create: { id_etape: id, lib_etape: c(r.lib_etape) || `Etape ${id}` } }); }
    for (const r of manyRows) {
      const id = i(r.id_manyEtape ?? r.id_manyetape), ph = i(r.id_phase), et = i(r.id_etape); if (!id || !ph || !et) continue;
      await tx.manyEtape.upsert({ where: { id_manyEtape: id }, update: { id_phase: ph, id_etape: et, ordre_etape: i(r.ordre_etape) ?? 1, duree_etape: i(r.duree_etape), page_route: c(r.link ?? r.page_route) || null }, create: { id_manyEtape: id, id_phase: ph, id_etape: et, ordre_etape: i(r.ordre_etape) ?? 1, duree_etape: i(r.duree_etape), page_route: c(r.link ?? r.page_route) || null } });
    }

    const procById = new Map(procRows.map((x) => [i(x.id)!, x]));
    for (const pid of procIds) {
      const r = procById.get(pid);
      const dm = dms.find((x) => i(x.id_proc) === pid);
      await tx.procedurePortail.upsert({
        where: { id_proc: pid },
        update: { num_proc: c(r?.id) || String(pid), date_debut_proc: d(r?.DateDebut) ?? d(dm?.date_demande), date_fin_proc: d(r?.DateFin), statut_proc: ps(r?.Fin), observations: c(r?.Commentaires) || null, cause_blocage: c(r?.CausaBloqueo) || null, date_blocage: d(r?.FechaBloqueo), typeProcedureId: i(r?.typeProcedureId) ?? i(dm?.id_typeProc) },
        create: { id_proc: pid, num_proc: c(r?.id) || String(pid), date_debut_proc: d(r?.DateDebut) ?? d(dm?.date_demande), date_fin_proc: d(r?.DateFin), statut_proc: ps(r?.Fin), observations: c(r?.Commentaires) || null, cause_blocage: c(r?.CausaBloqueo) || null, date_blocage: d(r?.FechaBloqueo), typeProcedureId: i(r?.typeProcedureId) ?? i(dm?.id_typeProc) },
      });
    }
    for (const r of substanceRows) {
      const idAssoc = i(r.id_procsub), idProc = i(r.id_proc), idSub = i(r.id_sub);
      if (!idProc || !idSub) continue;
      await tx.substance.upsert({
        where: { id_sub: idSub },
        update: {
          nom_subFR: c(r.SubstancesFR || r.Substances) || null,
          nom_subAR: c(r.SubstancesArabe) || null,
        },
        create: {
          id_sub: idSub,
          nom_subFR: c(r.SubstancesFR || r.Substances) || null,
          nom_subAR: c(r.SubstancesArabe) || null,
        },
      });
      if (idAssoc) {
        await tx.substanceAssocieeDemande.upsert({
          where: { id_assoc: idAssoc },
          update: { id_proc: idProc, id_substance: idSub },
          create: { id_assoc: idAssoc, id_proc: idProc, id_substance: idSub },
        });
      } else {
        const existing = await tx.substanceAssocieeDemande.findFirst({
          where: { id_proc: idProc, id_substance: idSub },
          select: { id_assoc: true },
        });
        if (!existing) {
          await tx.substanceAssocieeDemande.create({
            data: { id_proc: idProc, id_substance: idSub },
          });
        }
      }
    }

    await tx.permisPortail.upsert({
      where: { id: permisId },
      update: { id_typePermis: i(permis.id_typePermis) ?? 1, id_detenteur: detenteurId, id_antenne: i(permis.id_antenne), id_statut: resolvedStatutPermisId, code_permis: c(permis.code_permis) || null, date_octroi: d(permis.date_octroi), date_expiration: d(permis.date_expiration), date_adjudication: d(permis.date_adjudication), date_signature: d(permis.DATE_SIGNATURE ?? permis.date_signature), superficie: f(permis.superficie), lieu_ditFR: c(permis.lieu_ditFR) || null, lieu_ditAR: c(permis.lieu_ditAR) || null, utilisation: c(permis.utilisation) || null, validation: b(permis.Validation), hypothec: c(permis.Hypotheq) || null, commentaires: c(permis.observations) || null },
      create: { id: permisId, id_typePermis: i(permis.id_typePermis) ?? 1, id_detenteur: detenteurId, id_antenne: i(permis.id_antenne), id_statut: resolvedStatutPermisId, code_permis: c(permis.code_permis) || null, date_octroi: d(permis.date_octroi), date_expiration: d(permis.date_expiration), date_adjudication: d(permis.date_adjudication), date_signature: d(permis.DATE_SIGNATURE ?? permis.date_signature), superficie: f(permis.superficie), lieu_ditFR: c(permis.lieu_ditFR) || null, lieu_ditAR: c(permis.lieu_ditAR) || null, utilisation: c(permis.utilisation) || null, validation: b(permis.Validation), hypothec: c(permis.Hypotheq) || null, commentaires: c(permis.observations) || null },
    });

    for (const r of dms) {
      const id = i(r.id_demande); if (!id) continue;
      await tx.demandePortail.upsert({
        where: { id_demande: id },
        update: { id_proc: i(r.id_proc), id_typeProc: i(r.id_typeProc), id_typePermis: i(r.id_typePermis), id_wilaya: i(r.id_wilaya), id_daira: i(r.id_daira), id_commune: i(r.id_commune), code_demande: c(r.code_demande) || null, date_demande: d(r.date_demande), lieu_ditFR: c(r.lieu_DitFR) || null, lieu_dit_ar: c(r.lieu_DitAR) || null, superficie: f(r.Superficie), statut_juridique_terrain: c(r.statut_juridique_terrain) || null, LocPointOrigine: c(r.LocPointOrigine) || null, statut_demande: c(r.statut_demande) || 'EN_COURS', dossier_recevable: b(r.DossierRecevable), dossier_complet: b(r.DossierComplet), PP: b(r.PP), utilisateurId: user.id, Nom_Prenom_Resp_Enregist: c(r.Nom_Prenom_Resp_Enregist) || null },
        create: { id_demande: id, id_proc: i(r.id_proc), id_typeProc: i(r.id_typeProc), id_typePermis: i(r.id_typePermis), id_wilaya: i(r.id_wilaya), id_daira: i(r.id_daira), id_commune: i(r.id_commune), code_demande: c(r.code_demande) || null, date_demande: d(r.date_demande), lieu_ditFR: c(r.lieu_DitFR) || null, lieu_dit_ar: c(r.lieu_DitAR) || null, superficie: f(r.Superficie), statut_juridique_terrain: c(r.statut_juridique_terrain) || null, LocPointOrigine: c(r.LocPointOrigine) || null, statut_demande: c(r.statut_demande) || 'EN_COURS', dossier_recevable: b(r.DossierRecevable), dossier_complet: b(r.DossierComplet), PP: b(r.PP), utilisateurId: user.id, Nom_Prenom_Resp_Enregist: c(r.Nom_Prenom_Resp_Enregist) || null },
      });
    }
    for (const r of demInitRows) {
      const idDem = i(r.id_demande), idDemInit = i(r.id_demInitial); if (!idDem || !idDemInit) continue;
      await tx.demInitial.upsert({ where: { id_demande: idDem }, update: { id_demInitial: idDemInit, duree_trvx: i(r.duree_trvx), date_demarrage_prevue: d(r.date_demarrage_prevue), qualite_signataire: c(r.qualite_signataire) || null, rec_enquete_date: d(r.rec_enquete_date), rec_enquete_nomRespon: c(r.rec_enquete_nomRespon) || null, ConResGeo: f(r.ConResGeo), ConResExp: f(r.ConResExp), VolumePrevu: f(r.VolumePrevu), intitule_projet: c(r.intitule_projet) || null, montant_produit: f(r.montant_produit) }, create: { id_demInitial: idDemInit, id_demande: idDem, duree_trvx: i(r.duree_trvx), date_demarrage_prevue: d(r.date_demarrage_prevue), qualite_signataire: c(r.qualite_signataire) || null, rec_enquete_date: d(r.rec_enquete_date), rec_enquete_nomRespon: c(r.rec_enquete_nomRespon) || null, ConResGeo: f(r.ConResGeo), ConResExp: f(r.ConResExp), VolumePrevu: f(r.VolumePrevu), intitule_projet: c(r.intitule_projet) || null, montant_produit: f(r.montant_produit) } });
    }

    const coordById = new Map<number, Row>(coordRows.map((x) => [i(x.id_coord ?? x.id_coordonnees)!, x]));
    for (const r of coordRows) {
      const idCoord = i(r.id_coord ?? r.id_coordonnees), x = f(r.x), y = f(r.y); if (!idCoord || x === null || y === null) continue;
      await tx.coordonneePortail.upsert({ where: { id_coordonnees: idCoord }, update: { point: c(r.NPol ?? r.point) || null, x, y, z: 0, system: 'UTM', zone: i(r.h) ?? i(r.idDivision), hemisphere: y >= 0 ? 'N' : 'S' }, create: { id_coordonnees: idCoord, point: c(r.NPol ?? r.point) || null, x, y, z: 0, system: 'UTM', zone: i(r.h) ?? i(r.idDivision), hemisphere: y >= 0 ? 'N' : 'S' } });
    }
    for (const r of procCoordRows) {
      const idPc = i(r.Id_procCoord ?? r.id_procedureCoord), idProc = i(r.id_proc), idCoord = i(r.id_coord ?? r.id_coordonnees); if (!idProc || !idCoord) continue;
      const st = cs(coordById.get(idCoord)?.TypeCord);
      if (idPc) await tx.procedureCoord.upsert({ where: { id_procedureCoord: idPc }, update: { id_proc: idProc, id_coordonnees: idCoord, statut_coord: st }, create: { id_procedureCoord: idPc, id_proc: idProc, id_coordonnees: idCoord, statut_coord: st } });
      else if (!(await tx.procedureCoord.findFirst({ where: { id_proc: idProc, id_coordonnees: idCoord }, select: { id_procedureCoord: true } }))) await tx.procedureCoord.create({ data: { id_proc: idProc, id_coordonnees: idCoord, statut_coord: st } });
    }

    for (const r of procRel) {
      const idPP = i(r.id_procedurePermis), idProc = i(r.id_proc); if (!idProc) continue;
      if (idPP) await tx.permisProcedure.upsert({ where: { id_procedurePermis: idPP }, update: { id_permis: permisId, id_proc: idProc, date_octroi_proc: d(r.date_octroi_proc ?? r.date_signature) }, create: { id_procedurePermis: idPP, id_permis: permisId, id_proc: idProc, date_octroi_proc: d(r.date_octroi_proc ?? r.date_signature) } });
      else if (!(await tx.permisProcedure.findFirst({ where: { id_permis: permisId, id_proc: idProc }, select: { id_procedurePermis: true } }))) await tx.permisProcedure.create({ data: { id_permis: permisId, id_proc: idProc, date_octroi_proc: d(r.date_octroi_proc ?? r.date_signature) } });
    }

    const manyById = new Map<number, Row>(manyRows.map((x) => [i(x.id_manyEtape ?? x.id_manyetape)!, x]));
    for (const r of ppeRows) {
      const idProc = i(r.id_proc), idMany = i(r.id_manyetape ?? r.id_manyEtape); if (!idProc || !idMany) continue;
      const existing = await tx.procedurePhaseEtapes.findFirst({ where: { id_proc: idProc, id_manyEtape: idMany, statut_etape: c(r.statut_etape) || null, date_debut: d(r.date_debut), date_fin: d(r.date_fin) }, select: { id_procPhaseEtape: true } });
      if (!existing) await tx.procedurePhaseEtapes.create({ data: { id_proc: idProc, id_manyEtape: idMany, statut_etape: c(r.statut_etape) || null, date_debut: d(r.date_debut), date_fin: d(r.date_fin), link: c(r.link) || null } });
    }
    const phaseMap = new Map<string, { ordre: number; statut: StatutProcedure }>();
    const etapeMap = new Map<string, { statut: StatutProcedure; dateDebut: Date; dateFin: Date | null; link: string | null }>();
    for (const r of ppeRows) {
      const idProc = i(r.id_proc), idMany = i(r.id_manyetape ?? r.id_manyEtape); if (!idProc || !idMany) continue;
      const many = manyById.get(idMany); const idPhase = i(many?.id_phase), idEtape = i(many?.id_etape); if (!idPhase || !idEtape) continue;
      const s = ps(r.statut_etape); const keyPh = `${idProc}:${idPhase}`; if (!phaseMap.has(keyPh)) phaseMap.set(keyPh, { ordre: i(phaseRows.find((p) => i(p.id_phase) === idPhase)?.ordre) ?? 1, statut: s });
      const keyEt = `${idProc}:${idEtape}`; const deb = d(r.date_debut) ?? new Date(); const fin = d(r.date_fin); const cur = etapeMap.get(keyEt);
      if (!cur) etapeMap.set(keyEt, { statut: s, dateDebut: deb, dateFin: fin, link: c(r.link) || null }); else { if (deb < cur.dateDebut) cur.dateDebut = deb; if (fin && (!cur.dateFin || fin > cur.dateFin)) cur.dateFin = fin; cur.statut = s; }
    }
    for (const [k, v] of phaseMap) { const [p1, p2] = k.split(':').map(Number); await tx.procedurePhase.upsert({ where: { id_proc_id_phase: { id_proc: p1, id_phase: p2 } }, update: { ordre: v.ordre, statut: v.statut }, create: { id_proc: p1, id_phase: p2, ordre: v.ordre, statut: v.statut } }); }
    for (const [k, v] of etapeMap) { const [p1, e1] = k.split(':').map(Number); await tx.procedureEtape.upsert({ where: { id_proc_id_etape: { id_proc: p1, id_etape: e1 } }, update: { statut: v.statut, date_debut: v.dateDebut, date_fin: v.dateFin, link: v.link }, create: { id_proc: p1, id_etape: e1, statut: v.statut, date_debut: v.dateDebut, date_fin: v.dateFin, link: v.link } }); }

    for (const r of oblRows) {
      const id = i(r.id_obligation), idTp = i(r.id_typePaiement), an = i(r.annee_fiscale), mt = f(r.montant_attendu); if (!id || !idTp || !an || mt === null) continue;
      const mappedTypePaiementId = typePaiementIdMap.get(idTp) ?? idTp;
      await tx.obligationFiscale.upsert({ where: { id }, update: { id_typePaiement: mappedTypePaiementId, id_permis: permisId, annee_fiscale: an, montant_attendu: mt, date_echeance: d(r.date_echeance) ?? new Date(`${an}-12-31T00:00:00.000Z`), statut: os(r.statut), details_calcul: c(r.details_calcul) || null }, create: { id, id_typePaiement: mappedTypePaiementId, id_permis: permisId, annee_fiscale: an, montant_attendu: mt, date_echeance: d(r.date_echeance) ?? new Date(`${an}-12-31T00:00:00.000Z`), statut: os(r.statut), details_calcul: c(r.details_calcul) || null } });
    }

    for (const r of detDemRows) {
      const idDd = i(r.id_detenteurDemande), idDem = i(r.id_demandeGeneral), idDet = i(r.id_detenteur) ?? detenteurId; if (!idDd || !idDem || !idDet) continue;
      await tx.detenteurDemandePortail.upsert({ where: { id_detenteurDemande: idDd }, update: { id_demande: idDem, id_detenteur: idDet, role_detenteur: c(r.role_detenteur) || null }, create: { id_detenteurDemande: idDd, id_demande: idDem, id_detenteur: idDet, role_detenteur: c(r.role_detenteur) || null } });
    }
    if (detenteurId) for (const idDem of dmIds) if (!(await tx.detenteurDemandePortail.findFirst({ where: { id_demande: idDem, id_detenteur: detenteurId }, select: { id_detenteurDemande: true } }))) await tx.detenteurDemandePortail.create({ data: { id_demande: idDem, id_detenteur: detenteurId, role_detenteur: 'titulaire' } });
  });

  console.log(JSON.stringify({
    code_permis: code,
    permis_id_selectionne: permisId,
    candidates: candidates.map((x) => ({ permisId: x.pid, score: x.score })),
    inserted: {
      procedure_count: procIds.size, demande_count: dms.length, demInitial_count: demInitRows.length,
      coordonnee_count: coordRows.length, procedure_coord_count: procCoordRows.length,
      phase_count: phaseRows.length, etape_count: etapeRows.length, ppe_count: ppeRows.length,
      obligation_count: oblRows.length, detenteur_demande_count: detDemRows.length,
      registre_count: registreRows.length, personne_count: personneRows.length,
      fonction_count: fonctionRows.length, substance_assoc_count: substanceRows.length,
    },
  }, null, 2));
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
