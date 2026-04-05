import { JSX, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  Gem,
  BarChart3,
  Map,
  Bell,
  Plus,
  CheckCircle2,
  Clock,
  ShieldCheck,
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

type CardConfig = {
  title: string;
  description: string;
  route: string;
  tone: "rose" | "blue" | "green" | "amber" | "violet" | "mint";
  icon: JSX.Element;
};

const cards: CardConfig[] = [
  {
    title: "Mes Entreprises",
    description: "Gerer vos entreprises, actionnaires et informations legales",
    route: "/investisseur/entreprises",
    tone: "rose",
    icon: <Building2 size={26} />,
  },
  {
    title: "Mes Demandes",
    description: "Soumettre et suivre vos demandes de permis miniers",
    route: "/investisseur/demandes",
    tone: "blue",
    icon: <FileText size={26} />,
  },
  {
    title: "Mes Permis",
    description: "Consulter vos permis delivres et leur validite",
    route: "/operateur/permisdashboard/mes-permis",
    tone: "green",
    icon: <Gem size={26} />,
  },
  {
    title: "Statistiques",
    description: "Consulter les statistiques de vos activites",
    route: "/investisseur/statistiques",
    tone: "amber",
    icon: <BarChart3 size={26} />,
  },
  {
    title: "Carte Miniere",
    description: "Explorer les zones minières et opportunités d'investissement",
    route: "/carte/carte_public",
    tone: "mint",
    icon: <Map size={26} />,
  },
  {
    title: "Notifications",
    description: "Consulter vos notifications et messages importants",
    route: "/notification",
    tone: "violet",
    icon: <Bell size={26} />,
  },
];

const DASHBOARD_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "dashboard-hero",
    target: '[data-onboarding-id="dashboard-hero"]',
    title: "Votre espace personnel",
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
    id: "dashboard-permis",
    target: '[data-onboarding-id="dashboard-card-permis"]',
    title: "Permis actifs",
    description:
      "Consultez vos permis valides, leur avancement et les details utiles en un clic.",
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

  const displayRoles = useMemo(() => {
    const roleMap: Record<string, string> = {
      investor: "Investisseur",
      investisseur: "Investisseur",
      admin: "Administrateur",
      operateur: "Operateur",
      operator: "Operateur",
      cadastre: "Cadastre",
    };
    const rawRoles = Array.isArray(auth?.role)
      ? auth?.role
      : auth?.role
      ? String(auth?.role).split(",")
      : [];
    const labels = rawRoles
      .map((role) => roleMap[role.trim().toLowerCase()] || role.trim())
      .filter(Boolean);
    return labels.length ? labels.join(" / ") : "Investisseur";
  }, [auth?.role]);

  const getCardOnboardingId = (title: string): string | undefined => {
    if (title === "Mes Demandes") return "dashboard-card-demandes";
    if (title === "Mes Permis") return "dashboard-card-permis";
    if (title === "Notifications") return "dashboard-card-notifications";
    return undefined;
  };

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
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>Bienvenue, {displayName}</h1>
            <p className={styles.heroSubtitle}>
              Gerez vos activites minieres depuis votre espace personnel
            </p>
            <div className={styles.roleBadge}>
              <ShieldCheck size={16} />
              <span>{displayRoles}</span>
            </div>
          </div>
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
            Nouvelle Demande
          </button>
        </section>

        <section className={styles.statusRow} data-onboarding-id="dashboard-status">
          <div className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${styles.statusSuccess}`}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className={styles.statusLabel}>Profil entreprise</div>
              <div className={styles.statusValue}>
                {auth.isEntrepriseVerified ? "Confirmé" : "Non confirmé"}
              </div>
            </div>
          </div>
          <div className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${styles.statusInfo}`}>
              <Clock size={18} />
            </div>
            <div>
              <div className={styles.statusLabel}>Demandes en cours</div>
              <div className={styles.statusValue}>
                {stats.demandesEnCours} demande(s)
              </div>
            </div>
          </div>
          <div className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${styles.statusSuccess}`}>
              <Gem size={18} />
            </div>
            <div>
              <div className={styles.statusLabel}>Permis actifs</div>
              <div className={styles.statusValue}>
                {stats.permisActifs} permis
              </div>
            </div>
          </div>
        </section>

        <section className={styles.quickAccess} data-onboarding-id="dashboard-quick-access">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Acces rapide</h2>
            <p className={styles.sectionSubtitle}>
              Outils operationnels pour piloter vos demandes, permis et documents.
            </p>
          </div>
          <div className={styles.cardsGrid} data-onboarding-id="dashboard-cards">
            {cards.map((card, index) => {
              const tourId = getCardOnboardingId(card.title);
              return (
              <div
                key={card.title}
                className={styles.quickCard}
                data-tone={card.tone}
                data-onboarding-id={tourId}
                style={{ animationDelay: `${0.08 * index}s` }}
              >
                <div className={styles.cardIcon}>{card.icon}</div>
                <div className={styles.cardContent}>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <button
                  className={styles.cardButton}
                  onClick={() => navigate(card.route)}
                >
                  {card.title === "Statistiques"
                    ? "Acceder"
                    : "Acceder"}
                  <ArrowRight size={16} />
                </button>
              </div>
              );
            })}
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
