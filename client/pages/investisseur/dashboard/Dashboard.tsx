import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Headphones,
  HelpCircle,
  Home,
  Map,
  Plus,
  Search,
  ShieldCheck,
  User,
  WalletCards,
} from "lucide-react";
import Navbar from "@/pages/navbar/Navbar";
import styles from "./Dashboard.module.css";
import algerieMapUrl from "@/src/assets/algerie.png";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { getDefaultDashboardPath, isCadastreRole } from "@/src/utils/roleNavigation";
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

type NavItem = {
  label: string;
  icon: typeof Home;
  href: string;
};

type HeroFeature = {
  title: string;
  description: string;
  icon: typeof Building2;
};

type StatCard = {
  label: string;
  value: string;
  hint: string;
  icon: typeof FileText;
  tone: "blue" | "gold" | "violet" | "green" | "red";
};

type RequestItem = {
  title: string;
  ref: string;
  status: string;
  progress: number;
  tone: "blue" | "amber" | "red";
  updated: string;
};

type ProcessStep = {
  label: string;
  date: string;
  state: "done" | "active" | "pending";
  icon: typeof CheckCircle2;
};

type PaymentItem = {
  code: string;
  label: string;
  amount: string;
  status: string;
  date: string;
};

type QuickLink = {
  label: string;
  icon: typeof FileText;
  href: string;
  tone: "blue" | "green" | "gold" | "violet" | "red";
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

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/investisseur/InvestorDashboard" },
  { label: "Mes demandes", icon: FileText, href: "/investisseur/demandes" },
  { label: "Paiements", icon: CreditCard, href: "/investisseur/statistiques" },
  { label: "Carte minière", icon: Map, href: "/carte/carte_public" },
  { label: "Documents", icon: FileText, href: "/documentation" },
  { label: "Aide & Support", icon: HelpCircle, href: "/faq" },
];

const HERO_FEATURES: HeroFeature[] = [
  {
    title: "100% en ligne",
    description: "Sans déplacement",
    icon: Building2,
  },
  {
    title: "Sécurisé",
    description: "Données protégées",
    icon: ShieldCheck,
  },
  {
    title: "Paiements sécurisés",
    description: "Via SATIM",
    icon: CreditCard,
  },
];

const REQUEST_ITEMS: RequestItem[] = [
  {
    title: "Autorisation de prospection",
    ref: "MIN-2025-00124",
    status: "En instruction",
    progress: 65,
    tone: "blue",
    updated: "Il y a 2 jours",
  },
  {
    title: "Permis d'exploitation",
    ref: "MIN-2025-00123",
    status: "Analyse technique",
    progress: 40,
    tone: "amber",
    updated: "Il y a 3 jours",
  },
  {
    title: "Permis de recherche",
    ref: "MIN-2025-00122",
    status: "Paiement requis",
    progress: 90,
    tone: "red",
    updated: "Il y a 5 jours",
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  { label: "Soumise", date: "12/05/2025", state: "done", icon: CheckCircle2 },
  { label: "Reçue", date: "13/05/2025", state: "done", icon: CheckCircle2 },
  { label: "En instruction", date: "16/05/2025", state: "active", icon: Clock3 },
  { label: "Validation", date: "En attente", state: "pending", icon: CheckCircle2 },
  { label: "Paiement", date: "En attente", state: "pending", icon: CheckCircle2 },
  { label: "Délivrée", date: "En attente", state: "pending", icon: CheckCircle2 },
];

const PAYMENTS: PaymentItem[] = [
  {
    code: "MIN-2025-00120",
    label: "Permis d'exploitation",
    amount: "450 000 DZD",
    status: "Payé",
    date: "12/05/2025",
  },
  {
    code: "MIN-2025-00118",
    label: "Autorisation de prospection",
    amount: "75 000 DZD",
    status: "Payé",
    date: "05/05/2025",
  },
];

const QUICK_LINKS: QuickLink[] = [
  { label: "Nouvelle demande", icon: Plus, href: "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis", tone: "blue" },
  { label: "Mes demandes", icon: FileText, href: "/investisseur/demandes", tone: "green" },
  { label: "Paiements", icon: CreditCard, href: "/investisseur/statistiques", tone: "gold" },
  { label: "Carte minière", icon: Map, href: "/carte/carte_public", tone: "violet" },
  { label: "Documents", icon: FileText, href: "/documentation", tone: "red" },
  { label: "Modèles & Guides", icon: FileText, href: "/documentation", tone: "blue" },
  { label: "Législation", icon: FileText, href: "/documentation", tone: "gold" },
  { label: "FAQ", icon: HelpCircle, href: "/faq", tone: "violet" },
];

const HERO_STATS: StatCard[] = [
  {
    label: "Demandes en cours",
    value: "17",
    hint: "+18% ce mois",
    icon: FileText,
    tone: "blue",
  },
  {
    label: "Permis actifs",
    value: "08",
    hint: "+1 ce mois",
    icon: ShieldCheck,
    tone: "gold",
  },
  {
    label: "En instruction",
    value: "06",
    hint: "-2 ce mois",
    icon: Map,
    tone: "violet",
  },
  {
    label: "Demandes approuvées",
    value: "24",
    hint: "+5 ce mois",
    icon: CheckCircle2,
    tone: "green",
  },
  {
    label: "Paiements en attente",
    value: "2",
    hint: "125 000 DZD",
    icon: WalletCards,
    tone: "red",
  },
  {
    label: "Total payé (2025)",
    value: "3 250 000 DZD",
    hint: "+22% vs 2024",
    icon: CreditCard,
    tone: "blue",
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
        const demandesResult = await axios.get(`${apiURL}/demandes/mes-demandes`, {
          withCredentials: true,
        });
        const demandes = toList<unknown>(demandesResult.data);

        if (!isActive) return;
        setStats({
          demandesEnCours: demandes.length,
          permisActifs: 0,
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

  const companyName = useMemo(
    () => auth?.username || auth?.nom || auth?.email || "Société Minière SARL",
    [auth?.email, auth?.nom, auth?.username],
  );

  const companyInitials = useMemo(() => {
    const parts = companyName.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0] ?? "").join("");
    return initials ? initials.toUpperCase() : "SM";
  }, [companyName]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    stopOnboardingForever();
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingPageCompleted("investor-dashboard");
  };

  const handleNavigate = (href: string) => {
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(href);
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
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.brand} type="button" onClick={() => navigate("/investisseur/InvestorDashboard")}>
            <span className={styles.brandMark}>
              <img src="/anamlogo.png" alt="ANAM" className={styles.brandLogo} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandKicker}>République Algérienne</span>
              <span className={styles.brandTitle}>Ministère des Mines</span>
            </span>
          </button>

          <nav className={styles.topNav} aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/investisseur/InvestorDashboard"
                  ? location.pathname === "/investisseur/InvestorDashboard"
                  : item.href !== "#support" && location.pathname.startsWith(item.href);

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.topNavItem} ${isActive ? styles.topNavItemActive : ""}`}
                  onClick={() => handleNavigate(item.href)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.notificationButton}
              data-onboarding-id="dashboard-card-notifications"
              onClick={() => navigate("/notification")}
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className={styles.notificationBadge}>5</span>
            </button>

            <button
              type="button"
              className={styles.userCard}
              onClick={() => navigate("/investisseur/profil")}
            >
              <span className={styles.userAvatar}>
                <img src="/anamlogo.png" alt="" className={styles.userAvatarImage} />
                <span className={styles.userAvatarFallback} aria-hidden="true">
                  {companyInitials}
                </span>
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{companyName}</span>
                <span className={styles.userRole}>Entreprise vérifiée</span>
              </span>
              <ChevronDown size={16} className={styles.userChevron} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} data-onboarding-id="dashboard-hero">
          <div className={styles.heroBackdrop} />
          <div className={styles.heroOverlay} />

          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <p className={styles.heroEyebrow}>GUICHET UNIQUE MINIER</p>
              <h1 className={styles.heroTitle}>
                Toutes vos <em>démarches</em>
                <br />
                minières, <em>en un seul</em>
                <br />
                <em>endroit.</em>
              </h1>
              <p className={styles.heroLead}>
                Simplifiez, suivez et gérez l&apos;ensemble de vos demandes et permis
                miniers en toute transparence.
              </p>

              <div className={styles.heroFeatures}>
                {HERO_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title} className={styles.heroFeature}>
                      <span className={styles.heroFeatureIcon}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{feature.title}</strong>
                        <span>{feature.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  data-onboarding-id="dashboard-new-request"
                  onClick={() => navigate("/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis")}
                >
                  <Plus size={18} />
                  <span>Nouvelle demande</span>
                </button>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() => navigate("/investisseur/demandes")}
                >
                  <FileText size={17} />
                  <span>Voir mes demandes</span>
                </button>
              </div>
            </div>

            <aside className={styles.heroPanel}>
              <div className={styles.heroPanelHeader}>
                <h2>Mon entreprise</h2>
                <span className={auth?.isEntrepriseVerified ? styles.statusVerified : styles.statusPending}>
                  {auth?.isEntrepriseVerified ? "✓ Vérifiée" : "En attente"}
                </span>
              </div>

              <div className={styles.heroPanelCompanyRow}>
                <div className={styles.heroPanelAvatar}>{companyInitials}</div>
                <div className={styles.heroPanelBody}>
                  <p className={styles.heroPanelCompany}>{companyName}</p>
                  <p className={styles.heroPanelMeta}>NIF : 123456789012345</p>
                  <p className={styles.heroPanelMeta}>Statut : <span className={styles.heroPanelActive}>Actif</span></p>
                </div>
              </div>

              <div className={styles.heroPanelStats}>
                <div className={styles.heroPanelStat}>
                  <strong>{stats.demandesEnCours || 17}</strong>
                  <span>Demandes</span>
                </div>
                <div className={styles.heroPanelStatDivider} />
                <div className={styles.heroPanelStat}>
                  <strong>08</strong>
                  <span>Permis actifs</span>
                </div>
                <div className={styles.heroPanelStatDivider} />
                <div className={styles.heroPanelStat}>
                  <strong>24</strong>
                  <span>Approuvées</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.heroPanelAction}
                onClick={() => navigate("/investisseur/profil")}
              >
                <User size={15} />
                <span>Voir mon profil</span>
              </button>
            </aside>
          </div>
        </section>

        {/* ── Barre de raccourcis rapides ── */}
        <div className={styles.quickBar}>
          {QUICK_LINKS
            .filter(item => item.label !== "Paiements" && item.label !== "Mes demandes")
            .map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.quickBarBtn} ${styles[`quickTone_${item.tone}`]}`}
                  onClick={() => handleNavigate(item.href)}
                >
                  <span className={styles.quickBarIcon}><Icon size={18} /></span>
                  <span className={styles.quickBarLabel}>{item.label}</span>
                </button>
              );
            })
          }
        </div>

        <section className={styles.statsGrid} data-onboarding-id="dashboard-status">
          {HERO_STATS.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className={styles.statCard} style={{ animationDelay: `${index * 0.05}s` }}>
                <div className={`${styles.statIcon} ${styles[`statTone_${item.tone}`]}`}>
                  <Icon size={18} />
                </div>
                <div className={styles.statBody}>
                  <p className={styles.statLabel}>{item.label}</p>
                  <p className={styles.statValue}>{item.value}</p>
                  <p className={styles.statHint}>{item.hint}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className={styles.contentGrid}>
          <section className={`${styles.card} ${styles.requestsCard}`} data-onboarding-id="dashboard-card-demandes">
            <div className={styles.cardHeader}>
              <h2>Mes demandes récentes</h2>
              <button type="button" className={styles.cardLinkButton} onClick={() => navigate("/investisseur/demandes")}>
                Voir tout
              </button>
            </div>

            <div className={styles.requestList}>
              {REQUEST_ITEMS.map((request) => (
                <article key={request.ref} className={styles.requestRow}>
                  <div className={`${styles.requestIcon} ${styles[`requestTone_${request.tone}`]}`}>
                    <FileText size={18} />
                  </div>

                  <div className={styles.requestBody}>
                    <div className={styles.requestTopLine}>
                      <div>
                        <h3>{request.title}</h3>
                        <p>Réf : {request.ref}</p>
                      </div>
                      <span className={`${styles.requestStatus} ${styles[`requestStatus_${request.tone}`]}`}>
                        {request.status}
                      </span>
                    </div>

                    <div className={styles.progressRow}>
                      <div className={styles.progressTrack}>
                        <div className={`${styles.progressFill} ${styles[`progressFill_${request.tone}`]}`} style={{ width: `${request.progress}%` }} />
                      </div>
                      <span>{request.progress}%</span>
                    </div>

                    <div className={styles.requestFoot}>
                      <span className={styles.requestFootHint}>Mis à jour : {request.updated}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Suivi d&apos;une demande</h2>
            </div>

            <p className={styles.sectionLead}>Entrez le numéro de référence pour suivre l&apos;avancement</p>

            <div className={styles.trackRow}>
              <label className={styles.trackField}>
                <Search size={18} />
                <input type="text" placeholder="Ex : MIN-2025-00124" aria-label="Numéro de référence" />
              </label>
              <button type="button" className={styles.trackButton}>
                Suivre
              </button>
            </div>

            <div className={styles.stepsBlock}>
              <p className={styles.stepsTitle}>Étapes du processus</p>
              <div className={styles.stepsGrid}>
                {PROCESS_STEPS.map((step) => {
                  const Icon = step.icon;
                  const stepClass =
                    step.state === "done"
                      ? styles.stepDone
                      : step.state === "active"
                        ? styles.stepActive
                        : styles.stepPending;

                  return (
                    <div key={step.label} className={styles.stepItem}>
                      <div className={`${styles.stepDot} ${stepClass}`}>
                        <Icon size={15} />
                      </div>
                      <strong>{step.label}</strong>
                      <span>{step.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

        </section>

        <section className={styles.contentGridSecondary} data-onboarding-id="dashboard-quick-access">
          <section className={`${styles.card} ${styles.mapCard}`}>
            {/* Orbes décoratifs */}
            <div className={styles.mapOrb1} aria-hidden="true" />
            <div className={styles.mapOrb2} aria-hidden="true" />

            <div className={styles.mapLeft}>
              <div className={styles.mapCopy}>
                <span className={styles.mapBadge}>
                  <Map size={12} />
                  Géologie &amp; Ressources
                </span>
                <h2 className={styles.mapTitle}>Carte minière<br />interactive</h2>
                <p className={styles.mapDesc}>Explorez les zones minières, gisements et titres miniers actifs sur le territoire algérien.</p>

                <div className={styles.mapMiniStats}>
                  <div className={styles.mapMiniStat}>
                    <strong>127</strong>
                    <span>Concessions</span>
                  </div>
                  <div className={styles.mapMiniStatDiv} />
                  <div className={styles.mapMiniStat}>
                    <strong>48</strong>
                    <span>Zones actives</span>
                  </div>
                  <div className={styles.mapMiniStatDiv} />
                  <div className={styles.mapMiniStat}>
                    <strong>09</strong>
                    <span>Wilayas</span>
                  </div>
                </div>

                <button type="button" className={styles.mapButton} onClick={() => navigate("/carte/carte_public")}>
                  <span>Ouvrir la carte</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              <div className={styles.mapLegend}>
                <p className={styles.mapLegendTitle}>Légende</p>
                <div className={styles.mapLegendGrid}>
                  <span className={styles.legendPill}><i className={styles.legendDotOrange} />Gisements</span>
                  <span className={styles.legendPill}><i className={styles.legendDotGreen} />Zones ouvertes</span>
                  <span className={styles.legendPill}><i className={styles.legendDotRed} />Zones réservées</span>
                  <span className={styles.legendPill}><i className={styles.legendDotBlue} />Mes permis</span>
                  <span className={styles.legendPill}><i className={styles.legendDotViolet} />Mes demandes</span>
                </div>
              </div>
            </div>

            <div className={styles.mapVisual}>
              <iframe
                src="https://sig.anam.dz/portal/apps/experiencebuilder/experience?id=fc56f54b45264df2a5f4e07fd2462664"
                className={styles.mapIframe}
                title="Carte minière interactive"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </section>

          <section className={`${styles.card} ${styles.paymentCard}`}>
            <div className={styles.cardHeader}>
              <h2>Paiements</h2>
              <button type="button" className={styles.cardLinkButton} onClick={() => navigate("/investisseur/statistiques")}>
                Voir tout
              </button>
            </div>

            <div className={styles.paymentHighlight}>
              <div>
                <p>Montant à régler</p>
                <strong>125 000 DZD</strong>
                <span>2 paiement(s) en attente</span>
              </div>
              <button type="button" className={styles.payButton}>
                <LockIcon />
                <span>Payer maintenant</span>
              </button>
            </div>

            <div className={styles.paymentList}>
              <p className={styles.paymentSectionTitle}>Derniers paiements</p>
              {PAYMENTS.map((payment) => (
                <article key={payment.code} className={styles.paymentRow}>
                  <div className={styles.paymentInfo}>
                    <strong>{payment.code}</strong>
                    <span>{payment.label}</span>
                  </div>
                  <div className={styles.paymentMeta}>
                    <strong>{payment.amount}</strong>
                    <span className={styles.paymentPaid}>{payment.status}</span>
                    <span>{payment.date}</span>
                  </div>
                  <button type="button" className={styles.downloadButton} aria-label={`Télécharger le reçu ${payment.code}`}>
                    <Download size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className={styles.footerGrid}>
          <section className={styles.newsletterCard}>
            <div>
              <h2>Restez informé</h2>
              <p>Recevez les dernières actualités et mises à jour du secteur minier.</p>
            </div>
            <form className={styles.newsletterForm}>
              <input type="email" placeholder="Votre adresse email" aria-label="Adresse email" />
              <button type="button">S&apos;abonner</button>
            </form>
          </section>

          <section className={styles.supportCard} id="support">
            <div className={styles.supportCopy}>
              <div className={styles.supportBadge}>
                <Headphones size={17} />
              </div>
              <div>
                <h2>Besoin d&apos;aide ?</h2>
                <p>Notre équipe est à votre disposition</p>
              </div>
            </div>

            <div className={styles.supportActions}>
              <button type="button" className={styles.supportButton} onClick={() => navigate("/contact")}>
                Contacter le support
              </button>
              <button type="button" className={styles.supportIconButton} onClick={() => navigate("/faq")}>
                <HelpCircle size={18} />
              </button>
            </div>
          </section>
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

function AlgeriaMapIllustration() {
  return (
    <div className={styles.mapStage} aria-hidden="true">
      <img className={styles.mapImage} src={algerieMapUrl} alt="" aria-hidden="true" />
    </div>
  );
}

function LockIcon() {
  return (
    <span className={styles.lockIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M7 10V8.2C7 5.32 9.24 3 12 3C14.76 3 17 5.32 17 8.2V10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect
          x="5"
          y="10"
          width="14"
          height="10"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}
