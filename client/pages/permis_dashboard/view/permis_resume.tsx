import React, { useEffect, useMemo, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import {
  Calendar,
  MapPin,
  FileText,
  Building2,
  ArrowLeft,
  Clock,
  RefreshCw,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react';
import styles from './PermisResume.module.css';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import {
  computePermisSuperficie,
  getPermisTitulaireName,
  getPermisSubstances,
  getPermisWilayaName,
  getPermisCommuneName,
  getPermisDairaName,
} from '@/utils/permisHelpers';

type ProcedureSummary = {
  id_proc: number;
  num_proc?: string | null;
  date_debut_proc?: string | Date | null;
  date_fin_proc?: string | Date | null;
  statut_proc?: string | null;
  typeProcedure?: {
    libelle?: string | null;
    code?: string | null;
  } | null;
  demandes?: Array<{
    typeProcedure?: {
      libelle?: string | null;
      code?: string | null;
    } | null;
  }>;
};

type PermisResume = {
  id: number;
  code_permis?: string | null;
  date_octroi?: string | Date | null;
  date_expiration?: string | Date | null;
  date_annulation?: string | Date | null;
  date_renonciation?: string | Date | null;
  superficie?: number | null;
  nombre_renouvellements?: number | null;
  statut?: { lib_statut?: string | null; color_code?: string | null } | null;
  typePermis?: { lib_type?: string | null; code_type?: string | null } | null;
  antenne?: { nom?: string | null } | null;
  detenteur?: { nom_societeFR?: string | null } | null;
  procedures?: ProcedureSummary[];
};

interface Props {
  permis?: PermisResume | null;
  error?: string | null;
}

const safeDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value: string | Date | null | undefined) => {
  const d = safeDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const formatNumber = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
};

const getProcedureLabel = (proc?: ProcedureSummary | null) => {
  if (!proc) return 'Procedure';
  return (
    proc.typeProcedure?.libelle ||
    proc.demandes?.[0]?.typeProcedure?.libelle ||
    proc.typeProcedure?.code ||
    proc.demandes?.[0]?.typeProcedure?.code ||
    proc.num_proc ||
    'Procedure'
  );
};

const getProcedureDate = (proc?: ProcedureSummary | null) => {
  if (!proc) return '-';
  return formatDate(proc.date_debut_proc);
};

const getProceduresSorted = (procedures?: ProcedureSummary[]) => {
  if (!Array.isArray(procedures)) return [];
  return [...procedures].sort((a, b) => {
    const aDate = safeDate(a.date_debut_proc)?.getTime() ?? 0;
    const bDate = safeDate(b.date_debut_proc)?.getTime() ?? 0;
    if (aDate !== bDate) return bDate - aDate;
    return (b.id_proc ?? 0) - (a.id_proc ?? 0);
  });
};

const PermisResumePage: React.FC<Props> = ({ permis, error }) => {
  const router = useRouter();
  const { currentView, navigateTo } = useViewNavigator('gestion-permis');
  const [permisState, setPermisState] = useState<PermisResume | null>(permis ?? null);
  const [loadError, setLoadError] = useState<string | null>(error ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!permis && !error);
  const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (permisState || loadError || !router.isReady) return;
    const idRaw = Array.isArray(router.query?.id) ? router.query.id[0] : router.query?.id;
    if (!idRaw) {
      setLoadError('Identifiant de permis manquant.');
      setIsLoading(false);
      return;
    }
    if (!apiURL) {
      setLoadError('API URL manquant.');
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadPermis = async () => {
      try {
        const res = await fetch(`${apiURL}/Permisdashboard/${idRaw}`, { signal: controller.signal });
        if (!res.ok) {
          setLoadError('Impossible de charger le permis.');
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        setPermisState(data);
        setIsLoading(false);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        setLoadError('Erreur lors du chargement du permis.');
        setIsLoading(false);
      }
    };
    void loadPermis();

    return () => controller.abort();
  }, [apiURL, loadError, permisState, router.isReady, router.query?.id]);

  const procedures = useMemo(
    () => getProceduresSorted(permisState?.procedures),
    [permisState?.procedures],
  );
  const latestProcedure = procedures[0] ?? null;
  const superficie = computePermisSuperficie(permisState);
  const titulaire =
    getPermisTitulaireName(permisState) || permisState?.detenteur?.nom_societeFR || '-';
  const substances = getPermisSubstances(permisState);
  const wilaya = getPermisWilayaName(permisState);
  const daira = getPermisDairaName(permisState);
  const commune = getPermisCommuneName(permisState);
  const location = [commune, daira, wilaya].filter(Boolean).join(' / ') || '-';
  const statusLabel = permisState?.statut?.lib_statut || 'Statut inconnu';
  const statusColor = permisState?.statut?.color_code || '#0f172a';
  const renewalCount =
    typeof permisState?.nombre_renouvellements === 'number'
      ? permisState.nombre_renouvellements
      : permisState?.procedures?.filter((p) =>
          (p.typeProcedure?.code || '').toLowerCase().includes('renouv'),
        ).length || 0;

  if (loadError) {
    return (
      <div className={styles.appContainer}>
        <Navbar />
        <div className={styles.appContent}>
          <Sidebar currentView={currentView} navigateTo={navigateTo} />
          <main className={styles.mainContent}>
            <div className={styles.page}>
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <AlertTriangle size={20} />
                  <h2 className={styles.sectionTitle}>Erreur</h2>
                </div>
                <p className={styles.muted}>{loadError}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!permisState || isLoading) {
    return (
      <div className={styles.appContainer}>
        <Navbar />
        <div className={styles.appContent}>
          <Sidebar currentView={currentView} navigateTo={navigateTo} />
          <main className={styles.mainContent}>
            <div className={styles.page}>
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <RefreshCw size={20} />
                  <h2 className={styles.sectionTitle}>Chargement</h2>
                </div>
                <p className={styles.muted}>Chargement des informations du permis...</p>
              </div>
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
          <div className={styles.page}>
            <section className={`${styles.hero} ${styles.fadeIn}`}>
              <div className={styles.heroContent}>
                <div>
                  <h1 className={styles.heroTitle}>
                    Resume du permis {permisState.code_permis || ''}
                  </h1>
                  <p className={styles.heroSubtitle}>
                    Synthese des informations essentielles et du statut actuel.
                  </p>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}>
                      <FileText size={14} />
                      {permisState.typePermis?.lib_type || 'Type non defini'}
                    </span>
                    <span className={styles.metaItem}>
                      <MapPin size={14} />
                      {location}
                    </span>
                    <span className={styles.metaItem} style={{ borderColor: 'rgba(255,255,255,0.5)' }}>
                      <BadgeCheck size={14} />
                      {statusLabel}
                    </span>
                  </div>
                </div>
                <div className={styles.heroActions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      router.push(`/permis_dashboard/view/permisdetails?id=${permisState.id}`)
                    }
                  >
                    <ArrowLeft size={16} />
                    Retour aux details
                  </button>
                </div>
              </div>
            </section>

            <div className={styles.content}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Statut du permis</div>
                  <div className={styles.statValue}>{statusLabel}</div>
                  <div className={styles.statSub} style={{ color: statusColor }}>
                    {permisState.typePermis?.code_type || 'Type'} · {permisState.code_permis || '-'}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Superficie</div>
                  <div className={styles.statValue}>
                    {formatNumber(superficie)} ha
                  </div>
                  <div className={styles.statSub}>Derniere valeur connue</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Validite</div>
                  <div className={styles.statValue}>
                    {formatDate(permisState.date_octroi)} - {formatDate(permisState.date_expiration)}
                  </div>
                  <div className={styles.statSub}>Date octroi - expiration</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Procedures</div>
                  <div className={styles.statValue}>{procedures.length}</div>
                  <div className={styles.statSub}>Total des procedures associees</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Renouvellements</div>
                  <div className={styles.statValue}>{renewalCount}</div>
                  <div className={styles.statSub}>Historique connu</div>
                </div>
              </div>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Building2 size={20} />
                  <h2 className={styles.sectionTitle}>Informations generales</h2>
                </div>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Titulaire</div>
                    <div className={styles.infoValue}>{titulaire}</div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Substances</div>
                    <div className={styles.infoValue}>
                      {substances.length ? substances.join(', ') : '-'}
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Localisation</div>
                    <div className={styles.infoValue}>{location}</div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Antenne</div>
                    <div className={styles.infoValue}>{permisState.antenne?.nom || '-'}</div>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Calendar size={20} />
                  <h2 className={styles.sectionTitle}>Dates cles</h2>
                </div>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Date octroi</div>
                    <div className={styles.infoValue}>{formatDate(permisState.date_octroi)}</div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Date expiration</div>
                    <div className={styles.infoValue}>{formatDate(permisState.date_expiration)}</div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Date annulation</div>
                    <div className={styles.infoValue}>{formatDate(permisState.date_annulation)}</div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Date renonciation</div>
                    <div className={styles.infoValue}>{formatDate(permisState.date_renonciation)}</div>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Clock size={20} />
                  <h2 className={styles.sectionTitle}>Derniere procedure</h2>
                </div>
                {latestProcedure ? (
                  <div className={styles.list}>
                    <div className={styles.listItem}>
                      <div>
                        <div className={styles.listTitle}>{getProcedureLabel(latestProcedure)}</div>
                        <div className={styles.listMeta}>
                          {latestProcedure.num_proc || `PROC-${latestProcedure.id_proc}`} - {getProcedureDate(latestProcedure)}
                        </div>
                      </div>
                      <span className={styles.statusPill}>
                        {latestProcedure.statut_proc || 'Statut inconnu'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.muted}>Aucune procedure associee pour le moment.</p>
                )}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <FileText size={20} />
                  <h2 className={styles.sectionTitle}>Procedures recentes</h2>
                </div>
                {procedures.length ? (
                  <div className={styles.list}>
                    {procedures.slice(0, 4).map((proc) => (
                      <div key={proc.id_proc} className={styles.listItem}>
                        <div>
                          <div className={styles.listTitle}>{getProcedureLabel(proc)}</div>
                          <div className={styles.listMeta}>
                            {proc.num_proc || `PROC-${proc.id_proc}`} - {getProcedureDate(proc)}
                          </div>
                        </div>
                        <span className={styles.statusPill}>
                          {proc.statut_proc || 'Statut inconnu'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.muted}>Aucune procedure recente.</p>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context: { query: { id: any } }) => {
  const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const rawId = Array.isArray(context.query.id) ? context.query.id[0] : context.query.id;
  const id = rawId ?? null;

  if (!id || !apiURL) {
    return { props: { permis: null, error: 'Identifiant de permis manquant.' } };
  }

  try {
    const res = await fetch(`${apiURL}/Permisdashboard/${id}`);
    if (!res.ok) {
      return { props: { permis: null, error: 'Impossible de charger le permis.' } };
    }
    const permis = await res.json();
    const serializablePermis = JSON.parse(JSON.stringify(permis));
    return { props: { permis: serializablePermis } };
  } catch (err) {
    return { props: { permis: null, error: 'Erreur lors du chargement du permis.' } };
  }
};

export default PermisResumePage;
