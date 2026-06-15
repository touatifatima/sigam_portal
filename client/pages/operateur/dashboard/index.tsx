'use client';



import { useEffect, useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import axios from 'axios';

import {

  AlertCircle,

  ArrowRight,

  Bell,

  CheckCircle2,

  Clock3,

  FileText,

  Map,

  QrCode,

  ShieldCheck,

  TrendingUp,

} from 'lucide-react';

import Navbar from '@/pages/navbar/Navbar';

import { useAuthStore } from '@/src/store/useAuthStore';

import { useAuthReady } from '@/src/hooks/useAuthReady';

import { getDefaultDashboardPath, isInvestisseurRole, isOperateurRole } from '@/src/utils/roleNavigation';

import styles from '../../investisseur/dashboard/Dashboard.module.css';



type PermitCard = {

  id: number;

  short_code?: string | null;

  code_permis?: string | null;

  date_octroi?: string | null;

  date_expiration?: string | null;

  typePermis?: { lib_type?: string | null; code_type?: string | null } | null;

  statut?: { lib_statut?: string | null } | null;

  detenteur?: {

    id_detenteur?: number | null;

    nom_societeFR?: string | null;

    nom_societeAR?: string | null;

  } | null;

};



type DashboardStats = {

  demandesEnCours: number;

  permisActifs: number;

};



type OperatorDashboardContext = {

  permit?: PermitCard | null;

  detenteur?: unknown;

  operator?: unknown;

  highlightedPermitId?: number | null;

};



const toList = <T,>(payload: unknown): T[] => {

  if (Array.isArray(payload)) return payload as T[];

  if (

    payload &&

    typeof payload === 'object' &&

    'data' in payload &&

    Array.isArray((payload as { data?: unknown }).data)

  ) {

    return (payload as { data: T[] }).data;

  }

  return [];

};



const normalizeStatus = (value: unknown): string =>

  String(value ?? '')

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .trim()

    .toUpperCase();



const isActivePermisStatus = (status: unknown): boolean => {

  const normalized = normalizeStatus(status);

  return (

    normalized.includes('ACTIF') ||

    normalized.includes('VALIDE') ||

    normalized.includes('VALID') ||

    normalized.includes('VIGUEUR')

  );

};



export default function OperateurDashboardPage() {

  const navigate = useNavigate();

  const location = useLocation();

  const { auth } = useAuthStore();

  const isAuthReady = useAuthReady();

  const apiURL = process.env.NEXT_PUBLIC_API_URL;



  const [stats, setStats] = useState<DashboardStats>({

    demandesEnCours: 0,

    permisActifs: 0,

  });

  const [loadingStats, setLoadingStats] = useState(true);

  const [focusPermit, setFocusPermit] = useState<PermitCard | null>(null);

  const [focusError, setFocusError] = useState<string | null>(null);



  const codeqr = useMemo(() => {

    const params = new URLSearchParams(location.search);

    return String(params.get('codeqr') ?? '').trim();

  }, [location.search]);



  useEffect(() => {

    if (!isAuthReady) return;

    if (!auth?.email && !auth?.username) {

      navigate('/');

      return;

    }

    if (!isOperateurRole(auth?.role) || isInvestisseurRole(auth?.role)) {

      navigate(getDefaultDashboardPath(auth?.role), { replace: true });

    }

  }, [auth?.email, auth?.role, auth?.username, isAuthReady, navigate]);



  useEffect(() => {

    if (!apiURL) return;



    let mounted = true;



    const loadStats = async () => {

      setLoadingStats(true);

      try {

        const [demandesResult, permisResult] = await Promise.allSettled([

          axios.get(`${apiURL}/demandes/mes-demandes`, { withCredentials: true }),

          axios.get(`${apiURL}/operateur/permis`, { withCredentials: true }),

        ]);



        const demandes =

          demandesResult.status === 'fulfilled'

            ? toList<unknown>(demandesResult.value.data)

            : [];

        const permis =

          permisResult.status === 'fulfilled'

            ? toList<PermitCard>(permisResult.value.data)

            : [];



        const permisActifs = permis.filter((item) => isActivePermisStatus(item?.statut?.lib_statut)).length;



        if (!mounted) return;

        setStats({

          demandesEnCours: demandes.length,

          permisActifs,

        });

      } finally {

        if (!mounted) return;

        setLoadingStats(false);

      }

    };



    void loadStats();



    return () => {

      mounted = false;

    };

  }, [apiURL]);



  useEffect(() => {

    if (!apiURL || !codeqr) return;

    let mounted = true;

    const loadFocusPermit = async () => {
      try {
        const response = await axios.get<OperatorDashboardContext>(
          `${apiURL}/operator/dashboard`,
          {
            params: { codeqr },
            withCredentials: true,
          },
        );

        if (!mounted) return;
        setFocusPermit(response.data?.permit ?? null);
        setFocusError(null);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          await navigate(`/operateur/access?codeqr=${encodeURIComponent(codeqr)}`);
          return;
        }

        if (!mounted) return;
        setFocusPermit(null);
        setFocusError(err?.response?.data?.message || null);
      }
    };

    void loadFocusPermit();

    return () => {
      mounted = false;
    };
  }, [apiURL, codeqr, navigate]);



  const displayName = useMemo(() => {

    return auth?.username || auth?.email || 'Utilisateur';

  }, [auth?.email, auth?.username]);



  const activityRate = useMemo(() => {

    const baseScore = auth.isEntrepriseVerified ? 74 : 56;

    const demandesScore = Math.min(stats.demandesEnCours * 4, 16);

    const permisScore = Math.min(stats.permisActifs * 6, 20);

    return Math.max(35, Math.min(98, baseScore + demandesScore + permisScore));

  }, [auth.isEntrepriseVerified, stats.demandesEnCours, stats.permisActifs]);



  if (!isAuthReady) {

    return (

      <div className={styles.loadingState}>

        <div className={styles.spinner} />

        <p>Chargement...</p>

      </div>

    );

  }



  const permitFocusRoute = focusPermit

    ? `/operateur/permisdashboard/${focusPermit.short_code || focusPermit.id}`

    : '/operateur/permisdashboard/mes-permis';

  return (

    <div className={styles.dashboard}>

      <Navbar />



      <main className={styles.main}>

        <section className={styles.hero} data-onboarding-id="dashboard-hero">

          <div className={styles.heroOverlay} />

          <div className={styles.heroTop}>

            <div className={styles.heroContent}>

              <h1 className={styles.heroTitle}>Espace Operateur</h1>

              <p className={styles.heroSubtitle}>Bienvenue, {displayName}</p>

              <div className={styles.roleBadge}>

                <CheckCircle2 size={16} />

                <span>

                  {auth.isEntrepriseVerified ? 'Compte operateur actif' : 'Compte operateur a verifier'}

                </span>

              </div>

            </div>



            <div className={styles.heroActions}>

              <button className={styles.primaryAction} onClick={() => navigate('/demand_dashboard/mine')}>

                <FileText size={18} />

                Mes demandes

              </button>

              <button className={styles.ghostAction} onClick={() => navigate('/operateur/permisdashboard/mes-permis')}>

                <ShieldCheck size={17} />

                Mes permis

              </button>

              <button className={styles.ghostAction} onClick={() => navigate('/notification')}>

                <Bell size={17} />

                Notifications

              </button>

            </div>

          </div>

        </section>



        {codeqr && (

        <section className={styles.quickAccessSection}>

          <div className={styles.quickAccessHeader}>

            <div className={styles.quickAccessHeaderText}>

              <h2 className={styles.quickAccessTitle}>Permis en focus</h2>

              <p className={styles.quickAccessSubtitle}>

                Apercu rapide du permis scanne ou transmis par le QR code.

              </p>

            </div>

            <span className={styles.quickBadge}>QR</span>

          </div>



          {focusError ? (

            <p className={styles.quickCardDescription}>{focusError}</p>

          ) : null}



          <div className={styles.quickCardsGrid}>

            <article className={`${styles.quickAccessCard} ${styles.quickCardDemandes}`}>

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconDemandes}`}>

                  <QrCode size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>Code QR</h3>

              <p className={styles.quickCardDescription}>{codeqr}</p>

              <p className={styles.quickCardDescription}>

                {focusPermit?.code_permis || focusPermit?.short_code || 'Chargement du permis...'}

              </p>

              {focusError ? <p className={styles.quickCardDescription}>{focusError}</p> : null}

            </article>



            <article className={`${styles.quickAccessCard} ${styles.quickCardMap}`}>

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconMap}`}>

                  <Map size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>Ouvrir le permis</h3>

              <p className={styles.quickCardDescription}>

                Acceder au detail complet du permis et aux ecrans metier associes.

              </p>

              <button type="button" className={styles.primaryAction} onClick={() => navigate(permitFocusRoute)}>

                Ouvrir

                <ArrowRight size={16} />

              </button>

            </article>

          </div>

        </section>

        )}



        <section className={styles.kpiStrip} data-onboarding-id="dashboard-status">

          <article className={`${styles.kpiCard} ${styles.kpiWarn}`}>

            <span className={`${styles.kpiIcon} ${styles.kpiIconWarn}`}>

              <AlertCircle size={18} />

            </span>

            <div className={styles.kpiText}>

              <p>Profil operateur</p>

              <h3>{auth.isEntrepriseVerified ? 'Confirme' : 'A verifier'}</h3>

              <small>

                {auth.isEntrepriseVerified ? 'Acces complet au tableau de bord' : 'Finaliser la verification'}

              </small>

            </div>

          </article>



          <article className={`${styles.kpiCard} ${styles.kpiBlue}`}>

            <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}>

              <Clock3 size={18} />

            </span>

            <div className={styles.kpiText}>

              <p>Demandes en cours</p>

              <h3>{String(stats.demandesEnCours).padStart(2, '0')}</h3>

              <small>demande(s) en traitement</small>

            </div>

          </article>



          <article className={`${styles.kpiCard} ${styles.kpiGold}`}>

            <span className={`${styles.kpiIcon} ${styles.kpiIconGold}`}>

              <ShieldCheck size={18} />

            </span>

            <div className={styles.kpiText}>

              <p>Permis actifs</p>

              <h3>{String(stats.permisActifs).padStart(2, '0')}</h3>

              <small>permis suivis</small>

            </div>

          </article>



          <article className={`${styles.kpiCard} ${styles.kpiViolet}`}>

            <span className={`${styles.kpiIcon} ${styles.kpiIconViolet}`}>

              <TrendingUp size={18} />

            </span>

            <div className={styles.kpiText}>

              <p>Activite globale</p>

              <h3>{loadingStats ? '...' : `${activityRate}%`}</h3>

              <small>taux de conformite</small>

            </div>

          </article>

        </section>



        <section className={styles.quickAccessSection} data-onboarding-id="dashboard-quick-access">

          <div className={styles.quickAccessHeader}>

            <div className={styles.quickAccessHeaderText}>

              <h2 className={styles.quickAccessTitle}>Acces rapide</h2>

              <p className={styles.quickAccessSubtitle}>

                Outils operateurs pour naviguer entre demandes, permis, carte et notifications.

              </p>

            </div>

            <button className={styles.overviewButton} onClick={() => navigate('/investisseur/statistiques')}>

              Statistiques

              <ArrowRight size={14} />

            </button>

          </div>



          <div className={styles.quickCardsGrid}>

            <button

              type="button"

              className={`${styles.quickAccessCard} ${styles.quickCardDemandes}`}

              onClick={() => navigate('/demand_dashboard/mine')}

            >

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconDemandes}`}>

                  <FileText size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>

                Demandes

                <span className={styles.quickBadge}>{stats.demandesEnCours > 0 ? 'Actif' : 'Pret'}</span>

              </h3>

              <p className={styles.quickCardDescription}>

                Suivre les demandes dont vous etes responsable.

              </p>

            </button>



            <button

              type="button"

              className={`${styles.quickAccessCard} ${styles.quickCardNotif}`}

              onClick={() => navigate('/operateur/permisdashboard/mes-permis')}

            >

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconNotif}`}>

                  <ShieldCheck size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>Mes permis</h3>

              <p className={styles.quickCardDescription}>

                Consulter vos permis, leurs statuts et les operations associees.

              </p>

            </button>



            <button

              type="button"

              className={`${styles.quickAccessCard} ${styles.quickCardMap}`}

              onClick={() => navigate('/carte/carte_public')}

            >

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconMap}`}>

                  <Map size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>Carte Miniere</h3>

              <p className={styles.quickCardDescription}>

                Explorer les zones, perimetres et informations SIG disponibles.

              </p>

            </button>



            <button

              type="button"

              className={`${styles.quickAccessCard} ${styles.quickCardDemandes}`}

              onClick={() => navigate('/investisseur/statistiques')}

            >

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconDemandes}`}>

                  <TrendingUp size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>Statistiques</h3>

              <p className={styles.quickCardDescription}>

                Acceder aux indicateurs, repartitions et tableaux de bord operateurs.

              </p>

            </button>



            <button

              type="button"

              className={`${styles.quickAccessCard} ${styles.quickCardNotif}`}

              onClick={() => navigate('/notification')}

            >

              <div className={styles.quickCardTop}>

                <div className={`${styles.quickIcon} ${styles.quickIconNotif}`}>

                  <Bell size={18} />

                </div>

                <span className={styles.quickCardArrow} aria-hidden="true">

                  <ArrowRight size={16} />

                </span>

              </div>

              <h3 className={styles.quickCardTitle}>Notifications</h3>

              <p className={styles.quickCardDescription}>

                Consulter les alertes, messages et mises a jour recentes.

              </p>

            </button>

          </div>

        </section>

      </main>

    </div>

  );

}

