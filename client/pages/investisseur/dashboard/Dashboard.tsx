import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  Map,
  Bell,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import axios from "axios";
import styles from "./Dashboard.module.css";
import Navbar from "@/pages/navbar/Navbar";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import {
  getDefaultDashboardPath,
  isCadastreRole,
} from "@/src/utils/roleNavigation";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import {
  getHasSeenOnboarding,
  getOnboardingActive,
  getOnboardingPageSeen,
  markOnboardingPageCompleted,
  setOnboardingActive,
  stopOnboardingForever,
} from "@/src/onboarding/storage";

type StatState = {
  demandesEnCours: number;
  permisActifs: number;
};

const DASHBOARD_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "dashboard-hero",
    target: '[data-onboarding-id="dashboard-hero"]',
    title: "Votre espace personnel de Guichet Unique Minier",
    description:
      "Ici vous retrouvez un resume global de votre activite miniere avec vos actions prioritaires.",
    placement: "bottom",
  },
  {
    id: "dashboard-new-request",
    target: '[data-onboarding-id="dashboard-new-request"]',
    title: "Demarrer une nouvelle demande",
    description:
      "Ce bouton lance directement le workflow de creation de demande, avec verification prealable et etapes guidees.",
    placement: "left",
  },
  {
    id: "dashboard-status",
    target: '[data-onboarding-id="dashboard-status"]',
    title: "Statut instantane",
    description:
      "Ces cartes donnent vos indicateurs critiques: profil entreprise, demandes en cours et permis actifs.",
    placement: "bottom",
  },
  {
    id: "dashboard-demandes",
    target: '[data-onboarding-id="dashboard-card-demandes"]',
    title: "Suivi des demandes",
    description:
      "Accedez rapidement a vos demandes pour voir les statuts, actions attendues et historique.",
    placement: "right",
  },
  {
    id: "dashboard-notifications",
    target: '[data-onboarding-id="dashboard-card-notifications"]',
    title: "Centre de notifications",
    description:
      "Toutes les alertes importantes arrivent ici: changements de statut, demandes de complement, decisions.",
    placement: "left",
  },
  {
    id: "dashboard-quick-access",
    target: '[data-onboarding-id="dashboard-quick-access"]',
    title: "Acces rapide",
    description:
      "Utilisez ces raccourcis pour naviguer plus vite entre vos modules metier.",
    placement: "top",
  },
];

const toList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

const normalizeStatus = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const isActivePermisStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized.includes("ACTIF") ||
    normalized.includes("VALIDE") ||
    normalized.includes("VALID") ||
    normalized.includes("VIGUEUR")
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuthStore();
  const isAuthReady = useAuthReady();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [stats, setStats] = useState<StatState>({
    demandesEnCours: 0,
    permisActifs: 0,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!auth?.email && !auth?.username) {
      navigate("/");
      return;
    }
    if (isCadastreRole(auth?.role)) {
      navigate(getDefaultDashboardPath(auth?.role), { replace: true });
    }
  }, [auth?.email, auth?.role, auth?.username, isAuthReady, navigate]);

  useEffect(() => {
    let isActive = true;
    if (!apiURL) return () => undefined;
    if (isCadastreRole(auth?.role)) return () => undefined;

    const loadStats = async () => {
      try {
        const [demandesResult, permisResult] = await Promise.allSettled([
          axios.get(`${apiURL}/demandes/mes-demandes`, { withCredentials: true }),
          axios.get(`${apiURL}/operateur/permis`, { withCredentials: true }),
        ]);

        const demandes =
          demandesResult.status === "fulfilled"
            ? toList<unknown>(demandesResult.value.data)
            : [];

        const permis =
          permisResult.status === "fulfilled"
            ? toList<Record<string, unknown>>(permisResult.value.data)
            : [];

        const permisActifs = permis.filter((item) => {
          const statutField = (item as { statut?: unknown }).statut;
          const rawStatus =
            typeof statutField === "string"
              ? statutField
              : (statutField as { lib_statut?: unknown } | undefined)?.lib_statut;
          return isActivePermisStatus(rawStatus);
        }).length;

        if (!isActive) return;
        setStats({
          demandesEnCours: demandes.length,
          permisActifs,
        });
      } catch {
        if (!isActive) return;
        setStats((prev) => ({ ...prev }));
      }
    };

    void loadStats();

    return () => {
      isActive = false;
    };
  }, [apiURL, auth?.role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getHasSeenOnboarding()) return;

    const search = new URLSearchParams(location.search);
    const shouldStartFromQuery = search.get("onboarding") === "1";
    const active = getOnboardingActive() || shouldStartFromQuery;
    const alreadySeenDashboard = getOnboardingPageSeen("investor-dashboard");

    if (shouldStartFromQuery) {
      setOnboardingActive(true);
    }

    if (active && !alreadySeenDashboard) {
      setShowOnboarding(true);
    }
  }, [location.search]);

  const displayName = useMemo(() => {
    return auth?.username || auth?.email || "Utilisateur";
  }, [auth?.email, auth?.username]);

  const activityRate = useMemo(() => {
    const baseScore = auth.isEntrepriseVerified ? 74 : 56;
    const demandesScore = Math.min(stats.demandesEnCours * 4, 16);
    const permisScore = Math.min(stats.permisActifs * 6, 20);
    return Math.max(35, Math.min(98, baseScore + demandesScore + permisScore));
  }, [auth.isEntrepriseVerified, stats.demandesEnCours, stats.permisActifs]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    stopOnboardingForever();
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingPageCompleted("investor-dashboard");
  };

  if (!isAuthReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <Navbar />

      <main className={styles.main}>
        <section className={styles.hero} data-onboarding-id="dashboard-hero">
          <div className={styles.heroOverlay} />
          <div className={styles.heroTop}>
            <div className={styles.heroContent}>
              <h1 className={styles.heroTitle}>Mon Espace Investisseur</h1>
              <p className={styles.heroSubtitle}>Bienvenue, {displayName}</p>
              <div className={styles.roleBadge}>
                <CheckCircle2 size={16} />
                <span>
                  {auth.isEntrepriseVerified
                    ? "Entreprise confirmee"
                    : "Entreprise non confirmee"}
                </span>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button
                className={styles.primaryAction}
                data-onboarding-id="dashboard-new-request"
                onClick={() =>
                  navigate(
                    "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis"
                  )
                }
              >
                <Plus size={18} />
                Nouvelle demande
              </button>
              <button
                className={styles.ghostAction}
                onClick={() => navigate("/investisseur/demandes")}
              >
                <FileText size={17} />
                Mes Demandes
              </button>
              <button
                className={styles.ghostAction}
                onClick={() => navigate("/notification")}
              >
                <Bell size={17} />
                Notifications
              </button>
              <button
                className={styles.ghostAction}
                onClick={() => navigate("/carte/carte_public")}
              >
                <Map size={17} />
                Carte SIG
              </button>
            </div>
          </div>
        </section>

        <section className={styles.kpiStrip} data-onboarding-id="dashboard-status">
          <article className={`${styles.kpiCard} ${styles.kpiWarn}`}>
            <span className={`${styles.kpiIcon} ${styles.kpiIconWarn}`}>
              <AlertCircle size={18} />
            </span>
            <div className={styles.kpiText}>
              <p>Profil entreprise</p>
              <h3>{auth.isEntrepriseVerified ? "Confirme" : "A verifier"}</h3>
              <small>
                {auth.isEntrepriseVerified
                  ? "Dossier valide et actif"
                  : "Completer le dossier"}
              </small>
            </div>
          </article>

          <article className={`${styles.kpiCard} ${styles.kpiBlue}`}>
            <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}>
              <Clock3 size={18} />
            </span>
            <div className={styles.kpiText}>
              <p>Demandes en cours</p>
              <h3>{String(stats.demandesEnCours).padStart(2, "0")}</h3>
              <small>demande(s) en traitement</small>
            </div>
            <span className={styles.kpiTrend}>+18%</span>
          </article>

          <article className={`${styles.kpiCard} ${styles.kpiGold}`}>
            <span className={`${styles.kpiIcon} ${styles.kpiIconGold}`}>
              <ShieldCheck size={18} />
            </span>
            <div className={styles.kpiText}>
              <p>Permis actifs</p>
              <h3>{String(stats.permisActifs).padStart(2, "0")}</h3>
              <small>permis en exploitation</small>
            </div>
            <span className={styles.kpiTrend}>+{stats.permisActifs > 0 ? "1" : "0"}</span>
          </article>

          <article className={`${styles.kpiCard} ${styles.kpiViolet}`}>
            <span className={`${styles.kpiIcon} ${styles.kpiIconViolet}`}>
              <TrendingUp size={18} />
            </span>
            <div className={styles.kpiText}>
              <p>Activite globale</p>
              <h3>{activityRate}%</h3>
              <small>taux de conformite</small>
            </div>
            <span className={styles.kpiTrend}>stable</span>
          </article>
        </section>

        <section
          className={styles.quickAccessSection}
          data-onboarding-id="dashboard-quick-access"
        >
          <div className={styles.quickAccessHeader}>
            <div className={styles.quickAccessHeaderText}>
              <h2 className={styles.quickAccessTitle}>Acces rapide</h2>
              <p className={styles.quickAccessSubtitle}>
                Outils operationnels pour piloter vos demandes, permis et
                documents.
              </p>
            </div>
            <button
              className={styles.overviewButton}
              onClick={() => navigate("/investisseur/demandes")}
            >
              Tableau de bord complet
              <ArrowRight size={14} />
            </button>
          </div>

          <div className={styles.quickCardsGrid}>
            <button
              type="button"
              className={`${styles.quickAccessCard} ${styles.quickCardDemandes}`}
              data-onboarding-id="dashboard-card-demandes"
              onClick={() => navigate("/investisseur/demandes")}
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
                Mes Demandes
                <span className={styles.quickBadge}>
                  {stats.demandesEnCours > 0 ? "Actif" : "Pret"}
                </span>
              </h3>
              <p className={styles.quickCardDescription}>
                Soumettre, suivre et gerer vos demandes de permis miniers en
                temps reel.
              </p>
            </button>

            <button
              type="button"
              className={`${styles.quickAccessCard} ${styles.quickCardMap}`}
              onClick={() => navigate("/carte/carte_public")}
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
                Explorer les zones minieres, gisements et opportunites SIG du
                territoire.
              </p>
            </button>

            <button
              type="button"
              className={`${styles.quickAccessCard} ${styles.quickCardNotif}`}
              data-onboarding-id="dashboard-card-notifications"
              onClick={() => navigate("/notification")}
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
                Consulter vos alertes, messages officiels et mises a jour
                recentes.
              </p>
            </button>
          </div>
        </section>
      </main>
      <OnboardingTour
        isOpen={showOnboarding}
        steps={DASHBOARD_ONBOARDING_STEPS}
        onClose={handleCloseOnboarding}
        onComplete={handleCompleteOnboarding}
      />
    </div>
  );
}
