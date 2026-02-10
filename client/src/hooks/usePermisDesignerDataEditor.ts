import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { PermisDesignerDataEditor, PermisDesignerDataSection } from '../../components/types';

type UsePermisDesignerDataEditorOptions = {
  apiURL?: string;
  initialData: any | null;
  permisId?: number | string | null;
  demandeId?: number | string | null;
  procedureId?: number | string | null;
  isInitialDemande?: boolean;
  onReload?: () => Promise<void> | void;
};

export const usePermisDesignerDataEditor = ({
  apiURL,
  initialData,
  permisId,
  demandeId,
  procedureId,
  isInitialDemande = false,
  onReload,
}: UsePermisDesignerDataEditorOptions) => {
  const [dataValues, setDataValues] = useState<Record<string, any>>({});
  const [dataSaving, setDataSaving] = useState(false);
  const [wilayas, setWilayas] = useState<any[]>([]);
  const [dairas, setDairas] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [substances, setSubstances] = useState<any[]>([]);
  const [statutsJuridiques, setStatutsJuridiques] = useState<any[]>([]);

  const baseData = useMemo(() => {
    if (!initialData) return null;

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
    const toNumber = (value: any) => {
      if (value == null) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const detenteurRows =
      Array.isArray(initialData?.detenteurdemande)
        ? initialData.detenteurdemande
        : Array.isArray(initialData?.detenteurDemande)
          ? initialData.detenteurDemande
          : Array.isArray(initialData?.detenteur_demande)
            ? initialData.detenteur_demande
            : [];
    const detCandidates = [
      initialData?.detenteur,
      ...detenteurRows.map((rel: any) => rel?.detenteur || rel),
    ].filter(Boolean);
    const detenteurRef =
      detCandidates.find((det: any) => det && det.id_detenteur) ??
      initialData?.detenteur ??
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
      initialData?.nom_societeAR,
      initialData?.nom_societe_ar,
      initialData?.nom_societear,
      initialData?.nomSocieteAR,
      initialData?.nomSocieteAr,
      initialData?.titulaire_ar,
      detenteurRef?.nom_societeAR,
      detenteurRef?.nom_societe_ar,
      detenteurRef?.nomSocieteAR,
      detenteurRef?.nomSocieteAr,
      detenteurRef?.nom_ar,
      detenteurRef?.NomArab,
    );
    const nomSocieteFr = pickFirstNonEmpty(
      initialData?.nom_societeFR,
      initialData?.nom_societe_fr,
      initialData?.nomSocieteFR,
      initialData?.nomSocieteFr,
      initialData?.titulaire,
      detenteurRef?.nom_societeFR,
      detenteurRef?.nom_societe_fr,
      detenteurRef?.nomSocieteFR,
      detenteurRef?.nomSocieteFr,
      detenteurRef?.nom_fr,
      detenteurRef?.NomFrancais,
    );
    const detenteurTel = pickFirstNonEmpty(
      initialData?.detenteur_tel,
      detenteurRef?.telephone,
      detenteurRef?.tel,
      detenteurRef?.Telephone,
    );
    const detenteurEmail = pickFirstNonEmpty(
      initialData?.detenteur_email,
      detenteurRef?.email,
      detenteurRef?.Email,
    );
    const detenteurFax = pickFirstNonEmpty(
      initialData?.detenteur_fax,
      detenteurRef?.fax,
      detenteurRef?.Fax,
    );
    const detenteurAdresse = pickFirstNonEmpty(
      initialData?.detenteur_adresse,
      detenteurRef?.adresse_siege,
      detenteurRef?.adresse,
      detenteurRef?.adresse_legale,
      detenteurRef?.Adresse,
    );
    const detenteurPaysRaw =
      initialData?.detenteur_pays_id ?? detenteurRef?.id_pays ?? detenteurRef?.pays?.id_pays ?? null;
    const detenteurNationaliteRaw =
      initialData?.detenteur_nationalite_id ??
      detenteurRef?.id_nationalite ??
      detenteurRef?.nationaliteRef?.id_nationalite ??
      null;
    const detenteurPaysId = toNumber(detenteurPaysRaw);
    const detenteurNationaliteId = toNumber(detenteurNationaliteRaw);

    const idWilayaRaw =
      initialData?.id_wilaya ??
      initialData?.wilaya?.id_wilaya ??
      initialData?.commune?.daira?.wilaya?.id_wilaya ??
      initialData?.commune?.daira?.id_wilaya ??
      null;
    const idDairaRaw =
      initialData?.id_daira ??
      initialData?.daira?.id_daira ??
      initialData?.commune?.daira?.id_daira ??
      null;
    const idCommuneRaw = initialData?.id_commune ?? initialData?.commune?.id_commune ?? null;
    const idWilaya = toNumber(idWilayaRaw);
    const idDaira = toNumber(idDairaRaw);
    const idCommune = toNumber(idCommuneRaw);

    const lieuDitAr = pickFirstNonEmpty(
      initialData?.lieu_dit_ar,
      initialData?.lieu_ditAR,
      initialData?.lieuDitAR,
      initialData?.lieu_ditAr,
      initialData?.lieudit_ar,
    );
    const lieuDitFr = pickFirstNonEmpty(
      initialData?.lieu_dit_fr,
      initialData?.lieu_ditFR,
      initialData?.lieu_ditFr,
      initialData?.lieuDitFR,
      initialData?.lieudit_fr,
    );

    const dateDemande =
      initialData?.date_demande ??
      initialData?.dateDemande ??
      initialData?.DateDemande ??
      null;
    const dateOctroiProc =
      initialData?.date_octroi_proc ??
      initialData?.dateOctroiProc ??
      initialData?.DateOctroiProc ??
      initialData?.permis?.date_octroi_proc ??
      initialData?.permis?.dateOctroiProc ??
      null;
    const rawDateOctroi =
      dateOctroiProc ??
      initialData?.date_octroi ??
      initialData?.dateOctroi ??
      initialData?.DateOctroi ??
      null;
    const dateOctroi = rawDateOctroi ?? null;
    const dateSignature =
      initialData?.date_signature ??
      initialData?.dateSignature ??
      initialData?.DateSignature ??
      initialData?.permis?.date_signature ??
      initialData?.permis?.dateSignature ??
      null;
    const dateSignaturePrecedent =
      initialData?.date_signature_precedent ??
      initialData?.dateSignaturePrecedent ??
      initialData?.permis?.date_signature_precedent ??
      initialData?.permis?.dateSignaturePrecedent ??
      null;
    const dateSignaturePrecedentProcId =
      initialData?.date_signature_precedent_proc_id ??
      initialData?.dateSignaturePrecedentProcId ??
      initialData?.permis?.date_signature_precedent_proc_id ??
      initialData?.permis?.dateSignaturePrecedentProcId ??
      null;
    const dateExpiration =
      initialData?.date_expiration ??
      initialData?.dateExpiration ??
      initialData?.DateExpiration ??
      null;
    const superficie =
      initialData?.superficie ??
      initialData?.Superficie ??
      initialData?.superficie_ha ??
      null;

    const substanceSources = [
      Array.isArray(initialData?.substance_associee_demande)
        ? initialData.substance_associee_demande
        : null,
      Array.isArray(initialData?.substances_associees) ? initialData.substances_associees : null,
      Array.isArray(initialData?.substances) ? initialData.substances : null,
      Array.isArray(initialData?.SubstanceAssocieeDemande)
        ? initialData.SubstanceAssocieeDemande
        : null,
    ];
    const substanceRows =
      substanceSources.find((arr) => Array.isArray(arr) && arr.length > 0) ?? [];
    const derivedSubstanceIds = Array.from(
      new Set(
        (Array.isArray(substanceRows) ? substanceRows : [])
          .map((row: any) => row?.substance?.id_sub ?? row?.Substance?.id_sub ?? row?.id_substance ?? row?.id_sub)
          .map((id: any) => Number(id))
          .filter((id: any) => Number.isFinite(id)),
      ),
    );
    const mergedSubstanceIds = derivedSubstanceIds.length
      ? derivedSubstanceIds
      : Array.isArray(initialData?.substance_ids)
        ? initialData.substance_ids
        : [];

    const detenteurIdRaw =
      initialData?.detenteur_id ??
      detenteurRef?.id_detenteur ??
      detenteurRef?.id ??
      null;
    const detenteurId = toNumber(detenteurIdRaw);

    const permisIdRaw =
      initialData?.permisId ??
      initialData?.permis_id ??
      initialData?.id_permis ??
      initialData?.permis?.id_permis ??
      initialData?.permis?.id ??
      null;
    const demandeIdRaw =
      initialData?.id_demande ??
      initialData?.demande?.id_demande ??
      initialData?.demande_id ??
      null;

    return {
      ...initialData,
      isInitialDemande,
      permisId: initialData?.permisId ?? permisIdRaw ?? undefined,
      id_demande: initialData?.id_demande ?? demandeIdRaw ?? undefined,
      nom_societeAR: nomSocieteAr || initialData?.nom_societeAR,
      nom_societeFR: nomSocieteFr || initialData?.nom_societeFR,
      detenteur_id: detenteurId ?? initialData?.detenteur_id ?? null,
      detenteur_statut_id: detenteurStatutId ?? initialData?.detenteur_statut_id ?? null,
      detenteur_tel: detenteurTel || initialData?.detenteur_tel,
      detenteur_email: detenteurEmail || initialData?.detenteur_email,
      detenteur_fax: detenteurFax || initialData?.detenteur_fax,
      detenteur_adresse: detenteurAdresse || initialData?.detenteur_adresse,
      detenteur_pays_id: detenteurPaysId ?? initialData?.detenteur_pays_id,
      detenteur_nationalite_id: detenteurNationaliteId ?? initialData?.detenteur_nationalite_id,
      detenteur: detenteurRef || initialData?.detenteur,
      id_wilaya: idWilaya ?? initialData?.id_wilaya ?? null,
      id_daira: idDaira ?? initialData?.id_daira ?? null,
      id_commune: idCommune ?? initialData?.id_commune ?? null,
      lieu_dit_ar: lieuDitAr || initialData?.lieu_dit_ar,
      lieu_dit_fr: lieuDitFr || initialData?.lieu_dit_fr,
      date_demande: dateDemande ?? initialData?.date_demande ?? null,
      date_octroi: dateOctroi ?? initialData?.date_octroi ?? null,
      date_octroi_proc: dateOctroiProc ?? null,
      date_signature: dateSignature ?? initialData?.date_signature ?? null,
      date_signature_precedent:
        dateSignaturePrecedent ?? initialData?.date_signature_precedent ?? null,
      date_signature_precedent_proc_id:
        dateSignaturePrecedentProcId ??
        initialData?.date_signature_precedent_proc_id ??
        null,
      date_expiration: dateExpiration ?? initialData?.date_expiration ?? null,
      superficie: superficie ?? initialData?.superficie ?? null,
      substance_ids: mergedSubstanceIds,
      statut_ar_label: statutArLabel || initialData?.statut_ar_label,
      statut_ar: statutArLabel || initialData?.statut_ar,
    };
  }, [initialData, isInitialDemande]);

  const permisIdForDetails = useMemo(() => {
    const raw =
      permisId ??
      baseData?.permisId ??
      baseData?.permis_id ??
      baseData?.id_permis ??
      baseData?.permis?.id ??
      null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [
    permisId,
    baseData?.permisId,
    baseData?.permis_id,
    baseData?.id_permis,
    baseData?.permis?.id,
  ]);
  const procIdForDetails = useMemo(() => {
    const raw =
      procedureId ??
      baseData?.id_proc ??
      baseData?.procedure?.id_proc ??
      baseData?.procedureId ??
      baseData?.procId ??
      null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [
    procedureId,
    baseData?.id_proc,
    baseData?.procedure?.id_proc,
    baseData?.procedureId,
    baseData?.procId,
  ]);

  useEffect(() => {
    if (!apiURL || !permisIdForDetails) return;
    let active = true;
    const toYmd = (value: any) => {
      if (!value) return '';
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    const loadPermisDetails = async () => {
      try {
        const [res, procRes] = await Promise.all([
          axios.get(`${apiURL}/Permisdashboard/${permisIdForDetails}`, {
            withCredentials: true,
          }),
          procIdForDetails
            ? axios.get(`${apiURL}/api/permis/procedure/${procIdForDetails}/permis`, {
                withCredentials: true,
              })
            : Promise.resolve({ data: null }),
        ]);
        if (!active) return;
        const data = res.data || {};
        const procData = procRes?.data || {};
        const procOctroi =
          procData?.dateOctroiEffective ??
          procData?.dateOctroiProc ??
          procData?.dateOctroi ??
          null;
        setDataValues((prev) => {
          const next = { ...prev };
          if ((prev.date_signature == null || prev.date_signature === '') && data.date_signature) {
            next.date_signature = toYmd(data.date_signature);
          }
          if (
            (prev.date_signature_precedent == null || prev.date_signature_precedent === '') &&
            data.date_signature_precedent
          ) {
            next.date_signature_precedent = toYmd(data.date_signature_precedent);
          }
          if (
            (prev.date_signature_precedent_proc_id == null || prev.date_signature_precedent_proc_id === '') &&
            data.date_signature_precedent_proc_id
          ) {
            next.date_signature_precedent_proc_id = Number(data.date_signature_precedent_proc_id);
          }
          if ((prev.date_octroi == null || prev.date_octroi === '') && (procOctroi || data.date_octroi)) {
            next.date_octroi = toYmd(procOctroi || data.date_octroi);
          }
          if ((prev.date_expiration == null || prev.date_expiration === '') && data.date_expiration) {
            next.date_expiration = toYmd(data.date_expiration);
          }
          if ((prev.superficie == null || prev.superficie === '') && data.superficie != null) {
            next.superficie = data.superficie;
          }
          return next;
        });
      } catch (e) {
        console.warn('Failed to load permis details', e);
      }
    };
    void loadPermisDetails();
    return () => {
      active = false;
    };
  }, [apiURL, permisIdForDetails, procIdForDetails]);

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

  useEffect(() => {
    if (!baseData) return;
    setDataValues({
      nom_societeAR: baseData.nom_societeAR ?? '',
      nom_societeFR: baseData.nom_societeFR ?? '',
      detenteur_statut_id: baseData.detenteur_statut_id ?? null,
      id_wilaya: baseData.id_wilaya ?? null,
      id_daira: baseData.id_daira ?? null,
      id_commune: baseData.id_commune ?? null,
      lieu_dit_ar: baseData.lieu_dit_ar ?? '',
      lieu_dit_fr: baseData.lieu_dit_fr ?? '',
      date_demande: baseData.date_demande ?? '',
      date_octroi: baseData.date_octroi ?? '',
      date_signature: baseData.date_signature ?? '',
      date_signature_precedent: baseData.date_signature_precedent ?? '',
      date_signature_precedent_proc_id: baseData.date_signature_precedent_proc_id ?? null,
      date_expiration: baseData.date_expiration ?? '',
      superficie: baseData.superficie ?? '',
      substance_ids: Array.isArray(baseData.substance_ids) ? baseData.substance_ids : [],
    });
  }, [baseData]);

  useEffect(() => {
    if (!apiURL || !baseData) return;
    const detenteurId = Number(baseData.detenteur_id);
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
  }, [apiURL, baseData, dataValues.detenteur_statut_id]);

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
    if (!baseData) return null;
    const values = dataValues || {};
    const pickLabel = (...vals: any[]) => {
      for (const v of vals) {
        if (typeof v !== 'string') continue;
        const s = v.trim();
        if (s) return s;
      }
      return '';
    };

    const wilayaId = Number(values.id_wilaya ?? baseData.id_wilaya);
    const dairaId = Number(values.id_daira ?? baseData.id_daira);
    const communeId = Number(values.id_commune ?? baseData.id_commune);
    const wilaya = wilayas.find((w: any) => Number(w?.id_wilaya) === wilayaId);
    const daira = dairas.find((d: any) => Number(d?.id_daira) === dairaId);
    const commune = communes.find((c: any) => Number(c?.id_commune) === communeId);

    const wilayaNomFr = pickLabel(wilaya?.nom_wilayaFR, baseData.wilaya_nom_fr, baseData.wilaya_nom);
    const wilayaNomAr = pickLabel(wilaya?.nom_wilayaAR, baseData.wilaya_nom_ar);
    const dairaNomFr = pickLabel(daira?.nom_dairaFR, baseData.daira_nom_fr, baseData.daira_nom);
    const dairaNomAr = pickLabel(daira?.nom_dairaAR, baseData.daira_nom_ar);
    const communeNomFr = pickLabel(commune?.nom_communeFR, baseData.commune_nom_fr, baseData.commune_nom);
    const communeNomAr = pickLabel(commune?.nom_communeAR, baseData.commune_nom_ar);
    const communeNom = pickLabel(communeNomAr, communeNomFr);
    const dairaNom = pickLabel(dairaNomAr, dairaNomFr);
    const wilayaNom = pickLabel(wilayaNomAr, wilayaNomFr);
    const localisation = [communeNom, dairaNom, wilayaNom].filter(Boolean).join(' - ');

    const statutId = Number(values.detenteur_statut_id ?? baseData.detenteur_statut_id ?? NaN);
    const statutRow = statutsJuridiques.find(
      (row: any) => Number(row?.id_statutJuridique ?? row?.id_statut) === statutId,
    );
    const statutArLabel = pickLabel(
      statutRow?.statut_ar,
      baseData.statut_ar_label,
      baseData.statut_ar,
    );

    const rawSelected = Array.isArray(values.substance_ids)
      ? values.substance_ids
      : Array.isArray(baseData.substance_ids)
        ? baseData.substance_ids
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
    const mergedSubstanceFr = substanceFr || baseData.substance || '';
    const mergedSubstanceAr = substanceAr || baseData.substance_ar || mergedSubstanceFr;

    return {
      ...baseData,
      ...values,
      wilaya_nom: wilayaNom || baseData.wilaya_nom,
      wilaya_nom_ar: wilayaNomAr || baseData.wilaya_nom_ar,
      wilaya_nom_fr: wilayaNomFr || baseData.wilaya_nom_fr,
      daira_nom: dairaNom || baseData.daira_nom,
      daira_nom_ar: dairaNomAr || baseData.daira_nom_ar,
      daira_nom_fr: dairaNomFr || baseData.daira_nom_fr,
      commune_nom: communeNom || baseData.commune_nom,
      commune_nom_ar: communeNomAr || baseData.commune_nom_ar,
      commune_nom_fr: communeNomFr || baseData.commune_nom_fr,
      wilaya_ar: wilayaNomAr || baseData.wilaya_ar,
      daira_ar: dairaNomAr || baseData.daira_ar,
      commune_ar: communeNomAr || baseData.commune_ar,
      localisation: localisation || baseData.localisation,
      substance: mergedSubstanceFr || undefined,
      substance_ar: mergedSubstanceAr || undefined,
      statut_ar_label: statutArLabel || baseData.statut_ar_label,
      statut_ar: statutArLabel || baseData.statut_ar,
    };
  }, [baseData, dataValues, wilayas, dairas, communes, substances, statutsJuridiques]);

  const handleSaveData = useCallback(async () => {
    if (!apiURL) {
      toast.error('Configuration API manquante');
      return;
    }
    if (!baseData) return;

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

    const demandeIdRaw = demandeId ?? baseData?.id_demande ?? baseData?.demande_id ?? null;
    const demandeIdValue = normalizeNumber(demandeIdRaw);
    const hasDemande = demandeIdValue != null;
    const permisIdValue = normalizeNumber(
      permisId ??
        baseData?.permisId ??
        baseData?.permis_id ??
        baseData?.id_permis ??
        baseData?.permis?.id ??
        null,
    );
      const procIdValue = normalizeNumber(
        procedureId ??
          baseData?.id_proc ??
          baseData?.procedure?.id_proc ??
          baseData?.procedureId ??
          baseData?.procId ??
          null,
      );
    const detenteurIdValue = normalizeNumber(
      baseData?.detenteur_id ?? baseData?.detenteur?.id_detenteur ?? baseData?.detenteur?.id ?? null,
    );
    const detenteurStatutId = normalizeNumber(
      dataValues.detenteur_statut_id ?? baseData?.detenteur_statut_id ?? null,
    );
    const detenteurOriginalStatut = normalizeNumber(baseData?.detenteur_statut_id ?? null);
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
      baseData.detenteur_tel ?? baseData?.detenteur?.telephone ?? baseData?.detenteur?.tel ?? '',
    );
    const detenteurEmail = String(baseData.detenteur_email ?? baseData?.detenteur?.email ?? '');
    const detenteurFax = String(baseData.detenteur_fax ?? baseData?.detenteur?.fax ?? '');
    const detenteurAdresse = String(
      baseData.detenteur_adresse ??
        baseData?.detenteur?.adresse_siege ??
        baseData?.detenteur?.adresse ??
        '',
    );
    const detenteurPaysId = normalizeNumber(baseData.detenteur_pays_id);
    const detenteurNationaliteId = normalizeNumber(baseData.detenteur_nationalite_id);
    const detenteurOriginalAr = normalizeText(baseData.nom_societeAR) ?? '';
    const detenteurOriginalFr = normalizeText(baseData.nom_societeFR) ?? '';
    const detenteurDirty =
      detenteurIdValue != null &&
      ((nomSocieteAr ?? '') !== detenteurOriginalAr ||
        (nomSocieteFr ?? '') !== detenteurOriginalFr ||
        (detenteurEffectiveStatut ?? null) !== (detenteurOriginalStatut ?? null));
    const precedentProcId = normalizeNumber(
      dataValues.date_signature_precedent_proc_id ??
        baseData?.date_signature_precedent_proc_id ??
        null,
    );
    const precedentPermisId = normalizeNumber(
      dataValues.prior_permis_id ??
        baseData?.prior_permis_id ??
        baseData?.priorPermisId ??
        baseData?.permis_precedent_id ??
        baseData?.permisPrecedentId ??
        null,
    );

    const errors: string[] = [];
    setDataSaving(true);

    try {
      const targetPrecedentPermisId = precedentPermisId ?? permisIdValue ?? null;
      let resolvedPrecedentProcId = precedentProcId;
      if (targetPrecedentPermisId != null && resolvedPrecedentProcId == null) {
        try {
          const priorRes = await axios.get(
            `${apiURL}/Permisdashboard/${targetPrecedentPermisId}`,
            { withCredentials: true },
          );
          const priorData = priorRes.data || {};
          const candidate = Number(priorData?.date_signature_precedent_proc_id);
          if (Number.isFinite(candidate) && candidate > 0) {
            resolvedPrecedentProcId = candidate;
          }
        } catch (e) {
          console.warn('Failed to resolve precedent procedure id', e);
        }
      }
      if (
        targetPrecedentPermisId != null &&
        resolvedPrecedentProcId != null &&
        dateSignaturePrecedent !== undefined
      ) {
        try {
          await axios.patch(
            `${apiURL}/api/permis/procedure/${resolvedPrecedentProcId}/permis/${targetPrecedentPermisId}/signature`,
            { date_signature: dateSignaturePrecedent },
            { withCredentials: true },
          );
        } catch (e) {
          console.error('Failed to update precedent signature', e);
          errors.push('Signature precedente');
        }
      }

      if (hasDemande) {
        try {
          await axios.put(
            `${apiURL}/demandes/${demandeIdValue}`,
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

      let resolvedPermisId = permisIdValue;
      if (resolvedPermisId == null && procIdValue != null) {
        try {
          const res = await axios.get(`${apiURL}/api/permis/procedure/${procIdValue}/permis`, {
            withCredentials: true,
          });
          const apiPermisId = normalizeNumber(
            res.data?.permisId ?? res.data?.id ?? res.data?.permis?.id ?? null,
          );
          if (apiPermisId != null) {
            resolvedPermisId = apiPermisId;
          }
        } catch (e) {
          console.warn('Failed to resolve permis id', e);
        }
      }

      if (resolvedPermisId != null) {
        try {
          if (procIdValue != null) {
            try {
              await axios.patch(
                `${apiURL}/api/permis/procedure/${procIdValue}/permis/${resolvedPermisId}/signature`,
                { date_signature: dateSignature },
                { withCredentials: true },
              );
            } catch (e) {
              console.error('Failed to update procedure signature', e);
              errors.push('Signature procedure');
            }
            try {
              await axios.patch(
                `${apiURL}/api/permis/procedure/${procIdValue}/permis/${resolvedPermisId}/octroi`,
                {
                  date_octroi: dateOctroi,
                  updatePermis: !!isInitialDemande,
                },
                { withCredentials: true },
              );
            } catch (e) {
              console.error('Failed to update procedure octroi', e);
              errors.push('Date octroi');
            }
          }
          const targetPrecedentPermisId = precedentPermisId ?? resolvedPermisId;
          await axios.patch(
            `${apiURL}/Permisdashboard/${resolvedPermisId}`,
            {
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
      } else if (dateOctroi || dateSignature || dateExpiration || superficieValue != null) {
        toast.warn('Permis introuvable: enregistrez le permis avant de sauvegarder ses dates.');
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
          const currentRes = await axios.get(`${apiURL}/api/substances/demande/${demandeIdValue}`, {
            withCredentials: true,
          });
          const currentIds = Array.isArray(currentRes.data)
            ? currentRes.data
                .map((sub: any) => Number(sub?.id_sub))
                .filter((id: any) => Number.isFinite(id))
            : [];
          const selectedSet = new Set(selectedIds);
          const toRemove = currentIds.filter((id) => !selectedSet.has(id));

          for (const id of toRemove) {
            try {
              await axios.delete(`${apiURL}/api/substances/demande/${demandeIdValue}/${id}`, {
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
              `${apiURL}/api/substances/demande/${demandeIdValue}`,
              { id_substance: id, priorite },
              { withCredentials: true },
            );
          }
        } catch (e) {
          console.error('Failed to update substances', e);
          errors.push('Substances');
        }
      }

      if (onReload) {
        try {
          await onReload();
        } catch (e) {
          console.warn('Failed to reload designer data', e);
        }
      }

      if (errors.length) {
        toast.error(`Echec de mise a jour: ${errors.join(', ')}`);
      } else {
        toast.success('Donnees mises a jour');
      }
    } finally {
      setDataSaving(false);
    }
    }, [apiURL, baseData, dataValues, demandeId, permisId, procedureId, isInitialDemande, onReload]);

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
  }, [communes, dairas, dataValues.id_daira, dataValues.id_wilaya, statutsJuridiques, substances, wilayas]);

  const dataEditorConfig = useMemo<PermisDesignerDataEditor | undefined>(() => {
    if (!baseData) return undefined;
    return {
      enabled: true,
      sections: dataSections,
      values: dataValues,
      onChange: handleDataChange,
      onSave: handleSaveData,
      saving: dataSaving,
      saveLabel: 'Enregistrer',
      applyLabel: 'Recharger articles',
    };
  }, [baseData, dataSections, dataValues, handleDataChange, handleSaveData, dataSaving]);

  return { dataEditorConfig, mergedInitialData };
};
