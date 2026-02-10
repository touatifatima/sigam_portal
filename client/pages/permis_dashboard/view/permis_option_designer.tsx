'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import styles from './PermisView.module.css';
import { computePermisSuperficie } from '@/utils/permisHelpers';
import { toast } from 'react-toastify';
import type { PermisDesignerDataSection, PermisDesignerDataEditor } from '../../../components/types';

const PermisDesigner = dynamic(() => import('../../../components/PermisDesigner'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading designer...</div>,
});

const isOptionProcedure = (proc: any): boolean => {
  const candidates = [
    proc?.typeProcedure,
    ...(Array.isArray(proc?.demandes) ? proc.demandes.map((d: any) => d?.typeProcedure) : []),
  ].filter(Boolean);

  return candidates.some((tp: any) => {
    const lib = String(tp?.libelle || '').toLowerCase();
    const code = String(tp?.code || '').toLowerCase();
    const desc = String(tp?.description || '').toLowerCase();
    return lib.includes('option') || code.includes('option') || desc.includes('option');
  });
};

const PermisOptionDesignerPage = () => {
  const searchParams = useSearchParams();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const { currentView, navigateTo } = useViewNavigator('dashboard');

  const permisIdParam = searchParams?.get('permisId') || searchParams?.get('id');
  const permisId = permisIdParam ? Number(permisIdParam) : NaN;

  const [permis, setPermis] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(!!permisIdParam);
  const [error, setError] = useState<string | null>(null);
  const [dataValues, setDataValues] = useState<Record<string, any>>({});
  const [dataSaving, setDataSaving] = useState(false);
  const [wilayas, setWilayas] = useState<any[]>([]);
  const [dairas, setDairas] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [substances, setSubstances] = useState<any[]>([]);
  const [statutsJuridiques, setStatutsJuridiques] = useState<any[]>([]);

  const fetchPermis = useCallback(
    async (silent = false) => {
      if (!apiURL) {
        setError('Configuration API manquante');
        setLoading(false);
        return;
      }
      if (!permisIdParam) {
        setError('permisId manquant');
        setLoading(false);
        return;
      }
      if (!Number.isFinite(permisId)) {
        setError('permisId invalide');
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${apiURL}/Permisdashboard/${permisId}`, {
          withCredentials: true,
        });
        setPermis(res.data);
      } catch (e: any) {
        console.error('Failed to load permis for designer', e);
        setError(e?.response?.data?.message || 'Impossible de charger le permis');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiURL, permisId, permisIdParam],
  );

  useEffect(() => {
    void fetchPermis();
  }, [fetchPermis]);

  useEffect(() => {
    if (!apiURL) return;
    const loadLists = async () => {
      try {
        const [wilRes, subRes, statutRes] = await Promise.all([
          axios.get(`${apiURL}/api/wilayas`, { withCredentials: true }),
          axios.get(`${apiURL}/api/substances`, { withCredentials: true }),
          axios.get(`${apiURL}/api/statuts-juridiques`, { withCredentials: true }),
        ]);
        setWilayas(Array.isArray(wilRes.data) ? wilRes.data : []);
        setSubstances(Array.isArray(subRes.data) ? subRes.data : []);
        setStatutsJuridiques(Array.isArray(statutRes.data) ? statutRes.data : []);
      } catch (e) {
        console.error('Failed to load reference lists', e);
        toast.error('Impossible de charger les listes');
      }
    };
    void loadLists();
  }, [apiURL]);

  useEffect(() => {
    if (!apiURL) return;
    const wilayaId = Number(dataValues.id_wilaya);
    if (!Number.isFinite(wilayaId)) {
      setDairas([]);
      setCommunes([]);
      return;
    }
    const loadDairas = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/wilayas/${wilayaId}/dairas`, {
          withCredentials: true,
        });
        setDairas(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Failed to load dairas', e);
        setDairas([]);
      }
    };
    void loadDairas();
  }, [apiURL, dataValues.id_wilaya]);

  useEffect(() => {
    if (!apiURL) return;
    const dairaId = Number(dataValues.id_daira);
    if (!Number.isFinite(dairaId)) {
      setCommunes([]);
      return;
    }
    const loadCommunes = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/dairas/${dairaId}/communes`, {
          withCredentials: true,
        });
        setCommunes(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Failed to load communes', e);
        setCommunes([]);
      }
    };
    void loadCommunes();
  }, [apiURL, dataValues.id_daira]);

  const initialData = useMemo(() => {
    if (!permis) return null;

    const procedures: any[] = Array.isArray(permis?.procedures) ? permis.procedures : [];
    const optionProc = procedures.find((p) => isOptionProcedure(p));
    const optionDemande = Array.isArray(optionProc?.demandes) ? optionProc.demandes[0] : null;
    const optionDemandeId = optionDemande?.id_demande ?? null;
    const optionDemandeCode = optionDemande?.code_demande ?? null;

    const demandesNonOption: any[] = procedures
      .filter((p) => !isOptionProcedure(p))
      .flatMap((p) => (Array.isArray(p?.demandes) ? p.demandes : []));
    const nonOptionProcedures = procedures.filter((p) => !isOptionProcedure(p));

    const hasLocalisation = (d: any) =>
      !!(
        d?.wilaya?.nom_wilayaAR ||
        d?.wilaya?.nom_wilayaFR ||
        d?.commune?.nom_communeAR ||
        d?.commune?.nom_communeFR ||
        d?.commune?.daira?.nom_dairaAR ||
        d?.commune?.daira?.nom_dairaFR ||
        d?.commune?.daira?.wilaya?.nom_wilayaAR ||
        d?.commune?.daira?.wilaya?.nom_wilayaFR
      );

    const bestDemande =
      [...demandesNonOption]
        .filter(hasLocalisation)
        .sort((a, b) => {
          const da = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
          const db = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
          return db - da;
        })[0] ?? null;

    const bestDemandeProcId = bestDemande?.id_proc ?? null;
    const sourceProc =
      (bestDemandeProcId
        ? procedures.find((p) => p?.id_proc === bestDemandeProcId)
        : null) ??
      nonOptionProcedures.find(
        (p) => Array.isArray(p?.SubstanceAssocieeDemande) && p.SubstanceAssocieeDemande.length > 0,
      ) ??
      nonOptionProcedures[0] ??
      procedures.find(
        (p) => Array.isArray(p?.SubstanceAssocieeDemande) && p.SubstanceAssocieeDemande.length > 0,
      ) ??
      procedures[0] ??
      null;

    const sourceDemandeId =
      bestDemande?.id_demande ??
      (Array.isArray(sourceProc?.demandes) ? sourceProc.demandes[0]?.id_demande : null) ??
      null;

    const substanceRows = Array.isArray(sourceProc?.SubstanceAssocieeDemande)
      ? sourceProc.SubstanceAssocieeDemande
      : [];
    const substanceIds = Array.from(
      new Set(
        substanceRows
          .map((row: any) => row?.substance?.id_sub ?? row?.id_substance)
          .map((id: any) => Number(id))
          .filter((id: any) => Number.isFinite(id)),
      ),
    );

    const communeNomAr = bestDemande?.commune?.nom_communeAR || '';
    const communeNomFr = bestDemande?.commune?.nom_communeFR || '';
    const dairaNomAr = bestDemande?.commune?.daira?.nom_dairaAR || '';
    const dairaNomFr = bestDemande?.commune?.daira?.nom_dairaFR || '';
    const wilayaNomAr =
      bestDemande?.wilaya?.nom_wilayaAR ||
      bestDemande?.commune?.daira?.wilaya?.nom_wilayaAR ||
      '';
    const wilayaNomFr =
      bestDemande?.wilaya?.nom_wilayaFR ||
      bestDemande?.commune?.daira?.wilaya?.nom_wilayaFR ||
      '';
    const communeNom = communeNomAr || communeNomFr || '';
    const dairaNom = dairaNomAr || dairaNomFr || '';
    const wilayaNom = wilayaNomAr || wilayaNomFr || '';
    const localisation = [communeNom, dairaNom, wilayaNom].filter(Boolean).join(' - ');

    const substancesAr = new Set<string>();
    const substancesFr = new Set<string>();
    procedures.forEach((proc) => {
      const rows = Array.isArray(proc?.SubstanceAssocieeDemande) ? proc.SubstanceAssocieeDemande : [];
      rows.forEach((row: any) => {
        const ar = row?.substance?.nom_subAR;
        const fr = row?.substance?.nom_subFR;
        if (typeof ar === 'string' && ar.trim()) substancesAr.add(ar.trim());
        if (typeof fr === 'string' && fr.trim()) substancesFr.add(fr.trim());
      });
    });
    const substanceAr = Array.from(substancesAr).join(', ');
    const substanceFr = Array.from(substancesFr).join(', ');

    const coordsCandidates = procedures
      .filter((p) => !isOptionProcedure(p))
      .filter((p) => Array.isArray(p?.coordonnees) && p.coordonnees.length > 0)
      .sort((a, b) => {
        const da = a?.date_fin_proc
          ? new Date(a.date_fin_proc).getTime()
          : a?.date_debut_proc
            ? new Date(a.date_debut_proc).getTime()
            : 0;
        const db = b?.date_fin_proc
          ? new Date(b.date_fin_proc).getTime()
          : b?.date_debut_proc
            ? new Date(b.date_debut_proc).getTime()
            : 0;
        return db - da;
      });
    const coordsProc =
      coordsCandidates[0] ??
      procedures.find((p) => Array.isArray(p?.coordonnees) && p.coordonnees.length > 0) ??
      null;

    const coordinates = (Array.isArray(coordsProc?.coordonnees) ? coordsProc.coordonnees : [])
      .map((rel: any) => rel?.coordonnee)
      .filter((c: any) => c && typeof c.x === 'number' && typeof c.y === 'number')
      .map((c: any) => ({
        x: c.x,
        y: c.y,
        h: c.z,
        system: c.system,
        zone: c.zone,
        hemisphere: c.hemisphere,
      }));

    const superficie = computePermisSuperficie(permis);
    const typePermis =
      permis?.typePermis && typeof permis.typePermis === 'object'
        ? {
            ...permis.typePermis,
            code:
              (permis.typePermis as any).code ??
              (permis.typePermis as any).code_type ??
              (permis.typePermis as any).codeType,
          }
        : permis?.typePermis;
    const pickFirstNonEmpty = (...vals: any[]) => {
      for (const v of vals) {
        if (typeof v !== 'string') continue;
        const s = v.trim();
        if (s) return s;
      }
      return '';
    };
    const extractStatutAr = (det: any) => {
      if (!det) return '';
      const formes = Array.isArray(det?.FormeJuridiqueDetenteur)
        ? det.FormeJuridiqueDetenteur
        : Array.isArray(det?.formeJuridiqueDetenteur)
          ? det.formeJuridiqueDetenteur
          : [];
      const latestForme = formes
        .slice()
        .sort((a: any, b: any) => {
          const ad = a?.date ? new Date(a.date).getTime() : 0;
          const bd = b?.date ? new Date(b.date).getTime() : 0;
          return bd - ad;
        })[0];
      return pickFirstNonEmpty(
        latestForme?.statutJuridique?.statut_ar,
        latestForme?.statutJuridique?.StatutArab,
        det?.StatutJuridique?.statut_ar,
        det?.StatutJuridique?.StatutArab,
        det?.statut?.statut_ar,
        det?.statut?.StatutArab,
      );
    };
    const detCandidates = [
      (permis as any)?.detenteur,
      ...(Array.isArray(procedures)
        ? procedures.flatMap((proc: any) =>
            Array.isArray(proc?.demandes)
              ? proc.demandes.flatMap((dem: any) =>
                  Array.isArray(dem?.detenteurdemande)
                    ? dem.detenteurdemande.map((rel: any) => rel?.detenteur || rel)
                    : [],
                )
              : [],
          )
        : []),
    ].filter(Boolean);

    const detenteurRef =
      detCandidates.find((det: any) => det && det.id_detenteur) ??
      (permis as any)?.detenteur ??
      detCandidates[0] ??
      null;
    const detenteurFormes = Array.isArray(detenteurRef?.FormeJuridiqueDetenteur)
      ? detenteurRef.FormeJuridiqueDetenteur
      : Array.isArray(detenteurRef?.formeJuridiqueDetenteur)
        ? detenteurRef.formeJuridiqueDetenteur
        : [];
    const detenteurFormeLatest = detenteurFormes
      .slice()
      .sort((a: any, b: any) => {
        const ad = a?.date ? new Date(a.date).getTime() : 0;
        const bd = b?.date ? new Date(b.date).getTime() : 0;
        return bd - ad;
      })[0];
    const detenteurStatutRaw =
      detenteurFormeLatest?.id_statut ??
      detenteurFormeLatest?.statutJuridique?.id_statutJuridique ??
      detenteurFormeLatest?.statutJuridique?.id_statut ??
      detenteurRef?.statut?.id_statutJuridique ??
      detenteurRef?.StatutJuridique?.id_statutJuridique ??
      null;
    const detenteurStatutId = Number.isFinite(Number(detenteurStatutRaw))
      ? Number(detenteurStatutRaw)
      : null;
    const statutArLabel =
      pickFirstNonEmpty(
        detenteurFormeLatest?.statutJuridique?.statut_ar,
        detenteurFormeLatest?.statutJuridique?.StatutArab,
        detenteurRef?.StatutJuridique?.StatutArab,
        detenteurRef?.statut?.statut_ar,
        detenteurRef?.statut?.StatutArab,
      ) ||
      detCandidates.reduce((acc: string, det: any) => acc || extractStatutAr(det), '');

    const nomSocieteAr = pickFirstNonEmpty(
      detenteurRef?.nom_societeAR,
      detenteurRef?.nom_societe_ar,
      detenteurRef?.nomSocieteAR,
      detenteurRef?.nomSocieteAr,
      detenteurRef?.nom_ar,
      detenteurRef?.NomArab,
    );
    const nomSocieteFr = pickFirstNonEmpty(
      detenteurRef?.nom_societeFR,
      detenteurRef?.nom_societe_fr,
      detenteurRef?.nomSocieteFR,
      detenteurRef?.nomSocieteFr,
      detenteurRef?.nom_fr,
      detenteurRef?.NomFrancais,
    );
    const detenteurTel = pickFirstNonEmpty(
      detenteurRef?.telephone,
      detenteurRef?.tel,
      detenteurRef?.Telephone,
    );
    const detenteurEmail = pickFirstNonEmpty(detenteurRef?.email, detenteurRef?.Email);
    const detenteurFax = pickFirstNonEmpty(detenteurRef?.fax, detenteurRef?.Fax);
    const detenteurAdresse = pickFirstNonEmpty(
      detenteurRef?.adresse_siege,
      detenteurRef?.adresse,
      detenteurRef?.adresse_legale,
      detenteurRef?.Adresse,
    );
    const detenteurPaysRaw = detenteurRef?.id_pays ?? detenteurRef?.pays?.id_pays ?? null;
    const detenteurNationaliteRaw =
      detenteurRef?.id_nationalite ?? detenteurRef?.nationaliteRef?.id_nationalite ?? null;
    const detenteurPaysId = Number.isFinite(Number(detenteurPaysRaw))
      ? Number(detenteurPaysRaw)
      : null;
    const detenteurNationaliteId = Number.isFinite(Number(detenteurNationaliteRaw))
      ? Number(detenteurNationaliteRaw)
      : null;

    const lieuDitAr = pickFirstNonEmpty(
      bestDemande?.lieu_dit_ar,
      bestDemande?.lieu_ditAR,
      bestDemande?.lieuDitAR,
      bestDemande?.lieu_ditAr,
      bestDemande?.lieudit_ar,
    );
    const lieuDitFr = pickFirstNonEmpty(
      bestDemande?.lieu_ditFR,
      bestDemande?.lieu_ditFr,
      bestDemande?.lieuDitFR,
      bestDemande?.lieu_dit_fr,
      bestDemande?.lieudit_fr,
    );

    return {
      ...permis,
      permisId: permis.id,
      code_permis: permis.code_permis,
      id_demande: optionDemandeId,
      code_demande: optionDemandeCode || permis.code_permis,
      typePermis,
      source_demande_id: sourceDemandeId,
      option_demande_id: optionDemandeId,
      source_proc_id: sourceProc?.id_proc ?? null,
      id_wilaya: bestDemande?.id_wilaya ?? null,
      id_daira: bestDemande?.id_daira ?? null,
      id_commune: bestDemande?.id_commune ?? null,
      lieu_dit_ar: lieuDitAr || undefined,
      lieu_dit_fr: lieuDitFr || undefined,
      date_demande: bestDemande?.date_demande ?? null,
      nom_societeAR: nomSocieteAr || undefined,
      nom_societeFR: nomSocieteFr || undefined,
      detenteur_id: detenteurRef?.id_detenteur ?? null,
      detenteur_statut_id: detenteurStatutId ?? null,
      detenteur_tel: detenteurTel || undefined,
      detenteur_email: detenteurEmail || undefined,
      detenteur_fax: detenteurFax || undefined,
      detenteur_adresse: detenteurAdresse || undefined,
      detenteur_pays_id: detenteurPaysId ?? undefined,
      detenteur_nationalite_id: detenteurNationaliteId ?? undefined,
      wilaya_nom: wilayaNom || undefined,
      wilaya_nom_ar: wilayaNomAr || undefined,
      wilaya_nom_fr: wilayaNomFr || undefined,
      daira_nom: dairaNom || undefined,
      daira_nom_ar: dairaNomAr || undefined,
      daira_nom_fr: dairaNomFr || undefined,
      commune_nom: communeNom || undefined,
      commune_nom_ar: communeNomAr || undefined,
      commune_nom_fr: communeNomFr || undefined,
      localisation: localisation || undefined,
      substance: substanceFr || undefined,
      substance_ar: (substanceAr || substanceFr) || undefined,
      substance_ids: substanceIds,
      statut_ar_label: statutArLabel || undefined,
      statut_ar: statutArLabel || undefined,
      coordinates,
      superficie: superficie ?? permis?.superficie ?? null,
      date_signature_precedent: permis?.date_signature_precedent ?? null,
      date_signature_precedent_proc_id: permis?.date_signature_precedent_proc_id ?? null,
    };
  }, [permis]);

  useEffect(() => {
    if (!initialData) return;
    setDataValues({
      nom_societeAR: initialData.nom_societeAR ?? '',
      nom_societeFR: initialData.nom_societeFR ?? '',
      detenteur_statut_id: initialData.detenteur_statut_id ?? null,
      id_wilaya: initialData.id_wilaya ?? null,
      id_daira: initialData.id_daira ?? null,
      id_commune: initialData.id_commune ?? null,
      lieu_dit_ar: initialData.lieu_dit_ar ?? '',
      lieu_dit_fr: initialData.lieu_dit_fr ?? '',
      date_demande: initialData.date_demande ?? '',
      date_octroi: initialData.date_octroi ?? '',
      date_signature: initialData.date_signature ?? initialData.permis?.date_signature ?? '',
      date_signature_precedent: initialData.date_signature_precedent ?? '',
      date_signature_precedent_proc_id: initialData.date_signature_precedent_proc_id ?? null,
      date_expiration: initialData.date_expiration ?? '',
      superficie: initialData.superficie ?? '',
      substance_ids: Array.isArray(initialData.substance_ids) ? initialData.substance_ids : [],
    });
  }, [initialData]);

  useEffect(() => {
    if (!apiURL || !initialData) return;
    const detenteurId = Number(initialData.detenteur_id);
    const currentStatut = Number(dataValues.detenteur_statut_id);
    if (!Number.isFinite(detenteurId) || (Number.isFinite(currentStatut) && currentStatut > 0)) {
      return;
    }
    let active = true;
    const loadDetenteurStatut = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/detenteur-morale/${detenteurId}`, {
          withCredentials: true,
        });
        const det = res.data;
        const formes = Array.isArray(det?.FormeJuridiqueDetenteur)
          ? det.FormeJuridiqueDetenteur
          : Array.isArray(det?.formeJuridiqueDetenteur)
            ? det.formeJuridiqueDetenteur
            : [];
        const latest = formes
          .slice()
          .sort((a: any, b: any) => {
            const ad = a?.date ? new Date(a.date).getTime() : 0;
            const bd = b?.date ? new Date(b.date).getTime() : 0;
            return bd - ad;
          })[0];
        const statutRaw =
          latest?.id_statut ??
          latest?.statutJuridique?.id_statutJuridique ??
          latest?.statutJuridique?.id_statut ??
          null;
        const statutId = Number(statutRaw);
        if (active && Number.isFinite(statutId) && statutId > 0) {
          setDataValues((prev) => ({ ...prev, detenteur_statut_id: statutId }));
        }
      } catch (e) {
        console.warn('Failed to load detenteur statut', e);
      }
    };
    void loadDetenteurStatut();
    return () => {
      active = false;
    };
  }, [apiURL, initialData, dataValues.detenteur_statut_id]);

  const handleDataChange = useCallback((values: Record<string, any>) => {
    const normalizeId = (value: any) => {
      if (value == null || value === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };
    setDataValues((prev) => {
      const next: Record<string, any> = { ...prev, ...values };
      if ('detenteur_statut_id' in values) {
        next.detenteur_statut_id = normalizeId(values.detenteur_statut_id);
      }
      if ('id_wilaya' in values) next.id_wilaya = normalizeId(values.id_wilaya);
      if ('id_daira' in values) next.id_daira = normalizeId(values.id_daira);
      if ('id_commune' in values) next.id_commune = normalizeId(values.id_commune);

      const wilayaChanged =
        'id_wilaya' in values && normalizeId(values.id_wilaya) !== normalizeId(prev.id_wilaya);
      const dairaChanged =
        'id_daira' in values && normalizeId(values.id_daira) !== normalizeId(prev.id_daira);
      if (wilayaChanged) {
        next.id_daira = null;
        next.id_commune = null;
      } else if (dairaChanged) {
        next.id_commune = null;
      }

      if ('substance_ids' in values) {
        const rawIds = Array.isArray(values.substance_ids) ? values.substance_ids : [];
        const normalized = rawIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));
        next.substance_ids = Array.from(new Set(normalized));
      }
      return next;
    });
  }, []);

  const mergedInitialData = useMemo(() => {
    if (!initialData) return null;
    const values = dataValues || {};
    const pickLabel = (...vals: any[]) => {
      for (const v of vals) {
        if (typeof v !== 'string') continue;
        const s = v.trim();
        if (s) return s;
      }
      return '';
    };

    const wilayaId = Number(values.id_wilaya ?? initialData.id_wilaya);
    const dairaId = Number(values.id_daira ?? initialData.id_daira);
    const communeId = Number(values.id_commune ?? initialData.id_commune);
    const wilaya = wilayas.find((w: any) => Number(w?.id_wilaya) === wilayaId);
    const daira = dairas.find((d: any) => Number(d?.id_daira) === dairaId);
    const commune = communes.find((c: any) => Number(c?.id_commune) === communeId);

    const wilayaNomFr = pickLabel(wilaya?.nom_wilayaFR, initialData.wilaya_nom_fr, initialData.wilaya_nom);
    const wilayaNomAr = pickLabel(wilaya?.nom_wilayaAR, initialData.wilaya_nom_ar);
    const dairaNomFr = pickLabel(daira?.nom_dairaFR, initialData.daira_nom_fr, initialData.daira_nom);
    const dairaNomAr = pickLabel(daira?.nom_dairaAR, initialData.daira_nom_ar);
    const communeNomFr = pickLabel(commune?.nom_communeFR, initialData.commune_nom_fr, initialData.commune_nom);
    const communeNomAr = pickLabel(commune?.nom_communeAR, initialData.commune_nom_ar);
    const communeNom = pickLabel(communeNomAr, communeNomFr);
    const dairaNom = pickLabel(dairaNomAr, dairaNomFr);
    const wilayaNom = pickLabel(wilayaNomAr, wilayaNomFr);
    const localisation = [communeNom, dairaNom, wilayaNom].filter(Boolean).join(' - ');

    const statutId = Number(
      values.detenteur_statut_id ?? initialData.detenteur_statut_id ?? NaN,
    );
    const statutRow = statutsJuridiques.find(
      (row: any) => Number(row?.id_statutJuridique ?? row?.id_statut) === statutId,
    );
    const statutArLabel = pickLabel(
      statutRow?.statut_ar,
      initialData.statut_ar_label,
      initialData.statut_ar,
    );

    const rawSelected = Array.isArray(values.substance_ids)
      ? values.substance_ids
      : Array.isArray(initialData.substance_ids)
        ? initialData.substance_ids
        : [];
    const selectedIds = rawSelected
      .map((id: any) => Number(id))
      .filter((id: unknown) => Number.isFinite(id));
    const selectedSubstances = selectedIds.length
      ? substances.filter((sub: any) => selectedIds.includes(Number(sub?.id_sub)))
      : [];
    const substanceFr = selectedSubstances
      .map((sub: any) => sub?.nom_subFR || sub?.nom_subAR)
      .filter((s: any) => typeof s === 'string' && s.trim())
      .join(', ');
    const substanceAr = selectedSubstances
      .map((sub: any) => sub?.nom_subAR || sub?.nom_subFR)
      .filter((s: any) => typeof s === 'string' && s.trim())
      .join(', ');
    const mergedSubstanceFr = substanceFr || initialData.substance || '';
    const mergedSubstanceAr = substanceAr || initialData.substance_ar || mergedSubstanceFr;

    return {
      ...initialData,
      ...values,
      wilaya_nom: wilayaNom || initialData.wilaya_nom,
      wilaya_nom_ar: wilayaNomAr || initialData.wilaya_nom_ar,
      wilaya_nom_fr: wilayaNomFr || initialData.wilaya_nom_fr,
      daira_nom: dairaNom || initialData.daira_nom,
      daira_nom_ar: dairaNomAr || initialData.daira_nom_ar,
      daira_nom_fr: dairaNomFr || initialData.daira_nom_fr,
      commune_nom: communeNom || initialData.commune_nom,
      commune_nom_ar: communeNomAr || initialData.commune_nom_ar,
      commune_nom_fr: communeNomFr || initialData.commune_nom_fr,
      wilaya_ar: wilayaNomAr || initialData.wilaya_ar,
      daira_ar: dairaNomAr || initialData.daira_ar,
      commune_ar: communeNomAr || initialData.commune_ar,
      localisation: localisation || initialData.localisation,
      substance: mergedSubstanceFr || undefined,
      substance_ar: mergedSubstanceAr || undefined,
      statut_ar_label: statutArLabel || initialData.statut_ar_label,
      statut_ar: statutArLabel || initialData.statut_ar,
    };
  }, [initialData, dataValues, wilayas, dairas, communes, substances, statutsJuridiques]);

  const handleSaveData = useCallback(async () => {
    if (!apiURL) {
      toast.error('Configuration API manquante');
      return;
    }
    if (!initialData) return;

    const normalizeText = (value: any) => {
      if (value == null) return null;
      const s = String(value).trim();
      return s ? s : null;
    };
    const normalizeDate = (value: any) => {
      if (value == null || value === '') return null;
      const toYmd = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      if (value instanceof Date && !isNaN(value.getTime())) {
        return toYmd(value);
      }
      const s = String(value).trim();
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : toYmd(d);
    };
    const normalizeNumber = (value: any) => {
      if (value == null) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const demandeIdRaw = initialData.source_demande_id ?? initialData.id_demande ?? null;
    const demandeId = normalizeNumber(demandeIdRaw);
    const hasDemande = demandeId != null;
    const permisIdValue = normalizeNumber(initialData.permisId ?? permis?.id ?? initialData.id);
    const detenteurIdValue = normalizeNumber(
      initialData.detenteur_id ?? initialData?.detenteur?.id_detenteur ?? null,
    );
    const detenteurStatutId = normalizeNumber(
      dataValues.detenteur_statut_id ?? initialData.detenteur_statut_id ?? null,
    );
    const detenteurOriginalStatut = normalizeNumber(initialData.detenteur_statut_id ?? null);
    const detenteurEffectiveStatut = detenteurStatutId ?? detenteurOriginalStatut;

    const nomSocieteAr = normalizeText(dataValues.nom_societeAR);
    const nomSocieteFr = normalizeText(dataValues.nom_societeFR);
    const superficieValue = normalizeNumber(dataValues.superficie);
    const dateDemande = normalizeDate(dataValues.date_demande);
    const dateOctroi = normalizeDate(dataValues.date_octroi);
    const dateSignature = normalizeDate(dataValues.date_signature);
    const dateSignaturePrecedent = normalizeDate(dataValues.date_signature_precedent);
    const dateExpiration = normalizeDate(dataValues.date_expiration);
    const idWilaya = normalizeNumber(dataValues.id_wilaya);
    const idDaira = normalizeNumber(dataValues.id_daira);
    const idCommune = normalizeNumber(dataValues.id_commune);

    const detenteurTel = String(
      initialData.detenteur_tel ??
        initialData?.detenteur?.telephone ??
        initialData?.detenteur?.tel ??
        '',
    );
    const detenteurEmail = String(initialData.detenteur_email ?? initialData?.detenteur?.email ?? '');
    const detenteurFax = String(initialData.detenteur_fax ?? initialData?.detenteur?.fax ?? '');
    const detenteurAdresse = String(
      initialData.detenteur_adresse ??
        initialData?.detenteur?.adresse_siege ??
        initialData?.detenteur?.adresse ??
        '',
    );
    const detenteurPaysId = normalizeNumber(initialData.detenteur_pays_id);
    const detenteurNationaliteId = normalizeNumber(initialData.detenteur_nationalite_id);
    const detenteurOriginalAr = normalizeText(initialData.nom_societeAR) ?? '';
    const detenteurOriginalFr = normalizeText(initialData.nom_societeFR) ?? '';
    const detenteurDirty =
      detenteurIdValue != null &&
      (
        (nomSocieteAr ?? '') !== detenteurOriginalAr ||
        (nomSocieteFr ?? '') !== detenteurOriginalFr ||
        (detenteurEffectiveStatut ?? null) !== (detenteurOriginalStatut ?? null)
      );
    const precedentProcId = normalizeNumber(
      dataValues.date_signature_precedent_proc_id ??
        initialData?.date_signature_precedent_proc_id ??
        initialData?.permis?.date_signature_precedent_proc_id ??
        null,
    );

    const errors: string[] = [];
    setDataSaving(true);

    try {
      if (hasDemande) {
        try {
          await axios.put(
            `${apiURL}/demandes/${demandeId}`,
            {
              id_wilaya: idWilaya,
              id_daira: idDaira,
              id_commune: idCommune,
              lieu_ditFR: normalizeText(dataValues.lieu_dit_fr),
              lieu_ditAR: normalizeText(dataValues.lieu_dit_ar),
              superficie: superficieValue,
              date_demande: dateDemande,
            },
            { withCredentials: true },
          );
        } catch (e) {
          console.error('Failed to update demande', e);
          errors.push('Demande');
        }
      }

      if (permisIdValue != null) {
        try {
          if (precedentProcId != null && dateSignaturePrecedent !== undefined) {
            try {
              await axios.patch(
                `${apiURL}/api/permis/procedure/${precedentProcId}/permis/${permisIdValue}/signature`,
                { date_signature: dateSignaturePrecedent },
                { withCredentials: true },
              );
            } catch (e) {
              console.error('Failed to update precedent signature', e);
              errors.push('Signature precedente');
            }
          }
          await axios.patch(
            `${apiURL}/Permisdashboard/${permisIdValue}`,
            {
              date_octroi: dateOctroi,
              date_signature: dateSignature,
              date_expiration: dateExpiration,
              superficie: superficieValue,
            },
            { withCredentials: true },
          );
        } catch (e) {
          console.error('Failed to update permis', e);
          errors.push('Permis');
        }
      }

      if (detenteurIdValue != null && detenteurDirty) {
        let statutIdToUse = detenteurEffectiveStatut;
        if (statutIdToUse == null || statutIdToUse <= 0) {
          try {
            const res = await axios.get(`${apiURL}/api/detenteur-morale/${detenteurIdValue}`, {
              withCredentials: true,
            });
            const det = res.data;
            const formes = Array.isArray(det?.FormeJuridiqueDetenteur)
              ? det.FormeJuridiqueDetenteur
              : Array.isArray(det?.formeJuridiqueDetenteur)
                ? det.formeJuridiqueDetenteur
                : [];
            const latest = formes
              .slice()
              .sort((a: any, b: any) => {
                const ad = a?.date ? new Date(a.date).getTime() : 0;
                const bd = b?.date ? new Date(b.date).getTime() : 0;
                return bd - ad;
              })[0];
            const statutRaw =
              latest?.id_statut ??
              latest?.statutJuridique?.id_statutJuridique ??
              latest?.statutJuridique?.id_statut ??
              null;
            const resolved = Number(statutRaw);
            if (Number.isFinite(resolved) && resolved > 0) {
              statutIdToUse = resolved;
              setDataValues((prev) => ({ ...prev, detenteur_statut_id: resolved }));
            }
          } catch (e) {
            console.warn('Failed to resolve detenteur statut', e);
          }
        }

        if (!nomSocieteAr || !nomSocieteFr) {
          toast.warn('Nom societe AR/FR manquant: mise a jour du titulaire ignoree');
        } else if (statutIdToUse == null || statutIdToUse <= 0) {
          toast.warn('Statut juridique manquant: mise a jour du titulaire ignoree');
        } else {
          const detenteurPayload: Record<string, any> = {
            nom_fr: nomSocieteFr,
            nom_ar: nomSocieteAr,
            statut_id: statutIdToUse,
            tel: detenteurTel,
            email: detenteurEmail,
            fax: detenteurFax,
            adresse: detenteurAdresse,
          };
          if (Number.isFinite(detenteurPaysId)) detenteurPayload.id_pays = detenteurPaysId;
          if (Number.isFinite(detenteurNationaliteId)) {
            detenteurPayload.id_nationalite = detenteurNationaliteId;
          }
          try {
            await axios.put(
              `${apiURL}/api/detenteur-morale/${detenteurIdValue}`,
              detenteurPayload,
              { withCredentials: true },
            );
          } catch (e) {
            console.error('Failed to update detenteur', e);
            errors.push('Detenteur');
          }
        }
      }

      if (hasDemande) {
        const rawIds = Array.isArray(dataValues.substance_ids) ? dataValues.substance_ids : [];
        const selectedIds = Array.from(
          new Set(
            rawIds
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id)),
          ),
        );
        try {
          const currentRes = await axios.get(`${apiURL}/api/substances/demande/${demandeId}`, {
            withCredentials: true,
          });
          const currentIds = Array.isArray(currentRes.data)
            ? currentRes.data
                .map((sub: any) => Number(sub?.id_sub))
                .filter((id: any) => Number.isFinite(id))
            : [];
          const currentSet = new Set(currentIds);
          const selectedSet = new Set(selectedIds);
          const toRemove = currentIds.filter((id) => !selectedSet.has(id));

          for (const id of toRemove) {
            try {
              await axios.delete(`${apiURL}/api/substances/demande/${demandeId}/${id}`, {
                withCredentials: true,
              });
            } catch (e) {
              console.error('Failed to remove substance', e);
            }
          }

          for (let idx = 0; idx < selectedIds.length; idx += 1) {
            const id = selectedIds[idx];
            const priorite = idx === 0 ? 'principale' : 'secondaire';
            await axios.post(
              `${apiURL}/api/substances/demande/${demandeId}`,
              { id_substance: id, priorite },
              { withCredentials: true },
            );
            currentSet.add(id);
          }
        } catch (e) {
          console.error('Failed to update substances', e);
          errors.push('Substances');
        }
      }

      await fetchPermis(true);
      if (errors.length) {
        toast.error(`Echec de mise a jour: ${errors.join(', ')}`);
      } else {
        toast.success('Donnees mises a jour');
      }
    } finally {
      setDataSaving(false);
    }
  }, [apiURL, dataValues, fetchPermis, initialData, permis]);

  const dataSections = useMemo<PermisDesignerDataSection[]>(() => {
    const formatOptionLabel = (fr?: string, ar?: string) => {
      const frLabel = fr?.trim() || '';
      const arLabel = ar?.trim() || '';
      if (arLabel && frLabel) return `${arLabel} / ${frLabel}`;
      return arLabel || frLabel || '';
    };
    return [
      {
        title: 'Societe',
        fields: [
          { key: 'nom_societeAR', label: 'Nom societe (AR)', dir: 'rtl' },
          { key: 'nom_societeFR', label: 'Nom societe (FR)', dir: 'ltr' },
          {
            key: 'detenteur_statut_id',
            label: 'Statut juridique',
            type: 'select',
            options: statutsJuridiques.map((statut: any) => ({
              value: statut.id_statutJuridique ?? statut.id_statut,
              label: formatOptionLabel(statut.statut_fr, statut.statut_ar),
            })),
          },
        ],
      },
      {
        title: 'Localisation',
        fields: [
          {
            key: 'id_wilaya',
            label: 'Wilaya',
            type: 'select',
            options: wilayas.map((w: any) => ({
              value: w.id_wilaya,
              label: `${w.code_wilaya ? `${w.code_wilaya} - ` : ''}${formatOptionLabel(
                w.nom_wilayaFR,
                w.nom_wilayaAR,
              )}`,
            })),
          },
          {
            key: 'id_daira',
            label: 'Daira',
            type: 'select',
            options: dairas.map((d: any) => ({
              value: d.id_daira,
              label: formatOptionLabel(d.nom_dairaFR, d.nom_dairaAR),
            })),
            disabled: !dataValues.id_wilaya,
          },
          {
            key: 'id_commune',
            label: 'Commune',
            type: 'select',
            options: communes.map((c: any) => ({
              value: c.id_commune,
              label: formatOptionLabel(c.nom_communeFR, c.nom_communeAR),
            })),
            disabled: !dataValues.id_daira,
          },
          { key: 'lieu_dit_fr', label: 'Lieu-dit (FR)', type: 'textarea' },
          { key: 'lieu_dit_ar', label: 'Lieu-dit (AR)', type: 'textarea', dir: 'rtl' },
        ],
      },
      {
        title: 'Substances',
        fields: [
          {
            key: 'substance_ids',
            label: 'Substances',
            type: 'multiselect',
            options: substances.map((s: any) => ({
              value: s.id_sub,
              label: formatOptionLabel(s.nom_subFR, s.nom_subAR),
            })),
          },
        ],
      },
      {
        title: 'Dates',
        fields: [
          { key: 'date_demande', label: 'Date demande', type: 'date' },
          { key: 'date_octroi', label: 'Date octroi', type: 'date' },
          { key: 'date_signature', label: 'Date signature', type: 'date' },
          {
            key: 'date_signature_precedent',
            label: 'Date signature permis précédente',
            type: 'date',
          },
          { key: 'date_expiration', label: 'Date expiration', type: 'date' },
        ],
      },
      {
        title: 'Superficie',
        fields: [{ key: 'superficie', label: 'Superficie (ha)', type: 'number' }],
      },
    ];
  }, [
    communes,
    dairas,
    dataValues.id_daira,
    dataValues.id_wilaya,
    statutsJuridiques,
    substances,
    wilayas,
  ]);

  const dataEditorConfig = useMemo<PermisDesignerDataEditor>(
    () => ({
      enabled: true,
      sections: dataSections,
      values: dataValues,
      onChange: handleDataChange,
      onSave: handleSaveData,
      saving: dataSaving,
      saveLabel: 'Enregistrer',
      applyLabel: 'Recharger articles',
    }),
    [dataSections, dataValues, handleDataChange, handleSaveData, dataSaving],
  );

  const handleGeneratePdf = async (design: any) => {
    if (!apiURL) throw new Error('Configuration API manquante');
    const response = await axios.post(`${apiURL}/api/permis/generate-pdf`, design, {
      responseType: 'blob',
      withCredentials: true,
    });
    return response.data as Blob;
  };

  const handleSaveTemplate = async (templateData: any): Promise<void> => {
    if (!apiURL) throw new Error('Configuration API manquante');
    await axios.post(`${apiURL}/api/permis/save-template`, templateData, { withCredentials: true });
  };

  const handleSavePermis = async (
    _permisData?: any,
  ): Promise<{ id: number; code_permis: string }> => {
    if (!permis?.id || !permis?.code_permis) {
      throw new Error('Permis introuvable');
    }
    return { id: permis.id, code_permis: permis.code_permis };
  };

  if (loading) {
    return (
      <div className={styles.appContainer}>
        <Navbar />
        <div className={styles.appContent}>
          <Sidebar currentView={currentView} navigateTo={navigateTo} />
          <main className={styles.mainContent}>
            <div className={styles.container}>Chargement du permis…</div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className={styles.appContainer}>
        <Navbar />
        <div className={styles.appContent}>
          <Sidebar currentView={currentView} navigateTo={navigateTo} />
          <main className={styles.mainContent}>
            <div className={styles.container}>
              <h2>Erreur</h2>
              <p>{error || 'Aucune donnee disponible'}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
 
              <PermisDesigner
                initialData={mergedInitialData || initialData}
                onSave={handleSaveTemplate}
                onGeneratePdf={handleGeneratePdf}
                onSavePermis={handleSavePermis}
                permisId={initialData.permisId}
                dataEditor={dataEditorConfig}
              />

        </main>
      </div>
    </div>
  );
};

export default PermisOptionDesignerPage;
