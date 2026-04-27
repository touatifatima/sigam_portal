import { useEffect, useMemo, useState, type CSSProperties } from "react";  // dashboard page is now at /cadastre/dashboard, this component is here to redirect old links to the new one
import { useLocation, useNavigate } from "react-router-dom"; //user cadastre dashboard 
import {
  ArrowRight,
  Map,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import { OnboardingWelcomeModal } from "@/components/onboarding/OnboardingWelcomeModal";
import verificationSectionImage from "@/src/assets/engineers.jpg";
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
    title: "Verification prealable",
    eyebrow: "Analyse cadastrale",
    description:
      "Acceder directement au module de verification cadastrale et de controle geometrique.",
    highlights: [
      "Projection et controle des coordonnees",
      "Detection des chevauchements avant depot",
      "Lecture immediate des couches de reference",
    ],
    cta: "Lancer la verification",
    route: "/investisseur/interactive",
    accent: "bordeaux",
    icon: Waypoints,
    visualImage: verificationSectionImage,
  },
  {
    title: "Carte publique",
    eyebrow: "Consultation cartographique",
    description:
      "Consulter la carte publique des permis et ouvrir les couches de reference depuis l'espace cadastre.",
    highlights: [
      "Visualisation des titres publics et zones ouvertes",
      "Lecture rapide du territoire avant instruction",
      "Acces direct aux vues de reference ANAM",
    ],
    cta: "Ouvrir la carte publique",
    route: "/carte/carte_public",
    accent: "teal",
    icon: Map,
    visualImage: publicMapSectionImage,
  },
];

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

  if (!isAuthReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <InvestorLayout>
      <main className={styles.page}>
        <section className={styles.hero} data-onboarding-id="cadastre-dashboard-hero">
          <div className={styles.heroContent}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Espace cadastre</span>
              <h1 className={styles.title}>Pilotage cadastral et verification miniere</h1>
              <p className={styles.subtitle}>
                Bonjour {displayName}. Cet espace centralise la verification
                prealable et la lecture cartographique pour controler rapidement
                les perimetres, les points et les couches de reference.
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
              </div>

              <div className={styles.heroStats}>
                <div className={styles.heroStatCard}>
                  <strong>2</strong>
                  <span>Modules metier</span>
                </div>
                <div className={styles.heroStatCard}>
                  <strong>Temps reel</strong>
                  <span>Controle geometrique</span>
                </div>
                <div className={styles.heroStatCard}>
                  <strong>EPSG 4326</strong>
                  <span>Reference active</span>
                </div>
              </div>
            </div>

            <aside className={styles.heroPanel}>
              <div className={styles.heroBadge}>
                <ShieldCheck size={18} />
                <span>Role cadastre</span>
              </div>
              <div className={styles.heroPanelCard}>
                <span className={styles.heroPanelEyebrow}>Perimetre</span>
                <h2>Verification et lecture cartographique</h2>
                <p>
                  Profil limite aux controles cadastraux, a l&apos;analyse des
                  couches et a la preparation technique avant instruction.
                </p>
                <div className={styles.heroPanelList}>
                  <span>Verification prealable</span>
                  <span>Carte publique</span>
                  <span>Lecture des references</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.noticePanel} data-onboarding-id="cadastre-dashboard-scope">
          <div>
            <h2 className={styles.noticeTitle}>Perimetre d&apos;acces</h2>
            <p className={styles.noticeText}>
              Ce profil n&apos;accede ni aux demandes investisseur ni aux permis
              operateur. Il est limite aux controles cadastraux.
            </p>
          </div>
          <div className={styles.noticeChips}>
            <span className={styles.noticeChip}>Verification prealable</span>
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
                      <strong>{tool.accent === "teal" ? "Territoire public" : "Controle topologique"}</strong>
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
