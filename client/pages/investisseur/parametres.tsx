import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Blocks,
  ChevronRight,
  Clock3,
  Globe2,
  LockKeyhole,
  LogOut,
  Mail,
  MoonStar,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SunMedium,
  UserCog,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
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
import { getDefaultDashboardPath } from "@/src/utils/roleNavigation";
import styles from "./parametres.module.css";

type BrowserNotificationState = NotificationPermission | "unsupported";

type LocalPreferences = {
  darkMode: boolean;
  language: string;
  timezone: string;
  permitAlerts: boolean;
  dossierUpdates: boolean;
  promotionalEmails: boolean;
};

const DEFAULT_PREFERENCES: LocalPreferences = {
  darkMode: false,
  language: "fr",
  timezone: "GMT+1",
  permitAlerts: true,
  dossierUpdates: true,
  promotionalEmails: false,
};

export default function Parametres() {
  const navigate = useNavigate();
  const { auth, logout } = useAuthStore();
  const [guideEnabled, setGuideEnabled] = useState(true);
  const [browserNotifications, setBrowserNotifications] =
    useState<BrowserNotificationState>("unsupported");
  const [darkMode, setDarkMode] = useState(DEFAULT_PREFERENCES.darkMode);
  const [language, setLanguage] = useState(DEFAULT_PREFERENCES.language);
  const [timezone, setTimezone] = useState(DEFAULT_PREFERENCES.timezone);
  const [permitAlerts, setPermitAlerts] = useState(DEFAULT_PREFERENCES.permitAlerts);
  const [dossierUpdates, setDossierUpdates] = useState(DEFAULT_PREFERENCES.dossierUpdates);
  const [promotionalEmails, setPromotionalEmails] = useState(
    DEFAULT_PREFERENCES.promotionalEmails
  );
  const [activeSection, setActiveSection] = useState("experience");
  const [preferencesReady, setPreferencesReady] = useState(false);

  const dashboardPath = getDefaultDashboardPath(auth.role);
  const preferencesStorageKey = `sigam_preferences_${auth.email || auth.username || "user"}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    setGuideEnabled(getOnboardingActive() || !getHasSeenOnboarding());

    if ("Notification" in window) {
      setBrowserNotifications(window.Notification.permission);
    } else {
      setBrowserNotifications("unsupported");
    }

    const saved = window.localStorage.getItem(preferencesStorageKey);
    let resolvedDarkMode =
      document.documentElement.classList.contains("dark") ||
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ||
      DEFAULT_PREFERENCES.darkMode;

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<LocalPreferences>;
        resolvedDarkMode = parsed.darkMode ?? resolvedDarkMode;
        setLanguage(parsed.language || DEFAULT_PREFERENCES.language);
        setTimezone(parsed.timezone || DEFAULT_PREFERENCES.timezone);
        setPermitAlerts(parsed.permitAlerts ?? DEFAULT_PREFERENCES.permitAlerts);
        setDossierUpdates(parsed.dossierUpdates ?? DEFAULT_PREFERENCES.dossierUpdates);
        setPromotionalEmails(
          parsed.promotionalEmails ?? DEFAULT_PREFERENCES.promotionalEmails
        );
      } catch {
        window.localStorage.removeItem(preferencesStorageKey);
      }
    }

    setDarkMode(resolvedDarkMode);
    document.documentElement.classList.toggle("dark", resolvedDarkMode);
    setPreferencesReady(true);
  }, [preferencesStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !preferencesReady) return;

    const payload: LocalPreferences = {
      darkMode,
      language,
      timezone,
      permitAlerts,
      dossierUpdates,
      promotionalEmails,
    };

    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify(payload));
  }, [
    darkMode,
    dossierUpdates,
    language,
    permitAlerts,
    preferencesReady,
    preferencesStorageKey,
    promotionalEmails,
    timezone,
  ]);

  const identityLabel = useMemo(() => {
    if (auth.Prenom || auth.nom) {
      return `${auth.Prenom ?? ""} ${auth.nom ?? ""}`.trim();
    }

    return auth.username || "Utilisateur";
  }, [auth.Prenom, auth.nom, auth.username]);

  const initials = useMemo(() => {
    return identityLabel
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [identityLabel]);

  const sidebarItems = [
    { id: "experience", label: "Apparence", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Zone sensible", icon: ShieldAlert },
  ];

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
      label: "Statut",
      value: auth.isEntrepriseVerified ? "Entreprise verifiee" : "A completer",
      icon: <Blocks className="w-4 h-4" />,
    },
  ];

  const formatNotificationState = (value: BrowserNotificationState) => {
    if (value === "unsupported") return "Non pris en charge";
    if (value === "granted") return "Activees";
    if (value === "denied") return "Bloquees";
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
      description: "Le guide automatique est maintenant coupe pour ce navigateur.",
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

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (typeof document === "undefined") return;

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <InvestorLayout>
      <div className={styles.page} data-theme={darkMode ? "dark" : "light"}>
        <div className={styles.shell}>
          <aside className={styles.sidebar}>
            <div className={`${styles.sidebarCard} ${styles.identityCard}`}>
              <div className={styles.avatarCircle}>{initials || "U"}</div>
              <h2 className={styles.identityName}>{identityLabel}</h2>
              <p className={styles.identityEmail}>{auth.email || "email@exemple.com"}</p>

              <div className={styles.identityBadges}>
                <span className={`${styles.badge} ${styles.badgePrimary}`}>
                  {auth.role || "Investisseur"}
                </span>
                <span
                  className={`${styles.badge} ${
                    auth.isEntrepriseVerified ? styles.badgeSuccess : styles.badgeWarning
                  }`}
                >
                  {auth.isEntrepriseVerified ? "Verifiee" : "A completer"}
                </span>
              </div>

              <Button className={styles.primaryButton} onClick={() => navigate("/investisseur/profil")}>
                Voir mon profil
              </Button>
            </div>

            <div className={styles.sidebarCard}>
              <div className={styles.sidebarCardHeader}>
                <span className={styles.sidebarEyebrow}>Navigation</span>
                <h3 className={styles.sidebarTitle}>Sections</h3>
              </div>

              <div className={styles.sidebarNav}>
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.sidebarNavButton} ${
                        activeSection === item.id ? styles.sidebarNavButtonActive : ""
                      }`}
                      onClick={() => scrollToSection(item.id)}
                    >
                      <span className={styles.sidebarNavLead}>
                        <span className={styles.sidebarNavIcon}>
                          <Icon className="w-4 h-4" />
                        </span>
                        {item.label}
                      </span>
                      <ChevronRight className={styles.sidebarNavArrow} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.sidebarCard}>
              <div className={styles.sidebarCardHeader}>
                <span className={styles.sidebarEyebrow}>Resume</span>
                <h3 className={styles.sidebarTitle}>Compte utilisateur</h3>
              </div>

              <div className={styles.accountGrid}>
                {accountItems.map((item) => (
                  <div key={item.label} className={styles.accountCard}>
                    <div className={styles.accountIcon}>{item.icon}</div>
                    <div>
                      <span className={styles.accountLabel}>{item.label}</span>
                      <strong className={styles.accountValue}>{item.value}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className={styles.main}>
            <div className={styles.hero}>
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>Parametres</span>
                <h1 className={styles.title}>Preferences de compte et notifications</h1>
                <p className={styles.subtitle}>
                  Une page plus propre et plus professionnelle pour gerer vos habitudes
                  d'utilisation, vos alertes et vos actions sensibles.
                </p>
              </div>

              <div className={styles.heroActions}>
                <Button variant="outline" className={styles.secondaryButton} onClick={() => navigate(dashboardPath)}>
                  Retour dashboard
                </Button>
                <Button className={styles.primaryButton} onClick={() => navigate("/investisseur/profil")}>
                  Mon profil
                </Button>
              </div>
            </div>

            <div className={styles.panelGrid}>
              <section id="experience" className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeading}>
                    <div className={styles.panelIcon}>
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={styles.panelEyebrow}>Apparence</span>
                      <h2 className={styles.panelTitle}>Theme et affichage</h2>
                    </div>
                  </div>
                </div>

                <div className={styles.settingList}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Mode sombre</strong>
                      <p className={styles.settingText}>
                        Active un affichage sombre pour cette page et les composants compatibles.
                      </p>
                    </div>
                    <div className={styles.themeSwitch}>
                      <span className={styles.themeIconLabel}>
                        {darkMode ? <MoonStar className="w-4 h-4" /> : <SunMedium className="w-4 h-4" />}
                        {darkMode ? "Sombre" : "Clair"}
                      </span>
                      <button
                        type="button"
                        className={`${styles.toggleButton} ${
                          darkMode ? styles.toggleButtonActive : ""
                        }`}
                        onClick={() => setDarkMode((prev) => !prev)}
                        aria-pressed={darkMode}
                        aria-label="Activer le mode sombre"
                      >
                        <span className={styles.toggleThumb} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Guide automatique</strong>
                      <p className={styles.settingText}>
                        Active ou non le guide de prise en main pour les prochaines visites.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${
                        guideEnabled ? styles.toggleButtonActive : ""
                      }`}
                      onClick={() => handleGuideToggle(!guideEnabled)}
                      aria-pressed={guideEnabled}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Langue</strong>
                      <p className={styles.settingText}>
                        Preference locale utilisee sur ce navigateur.
                      </p>
                    </div>
                    <select
                      className={styles.selectControl}
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                    >
                      <option value="fr">Francais</option>
                      <option value="ar">Arabe</option>
                      <option value="en">Anglais</option>
                    </select>
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Fuseau horaire</strong>
                      <p className={styles.settingText}>
                        Utilise pour l'affichage des dates et heures cote interface.
                      </p>
                    </div>
                    <select
                      className={styles.selectControl}
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                    >
                      <option value="GMT+1">GMT+1</option>
                      <option value="UTC">UTC</option>
                      <option value="GMT+2">GMT+2</option>
                    </select>
                  </div>
                </div>
              </section>

              <section id="notifications" className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeading}>
                    <div className={styles.panelIcon}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={styles.panelEyebrow}>Notifications</span>
                      <h2 className={styles.panelTitle}>Alertes et mises a jour</h2>
                    </div>
                  </div>
                </div>

                <div className={styles.settingList}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Notifications navigateur</strong>
                      <p className={styles.settingText}>
                        Etat actuel: {formatNotificationState(browserNotifications)}.
                      </p>
                    </div>
                    <Button className={styles.primaryButton} onClick={handleRequestBrowserNotifications}>
                      Autoriser
                    </Button>
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Alertes permis</strong>
                      <p className={styles.settingText}>
                        Notifications locales liees aux renouvellements et echeances.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${
                        permitAlerts ? styles.toggleButtonActive : ""
                      }`}
                      onClick={() => setPermitAlerts((prev) => !prev)}
                      aria-pressed={permitAlerts}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Mises a jour dossiers</strong>
                      <p className={styles.settingText}>
                        Resume local des changements importants sur vos demandes.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${
                        dossierUpdates ? styles.toggleButtonActive : ""
                      }`}
                      onClick={() => setDossierUpdates((prev) => !prev)}
                      aria-pressed={dossierUpdates}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <strong className={styles.settingTitle}>Emails promotionnels</strong>
                      <p className={styles.settingText}>
                        Active ou non les emails non critiques sur ce compte.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${
                        promotionalEmails ? styles.toggleButtonActive : ""
                      }`}
                      onClick={() => setPromotionalEmails((prev) => !prev)}
                      aria-pressed={promotionalEmails}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>
                </div>

                <div className={styles.inlineNote}>
                  <Sparkles className="w-4 h-4" />
                  Certaines preferences, y compris le theme, sont sauvegardees localement.
                </div>
              </section>
            </div>

            <section id="security" className={`${styles.panel} ${styles.sensitivePanel}`}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeading}>
                  <div className={styles.panelIcon}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={styles.panelEyebrow}>Zone sensible</span>
                    <h2 className={styles.panelTitle}>Securite et actions sensibles</h2>
                  </div>
                </div>
              </div>

              <div className={styles.sensitiveList}>
                <div className={styles.sensitiveRow}>
                  <div>
                    <strong className={styles.settingTitle}>Changer le mot de passe</strong>
                    <p className={styles.settingText}>
                      Mettez a jour vos identifiants de connexion depuis la page dediee.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    onClick={() => navigate("/auth/forgot-password")}
                  >
                    Modifier
                  </Button>
                </div>

                <div className={styles.sensitiveRow}>
                  <div>
                    <strong className={styles.settingTitle}>Reinitialiser le guide</strong>
                    <p className={styles.settingText}>
                      Relancez le parcours de prise en main si vous souhaitez revoir les etapes.
                    </p>
                  </div>
                  <Button variant="outline" className={styles.secondaryButton} onClick={handleResetGuide}>
                    Reinitialiser
                  </Button>
                </div>

                <div className={styles.sensitiveRow}>
                  <div>
                    <strong className={styles.settingTitle}>Se deconnecter</strong>
                    <p className={styles.settingText}>
                      Fermez la session active sur cet appareil.
                    </p>
                  </div>
                  <Button className={styles.dangerButton} onClick={() => void logout()}>
                    <LogOut className="w-4 h-4" />
                    Deconnexion
                  </Button>
                </div>
              </div>

              <div className={styles.footerMeta}>
                <div className={styles.footerMetaItem}>
                  {darkMode ? <MoonStar className="w-4 h-4" /> : <SunMedium className="w-4 h-4" />}
                  <span>Theme: {darkMode ? "Sombre" : "Clair"}</span>
                </div>
                <div className={styles.footerMetaItem}>
                  <Clock3 className="w-4 h-4" />
                  <span>Fuseau actif: {timezone}</span>
                </div>
                <div className={styles.footerMetaItem}>
                  <Globe2 className="w-4 h-4" />
                  <span>Langue: {language === "fr" ? "Francais" : language === "ar" ? "Arabe" : "Anglais"}</span>
                </div>
                <div className={styles.footerMetaItem}>
                  <LockKeyhole className="w-4 h-4" />
                  <span>Preferences locales securisees par navigateur</span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </InvestorLayout>
  );
}
