import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Blocks,
  Compass,
  LockKeyhole,
  LogOut,
  Mail,
  Map,
  Route,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/src/hooks/use-toast";
import { useAuthStore } from "@/src/store/useAuthStore";
import {
  getHasSeenOnboarding,
  getOnboardingActive,
  resetOnboardingPages,
  setHasSeenOnboarding,
  setOnboardingActive,
  stopOnboardingForever,
} from "@/src/onboarding/storage";
import {
  getDefaultDashboardPath,
  isCadastreRole,
} from "@/src/utils/roleNavigation";
import styles from "./parametres.module.css";

type BrowserNotificationState = NotificationPermission | "unsupported";

export default function Parametres() {
  const navigate = useNavigate();
  const { auth, logout, isLoaded } = useAuthStore();
  const [guideEnabled, setGuideEnabled] = useState(true);
  const [browserNotifications, setBrowserNotifications] =
    useState<BrowserNotificationState>("unsupported");

  const cadastreMode = isCadastreRole(auth.role);
  const dashboardPath = getDefaultDashboardPath(auth.role);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setGuideEnabled(getOnboardingActive() || !getHasSeenOnboarding());

    if (!("Notification" in window)) {
      setBrowserNotifications("unsupported");
      return;
    }

    setBrowserNotifications(window.Notification.permission);
  }, []);

  const identityLabel = useMemo(() => {
    if (auth.Prenom || auth.nom) {
      return `${auth.Prenom ?? ""} ${auth.nom ?? ""}`.trim();
    }

    return auth.username || "Utilisateur";
  }, [auth.Prenom, auth.nom, auth.username]);

  const accountItems = [
    {
      label: "Compte",
      value: identityLabel,
      icon: <UserCog className="w-4 h-4" />,
    },
    {
      label: "Email",
      value: auth.email || "Non renseigne",
      icon: <Mail className="w-4 h-4" />,
    },
    {
      label: "Role",
      value: auth.role || "Investisseur",
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      label: "Statut entreprise",
      value: auth.isEntrepriseVerified ? "Verifiee" : "A completer",
      icon: <Blocks className="w-4 h-4" />,
    },
  ];

  const quickLinks = cadastreMode
    ? [
        {
          title: "Dashboard cadastre",
          description: "Revenir a votre espace principal de verification.",
          action: () => navigate(dashboardPath),
        },
        {
          title: "Verification prealable",
          description: "Acceder directement a l'analyse cartographique.",
          action: () => navigate("/investisseur/interactive"),
        },
        {
          title: "Carte publique",
          description: "Consulter la carte miniere publique.",
          action: () => navigate("/carte/carte_public"),
        },
      ]
    : [
        {
          title: "Mon profil",
          description: "Revoir les informations personnelles et entreprise.",
          action: () => navigate("/investisseur/profil"),
        },
        {
          title: "Mes demandes",
          description: "Suivre l'avancement de vos dossiers.",
          action: () => navigate("/investisseur/demandes"),
        },
        {
          title: "Notifications",
          description: "Consulter les alertes et retours importants.",
          action: () => navigate("/notification"),
        },
      ];

  const recommendations = cadastreMode
    ? [
        "Choix du fond cartographique par defaut (satellite, topographique, cadastral).",
        "Selection du systeme de coordonnees et des unites d'affichage.",
        "Activation des couches de superposition metier (perimetres, limites, servitudes).",
        "Reglage des alertes de chevauchement et des seuils de tolerance.",
      ]
    : [
        "Notifications email sur chaque changement de statut de demande.",
        "Rappels automatiques pour documents manquants ou expirants.",
        "Preference d'ouverture des listes en vue compacte ou detaillee.",
        "Reglages d'export et de telechargement des recapitulatifs PDF.",
      ];

  const formatNotificationState = (value: BrowserNotificationState) => {
    if (value === "unsupported") return "Non pris en charge";
    if (value === "granted") return "Activees";
    if (value === "denied") return "Bloquees par le navigateur";
    return "Non configurees";
  };

  const handleGuideToggle = (checked: boolean) => {
    setGuideEnabled(checked);

    if (checked) {
      resetOnboardingPages();
      setOnboardingActive(true);
      setHasSeenOnboarding(false);
      toast({
        title: "Guide reactive",
        description: "Le guide pourra s'afficher de nouveau lors de votre prochaine visite.",
      });
      return;
    }

    stopOnboardingForever();
    toast({
      title: "Guide desactive",
      description: "Le guide automatique ne s'affichera plus tant que vous ne le relancez pas.",
    });
  };

  const handleRequestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({
        title: "Navigateur non compatible",
        description: "Les notifications navigateur ne sont pas disponibles sur cet appareil.",
        variant: "destructive",
      });
      return;
    }

    const permission = await window.Notification.requestPermission();
    setBrowserNotifications(permission);

    toast({
      title:
        permission === "granted"
          ? "Notifications activees"
          : permission === "denied"
          ? "Notifications refusees"
          : "Notifications non activees",
      description:
        permission === "granted"
          ? "Votre navigateur pourra afficher des alertes locales."
          : "Vous pourrez modifier ce choix depuis les reglages du navigateur.",
    });
  };

  const handleResetGuide = () => {
    resetOnboardingPages();
    setOnboardingActive(true);
    setHasSeenOnboarding(false);
    setGuideEnabled(true);
    toast({
      title: "Parcours reinitialise",
      description: "Le guide de prise en main est pret a etre rejoue.",
    });
  };

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Parametres & preferences</span>
              <h1 className={styles.title}>Parametres</h1>
              <p className={styles.subtitle}>
                Centralisez vos reglages de compte, vos options d'utilisation et les acces rapides
                les plus utiles pour votre espace.
              </p>
            </div>

            <div className={styles.heroBadges}>
              <span className={styles.heroBadge}>
                <Settings2 className="w-4 h-4" />
                Espace personnel
              </span>
              <span
                className={`${styles.heroBadge} ${
                  auth.isEntrepriseVerified ? styles.heroBadgeSuccess : styles.heroBadgeWarning
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {auth.isEntrepriseVerified ? "Entreprise verifiee" : "Entreprise a completer"}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.grid}>
          <section className={`${styles.panel} ${styles.accountPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Compte</span>
                <h2 className={styles.panelTitle}>Resume du compte</h2>
              </div>
              <Badge className={styles.roleBadge}>{auth.role || "Investisseur"}</Badge>
            </div>

            <div className={styles.accountGrid}>
              {accountItems.map((item) => (
                <div key={item.label} className={styles.metricCard}>
                  <div className={styles.metricIcon}>{item.icon}</div>
                  <div className={styles.metricBody}>
                    <span className={styles.metricLabel}>{item.label}</span>
                    <strong className={styles.metricValue}>{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.actionsRow}>
              <Button className={styles.primaryButton} onClick={() => navigate("/investisseur/profil")}>
                Voir mon profil
              </Button>
              <Button
                variant="outline"
                className={styles.secondaryButton}
                onClick={() => navigate(dashboardPath)}
              >
                Retour dashboard
              </Button>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.preferencesPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Parcours</span>
                <h2 className={styles.panelTitle}>Guide d'utilisation</h2>
              </div>
              <Sparkles className={styles.panelIcon} />
            </div>

            <div className={styles.preferenceItem}>
              <div>
                <strong className={styles.preferenceTitle}>Guide automatique</strong>
                <p className={styles.preferenceText}>
                  Activez ou desactivez l'affichage automatique du guide lors d'une prochaine visite.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGuideToggle(!guideEnabled)}
                className={`${styles.toggleButton} ${guideEnabled ? styles.toggleButtonActive : ""}`}
                aria-pressed={guideEnabled}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>

            <div className={styles.preferenceActions}>
              <Button variant="outline" className={styles.secondaryButton} onClick={handleResetGuide}>
                Reinitialiser le guide
              </Button>
              <Button
                variant="outline"
                className={styles.secondaryButton}
                onClick={() => navigate(dashboardPath)}
              >
                Revenir au dashboard
              </Button>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.notificationsPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Alertes</span>
                <h2 className={styles.panelTitle}>Notifications navigateur</h2>
              </div>
              <Bell className={styles.panelIcon} />
            </div>

            <div className={styles.statusBox}>
              <span className={styles.statusLabel}>Etat actuel</span>
              <strong className={styles.statusValue}>
                {formatNotificationState(browserNotifications)}
              </strong>
            </div>

            <p className={styles.preferenceText}>
              Activez les notifications locales du navigateur pour recevoir plus vite les alertes
              visibles sur cet appareil.
            </p>

            <Button className={styles.primaryButton} onClick={handleRequestBrowserNotifications}>
              Autoriser les notifications
            </Button>
          </section>

          <section className={`${styles.panel} ${styles.securityPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Securite</span>
                <h2 className={styles.panelTitle}>Session et acces</h2>
              </div>
              <LockKeyhole className={styles.panelIcon} />
            </div>

            <div className={styles.securityList}>
              <div className={styles.securityItem}>
                <span className={styles.securityKey}>Chargement session</span>
                <strong className={styles.securityValue}>{isLoaded ? "Session chargee" : "Verification..."}</strong>
              </div>
              <div className={styles.securityItem}>
                <span className={styles.securityKey}>Compte courant</span>
                <strong className={styles.securityValue}>{identityLabel}</strong>
              </div>
              <div className={styles.securityItem}>
                <span className={styles.securityKey}>Navigation principale</span>
                <strong className={styles.securityValue}>
                  {cadastreMode ? "Cadastre / verification" : "Investisseur / demandes"}
                </strong>
              </div>
            </div>

            <div className={styles.actionsRow}>
              <Button
                variant="outline"
                className={styles.secondaryButton}
                onClick={() => navigate("/auth/forgot-password")}
              >
                Gerer le mot de passe
              </Button>
              <Button className={styles.dangerButton} onClick={() => void logout()}>
                <LogOut className="w-4 h-4" />
                Se deconnecter
              </Button>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.shortcutsPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Raccourcis</span>
                <h2 className={styles.panelTitle}>Acces utiles</h2>
              </div>
              <Compass className={styles.panelIcon} />
            </div>

            <div className={styles.shortcutList}>
              {quickLinks.map((item) => (
                <button key={item.title} type="button" className={styles.shortcutCard} onClick={item.action}>
                  <div>
                    <strong className={styles.shortcutTitle}>{item.title}</strong>
                    <p className={styles.shortcutText}>{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.recommendationsPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>A ajouter ensuite</span>
                <h2 className={styles.panelTitle}>Parametres recommandes</h2>
              </div>
              {cadastreMode ? <Map className={styles.panelIcon} /> : <Route className={styles.panelIcon} />}
            </div>

            <p className={styles.preferenceText}>
              Voici les reglages les plus pertinents a ajouter ensuite pour faire de cette page une
              vraie page parametres metier.
            </p>

            <ul className={styles.recommendationList}>
              {recommendations.map((item) => (
                <li key={item} className={styles.recommendationItem}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Separator className={styles.separator} />

        <div className={styles.footerNote}>
          <p>
            Cette page contient deja les reglages utiles cote frontend. Pour aller plus loin, la
            prochaine etape logique est d'ajouter les preferences persistantes cote backend
            (notifications email, couches carte, preferences d'export, sécurité multi-session).
          </p>
        </div>
      </div>
    </InvestorLayout>
  );
}
