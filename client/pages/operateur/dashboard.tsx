'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldCheck, Building2, FileBadge, ArrowRight } from 'lucide-react';
import styles from './OperatorDashboard.module.css';

type DashboardContext = {
  operator: {
    id: number;
    email: string;
    nom: string;
    Prenom: string;
    role: string;
  };
  permit: {
    id: number;
    short_code: string;
    code_permis: string | null;
    qr_code: string | null;
    date_octroi: string | null;
    date_expiration: string | null;
    type_permis: { lib_type: string | null; code_type: string | null } | null;
    statut: { lib_statut: string | null } | null;
  };
  detenteur: {
    id_detenteur: number;
    nom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
  detenteurIdentification?: {
    detenteur: {
      id_detenteur: number;
      short_code: string | null;
      nom_societeFR: string | null;
      nom_societeAR: string | null;
      adresse_siege: string | null;
      telephone: string | null;
      email: string | null;
      fax: string | null;
      site_web: string | null;
      date_constitution: string | null;
      pays: { id_pays: number; nom_pays: string } | null;
      nationaliteRef: { id_nationalite: number; libelle: string } | null;
      statut_juridique: {
        id_statut: number;
        code_statut: string;
        statut_fr: string;
        statut_ar: string;
      } | null;
    } | null;
    representant: {
      id_fonctionDetent: number;
      type_fonction: string | null;
      taux_participation: number | null;
      personne: {
        id_personne: number;
        nomFR: string | null;
        prenomFR: string | null;
        nomAR: string | null;
        prenomAR: string | null;
        qualification: string | null;
        telephone: string | null;
        email: string | null;
        num_carte_identite: string | null;
        pays: { id_pays: number; nom_pays: string } | null;
        nationaliteRef: { id_nationalite: number; libelle: string } | null;
      } | null;
    } | null;
    registre: {
      id: number;
      numero_rc: string | null;
      date_enregistrement: string | null;
      capital_social: number | null;
      nis: string | null;
      nif: string | null;
      adresse_legale: string | null;
    } | null;
    actionnaires: Array<{
      id_actionnaire: number;
      type_fonction: string | null;
      taux_participation: number | null;
      personne: {
        id_personne: number;
        nomFR: string | null;
        prenomFR: string | null;
        num_carte_identite: string | null;
        nationaliteRef: { id_nationalite: number; libelle: string } | null;
      } | null;
    }>;
  } | null;
  highlightedPermitId: number;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 0,
  }).format(Number(value));
};

export default function OperatorDashboardPage() {
  const router = useRouter();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [context, setContext] = useState<DashboardContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const codeqr = useMemo(() => {
    if (!router.isReady) return '';
    return typeof router.query.codeqr === 'string' ? router.query.codeqr.trim() : '';
  }, [router.isReady, router.query.codeqr]);

  const openTarget = useMemo(() => {
    if (!router.isReady) return '';
    return typeof router.query.open === 'string' ? router.query.open.trim() : '';
  }, [router.isReady, router.query.open]);

  useEffect(() => {
    if (!router.isReady || !apiURL) return;

    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<DashboardContext>(`${apiURL}/operator/dashboard`, {
          params: codeqr ? { codeqr } : undefined,
          withCredentials: true,
        });
        setContext(response.data);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          await router.push(`/operateur/access?codeqr=${encodeURIComponent(codeqr)}`);
          return;
        }
        setError(
          err?.response?.data?.message ||
            'Impossible de charger votre espace operateur pour ce permis.',
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, [apiURL, codeqr, router.isReady]);

  const permitCode = context?.permit?.code_permis || codeqr || '-';
  const ident = context?.detenteurIdentification || null;
  const detenteurInfo = ident?.detenteur || null;
  const representant = ident?.representant?.personne || null;
  const registre = ident?.registre || null;
  const actionnaires = ident?.actionnaires || [];

  const detenteurName =
    detenteurInfo?.nom_societeFR || detenteurInfo?.nom_societeAR || context?.detenteur?.nom || '-';
  const detenteurEmail = detenteurInfo?.email || context?.detenteur?.email || '-';
  const detenteurPhone = detenteurInfo?.telephone || context?.detenteur?.telephone || '-';

  const detailedPermisRoute = context
    ? `/operateur/permisdashboard/${context.permit.short_code || context.permit.id}`
    : '/operateur/permisdashboard/mes-permis';

  useEffect(() => {
    if (!router.isReady || !context) return;
    if (openTarget !== 'permit') return;

    void router.replace(detailedPermisRoute);
  }, [context, detailedPermisRoute, openTarget, router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.panel}>Chargement de votre espace operateur...</div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          <p>{error || 'Aucune information operateur disponible.'}</p>
          <Link href={`/operateur/access?codeqr=${encodeURIComponent(codeqr)}`} className={styles.linkBtn}>
            Retour a l&apos;acces operateur
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <div>
            <h1>Espace operateur actif</h1>
            <p>Permis actif : {permitCode}</p>
          </div>
          <ShieldCheck size={28} className={styles.headerIcon} />
        </div>

        <div className={styles.grid}>
          <article className={styles.card}>
            <h2>
              <FileBadge size={18} /> Permis actif
            </h2>
            <p><strong>Code :</strong> {permitCode}</p>
            <p>
              <strong>Type :</strong>{' '}
              {context.permit.type_permis?.lib_type || context.permit.type_permis?.code_type || '-'}
            </p>
            <p><strong>Statut :</strong> {context.permit.statut?.lib_statut || '-'}</p>
            <p><strong>Date octroi :</strong> {formatDate(context.permit.date_octroi)}</p>
            <p><strong>Date expiration :</strong> {formatDate(context.permit.date_expiration)}</p>
          </article>

          <article className={styles.card}>
            <h2>
              <ShieldCheck size={18} /> Operateur connecte
            </h2>
            <p><strong>Nom :</strong> {context.operator.Prenom || '-'} {context.operator.nom || ''}</p>
            <p><strong>Email :</strong> {context.operator.email || '-'}</p>
            <p><strong>Role :</strong> {context.operator.role || 'operateur'}</p>
          </article>

          <article className={styles.card}>
            <h2>
              <Building2 size={18} /> Detenteur associe
            </h2>
            <p><strong>Societe :</strong> {detenteurName}</p>
            <p><strong>Email :</strong> {detenteurEmail}</p>
            <p><strong>Telephone :</strong> {detenteurPhone}</p>
            <p>
              <strong>Statut juridique :</strong>{' '}
              {detenteurInfo?.statut_juridique?.statut_fr ||
                detenteurInfo?.statut_juridique?.code_statut ||
                '-'}
            </p>
          </article>

          <article className={styles.card}>
            <h2>
              <ShieldCheck size={18} /> Representant legal
            </h2>
            <p>
              <strong>Nom :</strong>{' '}
              {[representant?.prenomFR, representant?.nomFR].filter(Boolean).join(' ') || '-'}
            </p>
            <p><strong>Qualite :</strong> {representant?.qualification || '-'}</p>
            <p><strong>Email :</strong> {representant?.email || '-'}</p>
            <p><strong>Telephone :</strong> {representant?.telephone || '-'}</p>
            <p><strong>NIN :</strong> {representant?.num_carte_identite || '-'}</p>
          </article>

          <article className={styles.card}>
            <h2>
              <FileBadge size={18} /> Registre commerce
            </h2>
            <p><strong>Numero RC :</strong> {registre?.numero_rc || '-'}</p>
            <p><strong>Date :</strong> {formatDate(registre?.date_enregistrement)}</p>
            <p><strong>NIF :</strong> {registre?.nif || '-'}</p>
            <p><strong>NIS :</strong> {registre?.nis || '-'}</p>
            <p><strong>Capital :</strong> {formatCurrency(registre?.capital_social)}</p>
            <p><strong>Adresse :</strong> {registre?.adresse_legale || detenteurInfo?.adresse_siege || '-'}</p>
          </article>

          <article className={`${styles.card} ${styles.cardWide}`}>
            <h2>
              <Building2 size={18} /> Actionnaires
            </h2>
            {actionnaires.length === 0 ? (
              <p className={styles.muted}>Aucun actionnaire renseigne pour ce detenteur.</p>
            ) : (
              <ul className={styles.actionnaireList}>
                {actionnaires.map((row) => {
                  const person = row.personne;
                  const fullName =
                    [person?.prenomFR, person?.nomFR].filter(Boolean).join(' ') || 'Non renseigne';
                  return (
                    <li key={row.id_actionnaire} className={styles.actionnaireItem}>
                      <span className={styles.actionnaireName}>{fullName}</span>
                      <span className={styles.actionnaireMeta}>
                        {person?.num_carte_identite || '-'} | {person?.nationaliteRef?.libelle || '-'}
                      </span>
                      <span className={styles.actionnaireRate}>
                        {row.taux_participation != null ? `${row.taux_participation}%` : '-'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </div>

        <div className={styles.actions}>
          <Link href={detailedPermisRoute} className={styles.primaryBtn}>
            Ouvrir le dashboard permis complet
            <ArrowRight size={16} />
          </Link>
          <Link
            href={`/operateur/scan-qr${codeqr ? `?codeqr=${encodeURIComponent(codeqr)}` : ''}`}
            className={styles.secondaryBtn}
          >
            Entrer ou scanner un QR
          </Link>
          <Link href="/operateur/permisdashboard/mes-permis" className={styles.secondaryBtn}>
            Voir tous mes permis
          </Link>
        </div>
      </div>
    </div>
  );
}
