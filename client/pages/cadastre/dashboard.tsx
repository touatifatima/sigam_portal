import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, Building2, Clock3, Download,
  FileCheck2, FilePlus2, FileText, Map,
  Megaphone, MousePointerClick, ShieldCheck, Sparkles,
  Users, Waypoints, Zap,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { BrandLoader } from "@/components/loading/BrandLoader";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import { OnboardingWelcomeModal } from "@/components/onboarding/OnboardingWelcomeModal";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { useAuthStore } from "@/src/store/useAuthStore";
import { getDefaultDashboardPath, isCadastreRole } from "@/src/utils/roleNavigation";
import { fetchPublishedActualites } from "@/src/utils/actualitesApi";
import { getDefaultActualites, type ActualiteItem } from "@/src/utils/actualitesStorage";
import {
  getHasSeenOnboarding, getOnboardingActive, getOnboardingPageSeen,
  markOnboardingPageCompleted, resetOnboardingPages, setHasSeenOnboarding,
  setOnboardingActive, stopOnboardingForever,
} from "@/src/onboarding/storage";
import heroImage from "@/src/assets/cadastre-dashboard-map.png";
import mapImage from "@/src/assets/cadastre-dashboard-hero.png";
import styles from "./CadastreDashboard.module.css";

const DOCUMENT_REQUEST_ROUTE = "/cadastre/demandedocumentcadastrale";
const DOCUMENTS_ROUTE = "/cadastre/documents-cadastraux";

type DocumentRequest = { id: number; statut?: string | null; documentsGeneres?: unknown[] };

const onboardingSteps: OnboardingStep[] = [
  { id: "cadastre-dashboard-hero", target: '[data-onboarding-id="cadastre-dashboard-hero"]', title: "Tableau de bord cadastre", description: "Retrouvez ici les services et accès principaux de votre espace cadastral.", placement: "bottom" },
  { id: "cadastre-dashboard-scope", target: '[data-onboarding-id="cadastre-dashboard-scope"]', title: "Accès rapides", description: "Lancez rapidement une vérification, une demande de document ou ouvrez la carte publique.", placement: "top" },
];

const formatNewsDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

export default function CadastreDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [news, setNews] = useState<ActualiteItem[]>([]);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const displayName = auth?.username || auth?.email || "Utilisateur cadastre";

  useEffect(() => {
    if (!isAuthReady) return;
    if (!auth?.id && !auth?.email && !auth?.username) navigate("/", { replace: true });
    else if (!isCadastreRole(auth?.role)) navigate(getDefaultDashboardPath(auth?.role), { replace: true });
  }, [auth?.email, auth?.id, auth?.role, auth?.username, isAuthReady, navigate]);

  useEffect(() => {
    if (!isAuthReady || !isCadastreRole(auth?.role)) return;
    let active = true;
    void axios.get<{ items?: DocumentRequest[] }>("/api/cadastre/demandes-documents-cadastraux", { withCredentials: true })
      .then((response) => { if (active) setRequests(response.data.items || []); })
      .catch(() => { if (active) setRequests([]); });
    void fetchPublishedActualites()
      .then((items) => { if (active) setNews(items.slice(0, 4)); })
      .catch(() => { if (active) setNews(getDefaultActualites().slice(0, 4)); });
    return () => { active = false; };
  }, [auth?.role, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !isCadastreRole(auth?.role) || getHasSeenOnboarding()) return;
    const params = new URLSearchParams(location.search);
    if (params.get("onboarding") === "1") setOnboardingActive(true);
    if ((getOnboardingActive() || params.get("onboarding") === "1") && !getOnboardingPageSeen("cadastre-dashboard")) setShowOnboarding(true);
    else if (!getOnboardingPageSeen("cadastre-dashboard")) setShowOnboardingPrompt(true);
  }, [auth?.role, isAuthReady, location.search]);

  const startOnboarding = () => { resetOnboardingPages(); setHasSeenOnboarding(false); setOnboardingActive(true); setShowOnboardingPrompt(false); setShowOnboarding(true); };
  const closeOnboarding = () => { setShowOnboarding(false); setShowOnboardingPrompt(false); stopOnboardingForever(); };
  const completeOnboarding = () => { setShowOnboarding(false); markOnboardingPageCompleted("cadastre-dashboard"); };
  const skipOnboarding = () => { setShowOnboardingPrompt(false); stopOnboardingForever(); };

  const requestStats = useMemo(() => {
    const available = requests.filter((item) => ["GENEREE", "DELIVREE"].includes(String(item.statut || "").toUpperCase())).length;
    const pending = requests.filter((item) => !["GENEREE", "DELIVREE", "REJETEE"].includes(String(item.statut || "").toUpperCase())).length;
    return { total: requests.length, available, pending };
  }, [requests]);

  const quickLinks = [
    { title: "Vérifier un titre", subtitle: "Contrôler un périmètre minier", icon: Waypoints, color: "green", onClick: () => navigate("/investisseur/interactive") },
    { title: "Demander un extrait cadastral", subtitle: "Déposer une demande officielle", icon: FilePlus2, color: "blue", onClick: () => navigate(DOCUMENT_REQUEST_ROUTE) },
    { title: "Mes demandes cadastrales", subtitle: "Suivre vos demandes et documents", icon: FileCheck2, color: "violet", onClick: () => navigate(DOCUMENTS_ROUTE) },
    { title: "Carte cadastrale", subtitle: "Consulter les couches publiques", icon: Map, color: "red", onClick: () => navigate("/carte/carte_public") },
    { title: "Formulaires & guides", subtitle: "Accéder aux ressources utiles", icon: BookOpen, color: "orange", onClick: () => navigate("/documentation") },
  ];

  const features = [
    { title: "Cartes interactives", text: "Explorez les cartes géologiques, cadastrales et les indices miniers.", icon: Map, color: "green", onClick: () => navigate("/carte/carte_public") },
    { title: "Titres miniers", text: "Consultez les titres, permis et autorisations minières.", icon: Waypoints, color: "orange", onClick: () => navigate("/investisseur/interactive") },
    { title: "Demande de documents", text: "Générez et téléchargez vos extraits et plans cadastraux officiels.", icon: FileText, color: "blue", onClick: () => navigate(DOCUMENT_REQUEST_ROUTE) },
    { title: "Gisements & ressources", text: "Accédez aux informations sur les gisements et ressources minérales.", icon: Sparkles, color: "violet", onClick: () => navigate("/carte/carte_public") },
    { title: "Téléchargements", text: "Accédez aux données ouvertes et jeux de données disponibles.", icon: Download, color: "red", onClick: () => navigate("/documentation") },
    { title: "Services en ligne", text: "Accédez à vos services cadastraux 24h/24 et 7j/7.", icon: ShieldCheck, color: "teal", onClick: () => navigate(DOCUMENTS_ROUTE) },
  ];

  if (!isAuthReady) return <BrandLoader fullScreen label="Chargement de l'espace cadastre..." />;

  return (
    <InvestorLayout>
      <main className={styles.referenceDashboard}>
        <section className={styles.heroReference} data-onboarding-id="cadastre-dashboard-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.94) 28%, rgba(255,255,255,.65) 43%, rgba(255,255,255,.15) 60%, rgba(255,255,255,0) 75%), url(${heroImage})` }}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopyReference}>
              <span className={styles.referenceEyebrow}><ShieldCheck size={15} /> PORTAIL CADASTRAL OFFICIEL</span>
              <h1>Portail cadastral officiel<br /><span>des titres miniers</span></h1>
              <p>Accédez aux informations géographiques et cadastrales officielles, générez vos documents et gérez vos titres miniers en toute simplicité.</p>
              <div className={styles.referenceHeroActions}>
                <button type="button" className={styles.orangeButton} onClick={() => navigate(DOCUMENT_REQUEST_ROUTE)}>Demander un document <ArrowRight size={17} /></button>
                <button type="button" className={styles.outlineButton} onClick={() => navigate("/carte/carte_public")}>Explorer la carte <Map size={17} /></button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.featureStrip}>
          <div className={styles.featureGrid}>
            {features.map(({ title, text, icon: Icon, color, onClick }) => <button type="button" key={title} className={styles.featureCard} onClick={onClick}><span className={`${styles.featureIcon} ${styles[color]}`}><Icon size={19} /></span><strong>{title}</strong><span>{text}</span><em className={styles[color]}>Découvrir <ArrowRight size={13} /></em></button>)}
          </div>
        </section>

        <section className={styles.statsSection}>
          <div className={styles.statsGridReference}>
            <div className={styles.statItem}><Map size={24} className={styles.greenText} /><div><strong>{requestStats.total}</strong><span>Mes demandes</span></div></div>
            <div className={styles.statItem}><FileCheck2 size={24} className={styles.orangeText} /><div><strong>{requestStats.available}</strong><span>Documents disponibles</span></div></div>
            <div className={styles.statItem}><Clock3 size={24} className={styles.blueText} /><div><strong>{requestStats.pending}</strong><span>Demandes en cours</span></div></div>
            <div className={styles.statItem}><Users size={24} className={styles.violetText} /><div><strong>24/7</strong><span>Services en ligne</span></div></div>
            <div className={styles.statItem}><ShieldCheck size={24} className={styles.greenText} /><div><strong>100%</strong><span>Données sécurisées</span></div></div>
            <div className={styles.statItem}><Zap size={24} className={styles.orangeText} /><div><strong>Simple</strong><span>Parcours numérique</span></div></div>
          </div>
        </section>

        <section className={styles.lowerGrid} data-onboarding-id="cadastre-dashboard-scope">
          <div className={styles.referencePanel}>
            <h2><Sparkles size={16} className={styles.orangeText} /> Accès rapides</h2>
            {quickLinks.map(({ title, subtitle, icon: Icon, color, onClick }) => <button type="button" key={title} className={styles.quickItem} onClick={onClick}><span className={`${styles.quickIcon} ${styles[color]}`}><Icon size={16} /></span><span><strong>{title}</strong><small>{subtitle}</small></span><ArrowRight size={16} className={styles.quickArrow} /></button>)}
          </div>

          <div className={styles.referencePanel}>
            <div className={styles.panelHeading}><h2><Megaphone size={16} className={styles.orangeText} /> Actualités & annonces</h2><button type="button" onClick={() => navigate("/acceuil/actualites")}>Voir toutes <ArrowRight size={13} /></button></div>
            {news.map((item) => <button type="button" className={styles.newsItem} key={item.id} onClick={() => navigate(`/acceuil/actualites/${item.slug}`)}><img src={item.imageUrl || heroImage} alt="" /><span>{item.title}</span><time>{formatNewsDate(item.publishedAt)}</time></button>)}
            {news.length === 0 && <p className={styles.emptyNews}>Aucune actualité disponible.</p>}
          </div>

          <div className={`${styles.referencePanel} ${styles.promoPanel}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(255, 214, 137, .98) 0%, rgba(250, 204, 119, .88) 42%, rgba(224, 138, 30, .18) 78%), url(${mapImage})` }}>
            <div className={styles.promoContent}><FileText size={30} /><h2>Générez vos extraits et plans cadastraux en quelques clics</h2><p>Simple, rapide et sécurisé. Disponible 24h/24.</p><button type="button" className={styles.promoButton} onClick={() => navigate(DOCUMENT_REQUEST_ROUTE)}>Demander un document <ArrowRight size={16} /></button></div>
          </div>
        </section>

        <section className={styles.bottomBar}>
          <div><Building2 size={18} /><span><strong>Données officielles</strong><small>Informations fiables et à jour</small></span></div>
          <div><ShieldCheck size={18} /><span><strong>Sécurisé</strong><small>Vos données sont protégées</small></span></div>
          <div><Clock3 size={18} /><span><strong>Disponible 24/7</strong><small>Accédez à nos services à tout moment</small></span></div>
          <div><MousePointerClick size={18} /><span><strong>Simple & rapide</strong><small>Des démarches simplifiées en ligne</small></span></div>
        </section>
      </main>
      <OnboardingWelcomeModal isOpen={showOnboardingPrompt} onStart={startOnboarding} onSkip={skipOnboarding} />
      <OnboardingTour isOpen={showOnboarding} steps={onboardingSteps} onClose={closeOnboarding} onComplete={completeOnboarding} />
    </InvestorLayout>
  );
}
