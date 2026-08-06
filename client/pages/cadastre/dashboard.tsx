import { useEffect, useMemo, useState, type CSSProperties, type ComponentType } from "react";  // dashboard page is now at /cadastre/dashboard, this component is here to redirect old links to the new one
import { useLocation, useNavigate } from "react-router-dom"; //user cadastre dashboard
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Clock3,
  FileCheck2,
  FilePlus2,
  Layers,
  Lock,
  Map,
  MapPin,
  Moon,
  MousePointerClick,
  PlayCircle,
  ScanSearch,
  ShieldCheck,
  Sun,
  Waypoints,
} from "lucide-react";
import { CadastreHeroMap } from "@/components/cadastre/CadastreHeroMap";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import { OnboardingWelcomeModal } from "@/components/onboarding/OnboardingWelcomeModal";
import { BrandLoader } from "@/components/loading/BrandLoader";
import verificationSectionImage from "@/src/assets/hero-mining.jpg";
import publicMapSectionImage from "@/src/assets/hero-slide-2.jpg";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import {
  getHasSeenOnboarding,
  getOnboardingActive,
  getOnboardingPageSeen,
  markOnboardingPageCompleted,
  resetOnboardingPages,
  setHasSeenOnboarding,
  setOnboardingActive,
  stopOnboardingForever,
} from "@/src/onboarding/storage";
import {
  getDefaultDashboardPath,
  isCadastreRole,
} from "@/src/utils/roleNavigation";
import styles from "./CadastreDashboard.module.css";

type CadastreTool = {
  title: string;
  eyebrow: string;
  description: string;
  highlights: string[];
  cta: string;
  route: string;
  accent: "bordeaux" | "teal";
  icon: typeof Map;
  visualImage: string;
};

const tools: CadastreTool[] = [
  {
    title: "Vérification préalable",
    eyebrow: "Analyse cadastrale",
    description:
      "Accéder directement au module de vérification cadastrale et de contrôle géométrique.",
    highlights: [
      "Projection et contrôle des coordonnées",
      "Détection des chevauchements avant dépôt",
      "Lecture immédiate des couches de référence",
    ],
    cta: "Lancer la vérification",
    route: "/investisseur/interactive",
    accent: "bordeaux",
    icon: Waypoints,
    visualImage: verificationSectionImage,
  },
  {
    title: "Carte publique",
    eyebrow: "Consultation cartographique",
    description:
      "Consulter la carte publique des permis et ouvrir les couches de référence depuis l’espace cadastre.",
    highlights: [
      "Visualisation des titres publics et zones ouvertes",
      "Lecture rapide du territoire avant instruction",
      "Accès direct aux vues de référence ANAM",
    ],
    cta: "Ouvrir la carte publique",
    route: "/carte/carte_public",
    accent: "teal",
    icon: Map,
    visualImage: publicMapSectionImage,
  },
];

type CadastreStep = {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
};

const steps: CadastreStep[] = [
  {
    title: "Choisissez votre outil",
    description: "Vérification préalable ou carte publique, selon votre besoin du moment.",
    icon: MousePointerClick,
  },
  {
    title: "Définissez le périmètre",
    description: "Saisissez ou importez les coordonnées de référence à contrôler.",
    icon: MapPin,
  },
  {
    title: "Lancez le controle",
    description: "Détection des chevauchements et lecture des couches en temps réel.",
    icon: ScanSearch,
  },
  {
    title: "Consultez le résultat",
    description: "Exploitez la synthèse et poursuivez sur la carte interactive.",
    icon: FileCheck2,
  },
];

type CadastreTheme = "light" | "dark";

const CADASTRE_THEME_STORAGE_KEY = "cadastre-dashboard-theme";
const CADASTRE_DOCUMENT_REQUEST_ROUTE = "/cadastre/demandedocumentcadastrale";

const getStoredTheme = (): CadastreTheme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(CADASTRE_THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
};

const CADASTRE_DASHBOARD_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "cadastre-dashboard-hero",
    target: '[data-onboarding-id="cadastre-dashboard-hero"]',
    title: "Tableau de bord cadastre",
    description:
      "Ce panneau centralise l'acces rapide aux outils de verification cadastrale et de consultation cartographique.",
    placement: "bottom",
  },
  {
    id: "cadastre-dashboard-scope",
    target: '[data-onboarding-id="cadastre-dashboard-scope"]',
    title: "Perimetre du role",
    description:
      "Ce profil reste volontairement limite a la verification prealable et a la carte publique, sans acces aux demandes ni aux permis.",
    placement: "bottom",
  },
  {
    id: "cadastre-dashboard-verification",
    target: '[data-onboarding-id="cadastre-dashboard-verification"]',
    title: "Verification prealable",
    description:
      "Accedez ici au module cadastral prioritaire pour controler les points, perimetres et chevauchements.",
    placement: "right",
  },
  {
    id: "cadastre-dashboard-map",
    target: '[data-onboarding-id="cadastre-dashboard-map"]',
    title: "Carte publique",
    description:
      "Cette entree ouvre la carte publique pour consulter les couches de reference et les titres publies.",
    placement: "left",
  },
];

export default function CadastreDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setTheme] = useState<CadastreTheme>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const toggleTheme = (next: CadastreTheme) => {
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CADASTRE_THEME_STORAGE_KEY, next);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;

    if (!auth?.id && !auth?.email && !auth?.username) {
      navigate("/", { replace: true });
      return;
    }

    if (!isCadastreRole(auth?.role)) {
      navigate(getDefaultDashboardPath(auth?.role), { replace: true });
    }
  }, [auth?.email, auth?.id, auth?.role, auth?.username, isAuthReady, navigate]);

  const displayName = useMemo(
    () => auth?.username || auth?.email || "Utilisateur cadastre",
    [auth?.email, auth?.username],
  );
  const verificationTool = tools[0];
  const publicMapTool = tools[1];

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthReady || !isCadastreRole(auth?.role)) return;
    if (getHasSeenOnboarding()) return;

    const params = new URLSearchParams(location.search);
    const shouldStartFromQuery = params.get("onboarding") === "1";
    const active = getOnboardingActive() || shouldStartFromQuery;
    const alreadySeenDashboard = getOnboardingPageSeen("cadastre-dashboard");

    if (shouldStartFromQuery) {
      setOnboardingActive(true);
    }

    if (active && !alreadySeenDashboard) {
      setShowOnboarding(true);
      setShowOnboardingPrompt(false);
      return;
    }

    if (!alreadySeenDashboard) {
      setShowOnboardingPrompt(true);
    }
  }, [auth?.role, isAuthReady, location.search]);

  const handleStartOnboarding = () => {
    resetOnboardingPages();
    setHasSeenOnboarding(false);
    setOnboardingActive(true);
    setShowOnboardingPrompt(false);
    setShowOnboarding(true);
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    setShowOnboardingPrompt(false);
    stopOnboardingForever();
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingPageCompleted("cadastre-dashboard");
  };

  const handleSkipOnboarding = () => {
    setShowOnboardingPrompt(false);
    stopOnboardingForever();
  };

  const quickLinks = [
    {
      title: verificationTool.title,
      description: "Contrôle géométrique",
      icon: Waypoints,
      onClick: () => navigate(verificationTool.route),
    },
    {
      title: publicMapTool.title,
      description: "Couches et titres publics",
      icon: Map,
      onClick: () => navigate(publicMapTool.route),
    },
    {
      title: "Demande de documents",
      description: "Extrait et plan cadastral",
      icon: FilePlus2,
      onClick: () => navigate(CADASTRE_DOCUMENT_REQUEST_ROUTE),
    },
    {
      title: "Visite guidée",
      description: "Revoir la présentation",
      icon: PlayCircle,
      onClick: handleStartOnboarding,
    },
    {
      title: "Notifications",
      description: "Suivre vos alertes",
      icon: Bell,
      onClick: () => navigate("/notification"),
    },
  ];

  if (!isAuthReady) {
    return <BrandLoader fullScreen label="Chargement de l'espace cadastre..." />;
  }

  return (
    <InvestorLayout>
      <main className={styles.page} data-theme={theme}>
        <div className={styles.controlsBar}>
          <span className={styles.controlsLabel}>
            <Layers size={14} />
            Espace cadastre
          </span>
          <div className={styles.themeToggle} role="group" aria-label="Choix du theme">
            <button
              type="button"
              className={`${styles.themeToggleOption} ${theme === "light" ? styles.themeToggleOptionActive : ""}`}
              aria-pressed={theme === "light"}
              onClick={() => toggleTheme("light")}
            >
              <Sun size={15} />
              Clair
            </button>
            <button
              type="button"
              className={`${styles.themeToggleOption} ${theme === "dark" ? styles.themeToggleOptionActive : ""}`}
              aria-pressed={theme === "dark"}
              onClick={() => toggleTheme("dark")}
            >
              <Moon size={15} />
              Sombre
            </button>
          </div>
        </div>

        <section className={styles.hero} data-onboarding-id="cadastre-dashboard-hero">
          <div className={styles.heroContent}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>
                <ShieldCheck size={14} />
                Espace cadastre officiel
              </span>
              <h1 className={styles.title}>
                Pilotage cadastral et <span className={styles.titleAccent}>vérification minière</span>
              </h1>
              <p className={styles.subtitle}>
                Bonjour {displayName}. Cet espace centralise la vérification
                préalable et la lecture cartographique pour contrôler rapidement
                les périmètres, les points et les couches de référence.
              </p>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={`${styles.heroButton} ${styles.heroButtonPrimary}`}
                  onClick={() => navigate(verificationTool.route)}
                >
                  {verificationTool.cta}
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className={`${styles.heroButton} ${styles.heroButtonSecondary}`}
                  onClick={() => navigate(publicMapTool.route)}
                >
                  {publicMapTool.cta}
                </button>
                <button
                  type="button"
                  className={`${styles.heroButton} ${styles.heroButtonSecondary}`}
                  onClick={() => navigate(CADASTRE_DOCUMENT_REQUEST_ROUTE)}
                >
                  Nouvelle demande de documents
                  <FilePlus2 size={18} />
                </button>
              </div>

              <div className={styles.trustRow}>
                <div className={styles.trustItem}>
                  <Lock size={18} />
                  <div>
                    <strong>Sécurisé</strong>
                    <span>Données protégées</span>
                  </div>
                </div>
                <div className={styles.trustItem}>
                  <BadgeCheck size={18} />
                  <div>
                    <strong>Officiel</strong>
                    <span>Références ANAM</span>
                  </div>
                </div>
                <div className={styles.trustItem}>
                  <Clock3 size={18} />
                  <div>
                    <strong>Continu</strong>
                    <span>Accès 24/7</span>
                  </div>
                </div>
              </div>
            </div>

            <aside className={styles.heroVisual}>
              <div className={styles.heroVisualCard}>
                <span className={styles.heroVisualBadge}>
                  <Waypoints size={16} />
                  Cadastre national
                </span>
                <CadastreHeroMap />
                <div className={`${styles.heroFloatCard} ${styles.heroFloatCardTop}`}>
                  <ScanSearch size={18} />
                  <div>
                    <strong>2</strong>
                    <span>Modules métier actifs</span>
                  </div>
                </div>
                <div className={`${styles.heroFloatCard} ${styles.heroFloatCardBottom}`}>
                  <Layers size={18} />
                  <div>
                    <strong>EPSG 4326</strong>
                  <span>Référence active</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.stepsSection}>
          <div className={styles.sectionHeading}>
            <h2>Comment ça marche ?</h2>
            <p>Quatre étapes pour vérifier un périmètre et consulter les références officielles.</p>
          </div>
          <div className={styles.stepsRow}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div className={styles.stepItem} key={step.title}>
                  <div className={styles.stepCard}>
                    <span className={styles.stepNumber}>{index + 1}</span>
                    <div className={styles.stepIcon}>
                      <Icon size={22} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className={styles.stepArrow} size={20} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.quickAccessSection}>
          <div className={styles.sectionHeading}>
            <h2>Accès rapide</h2>
            <p>Les raccourcis essentiels de votre espace cadastre.</p>
          </div>
          <div className={styles.quickGrid}>
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  type="button"
                  key={link.title}
                  className={styles.quickCard}
                  onClick={link.onClick}
                >
                  <span className={styles.quickCardIcon}>
                    <Icon size={20} />
                  </span>
                  <span className={styles.quickCardTitle}>{link.title}</span>
                  <span className={styles.quickCardDescription}>{link.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.noticePanel} data-onboarding-id="cadastre-dashboard-scope">
          <div>
            <h2 className={styles.noticeTitle}>Périmètre d&apos;accès</h2>
            <p className={styles.noticeText}>
              Ce profil n&apos;accède ni aux demandes investisseur ni aux permis
              opérateur. Il est limité aux contrôles cadastraux.
            </p>
          </div>
          <div className={styles.noticeChips}>
            <span className={styles.noticeChip}>Vérification préalable</span>
            <span className={styles.noticeChip}>Carte publique</span>
          </div>
        </section>

        <section className={styles.toolStack}>
          {tools.map((tool) => {
            const Icon = tool.icon;
            const toolVisualStyle = {
              "--tool-visual-image": `url(${tool.visualImage})`,
            } as CSSProperties;
            const onboardingId =
              tool.route === "/investisseur/interactive"
                ? "cadastre-dashboard-verification"
                : tool.route === "/carte/carte_public"
                ? "cadastre-dashboard-map"
                : undefined;
            return (
              <article
                key={tool.route}
                className={`${styles.toolSection} ${tool.accent === "teal" ? styles.toolSectionReverse : ""}`}
                data-onboarding-id={onboardingId}
              >
                <div className={styles.toolSectionCopy}>
                  <span className={styles.toolEyebrow}>{tool.eyebrow}</span>
                  <h2 className={styles.toolTitle}>{tool.title}</h2>
                  <p className={styles.toolDescription}>{tool.description}</p>
                  <div className={styles.toolHighlightList}>
                    {tool.highlights.map((item) => (
                      <span key={item} className={styles.toolHighlight}>
                        {item}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.toolButton}
                    onClick={() => navigate(tool.route)}
                  >
                    {tool.cta}
                    <ArrowRight size={18} />
                  </button>
                </div>

                <div
                  className={`${styles.toolVisual} ${
                    tool.accent === "teal" ? styles.toolVisualTeal : styles.toolVisualBordeaux
                  }`}
                  style={toolVisualStyle}
                  aria-hidden="true"
                >
                  <div className={styles.toolVisualIcon}>
                    <Icon size={38} />
                  </div>
                  <div className={styles.toolVisualContent}>
                    <div className={styles.toolVisualHeadline}>
                      <span>{tool.accent === "teal" ? "Lecture" : "Analyse"}</span>
                      <strong>{tool.accent === "teal" ? "Territoire public" : "Contrôle topologique"}</strong>
                    </div>
                    <div className={styles.toolVisualRows}>
                      {tool.highlights.map((item) => (
                        <div key={item} className={styles.toolVisualRow}>
                          <span className={styles.toolVisualDot} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className={styles.ctaBanner}>
          <div className={styles.ctaCopy}>
            <h2>Prêt à contrôler votre périmètre ?</h2>
            <p>Lancez la vérification cadastrale ou explorez la carte publique en un instant.</p>
          </div>
          <div className={styles.ctaSteps}>
            <div className={styles.ctaStep}>
              <MousePointerClick size={18} />
              <span>Choisissez</span>
            </div>
            <ArrowRight size={16} className={styles.ctaStepArrow} aria-hidden="true" />
            <div className={styles.ctaStep}>
              <ScanSearch size={18} />
              <span>Vérifiez</span>
            </div>
            <ArrowRight size={16} className={styles.ctaStepArrow} aria-hidden="true" />
            <div className={styles.ctaStep}>
              <Map size={18} />
              <span>Consultez</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.ctaButton}
            onClick={() => navigate(CADASTRE_DOCUMENT_REQUEST_ROUTE)}
          >
            Nouvelle demande de documents
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <OnboardingWelcomeModal
        isOpen={showOnboardingPrompt}
        onStart={handleStartOnboarding}
        onSkip={handleSkipOnboarding}
      />
      <OnboardingTour
        isOpen={showOnboarding}
        steps={CADASTRE_DASHBOARD_ONBOARDING_STEPS}
        onClose={handleCloseOnboarding}
        onComplete={handleCompleteOnboarding}
      />
    </InvestorLayout>
  );
}
