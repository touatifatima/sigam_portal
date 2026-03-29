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
  highlightedPermitId: number;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
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
          await router.push(`/operator/access?codeqr=${encodeURIComponent(codeqr)}`);
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
  const detailedPermisRoute = context
    ? `/operateur/permisdashboard/${context.permit.short_code || context.permit.id}`
    : '/operateur/permisdashboard/mes-permis';

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
          <Link href={`/operator/access?codeqr=${encodeURIComponent(codeqr)}`} className={styles.linkBtn}>
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
            <p><strong>Societe :</strong> {context.detenteur?.nom || '-'}</p>
            <p><strong>Email :</strong> {context.detenteur?.email || '-'}</p>
            <p><strong>Telephone :</strong> {context.detenteur?.telephone || '-'}</p>
          </article>
        </div>

        <div className={styles.actions}>
          <Link href={detailedPermisRoute} className={styles.primaryBtn}>
            Ouvrir le dashboard permis complet
            <ArrowRight size={16} />
          </Link>
          <Link href="/operateur/permisdashboard/mes-permis" className={styles.secondaryBtn}>
            Voir tous mes permis
          </Link>
        </div>
      </div>
    </div>
  );
}
