import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Blocks, KeyRound, LogOut, Mail, Shield, ShieldCheck, User, Users2, UserCog } from "lucide-react";
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
import SettingsLayout from "@/components/settings/SettingsLayout";
import PageHeader from "@/components/settings/PageHeader";
import Card from "@/components/settings/Card";
import ProfileSidebar from "@/components/settings/ProfileSidebar";
import Toggle from "@/components/settings/Toggle";
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
  const location = useLocation();
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

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (!hash) return;

    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

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

  return (
    <InvestorLayout>
      <SettingsLayout
        className={styles.page}
        sidebar={
          <ProfileSidebar
            initials={initials || "U"}
            displayName={identityLabel}
            role={auth.role || "Investisseur"}
            plan={auth.isEntrepriseVerified ? "Verifiee" : "A completer"}
            className={styles.sidebar}
            stats={[
              { label: "Compte", value: identityLabel },
              { label: "Email", value: auth.email || "Non renseigne" },
              { label: "Role", value: auth.role || "Investisseur" },
            ]}
            navItems={[
              { to: "/investisseur/profil", label: "Profile Overview", icon: User },
              { to: "/investisseur/modifier-profil", label: "Personal Info", icon: Users2 },
              { to: "/investisseur/parametres#experience", label: "Account Settings", icon: Shield },
              { to: "/investisseur/change-password", label: "Change Password", icon: KeyRound },
              { to: "/investisseur/parametres#notifications", label: "Email Settings", icon: Mail },
            ]}
          />
        }
      >
        <PageHeader crumb="Account Settings" />

        <div className={styles.stack}>
          <section id="experience" className={styles.anchorSection}>
            <Card title="General Settings" className={styles.card}>
            <div className={styles.sectionList}>
              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Theme</p>
                  <p className={styles.settingNote}>
                    {darkMode ? "Mode sombre" : "Mode clair"}
                  </p>
                </div>
                <Toggle checked={darkMode} onChange={setDarkMode} />
              </div>

              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Guide automatique</p>
                  <p className={styles.settingNote}>
                    {guideEnabled ? "Activé" : "Désactivé"}
                  </p>
                </div>
                <Toggle checked={guideEnabled} onChange={handleGuideToggle} />
              </div>

              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Language</p>
                  <p className={styles.settingNote}>
                    Preference locale utilisee sur ce navigateur.
                  </p>
                </div>
                <select
                  className={styles.select}
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
                  <p className={styles.settingTitle}>Time zone</p>
                  <p className={styles.settingNote}>
                    Utilise pour l&apos;affichage des dates et heures.
                  </p>
                </div>
                <select
                  className={styles.select}
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                >
                  <option value="GMT+1">GMT+1</option>
                  <option value="UTC">UTC</option>
                  <option value="GMT+2">GMT+2</option>
                </select>
              </div>
            </div>
            </Card>
          </section>

          <section id="notifications" className={styles.anchorSection}>
            <Card title="Security" className={styles.card}>
            <div className={styles.sectionList}>
              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Notifications navigateur</p>
                  <p className={styles.settingNote}>
                    Etat actuel: {formatNotificationState(browserNotifications)}.
                  </p>
                </div>
                <Button
                  className={styles.inlineButton}
                  onClick={handleRequestBrowserNotifications}
                >
                  Autoriser
                </Button>
              </div>

              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Alertes permis</p>
                  <p className={styles.settingNote}>
                    Notifications locales liées aux renouvellements et échéances.
                  </p>
                </div>
                <Toggle checked={permitAlerts} onChange={setPermitAlerts} />
              </div>

              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Mises à jour dossiers</p>
                  <p className={styles.settingNote}>
                    Résumé local des changements importants sur vos demandes.
                  </p>
                </div>
                <Toggle checked={dossierUpdates} onChange={setDossierUpdates} />
              </div>

              <div className={styles.settingRow}>
                <div className={styles.settingCopy}>
                  <p className={styles.settingTitle}>Emails promotionnels</p>
                  <p className={styles.settingNote}>
                    Active ou non les emails non critiques sur ce compte.
                  </p>
                </div>
                <Toggle checked={promotionalEmails} onChange={setPromotionalEmails} />
              </div>
            </div>
            </Card>
          </section>

          <section id="devices" className={styles.anchorSection}>
            <Card title="Recognized Devices" className={styles.card}>
            <div className={styles.deviceList}>
              {accountItems.map((item) => (
                <div key={item.label} className={styles.deviceItem}>
                  <div className={styles.deviceMeta}>
                    <span className={styles.deviceIcon}>
                      {item.icon}
                    </span>
                    <div>
                      <p className={styles.deviceName}>{item.label}</p>
                      <p className={styles.deviceSubtext}>{item.value}</p>
                    </div>
                  </div>
                  <span className={styles.deviceStatus}>Current</span>
                </div>
              ))}
            </div>
            </Card>
          </section>

          <section id="sessions" className={styles.anchorSection}>
            <Card title="Active Sessions" className={styles.card}>
            <p className={styles.sessionNote}>
              Vous êtes actuellement connecté sur cet appareil. Vous pouvez réinitialiser le
              guide de prise en main ou ouvrir votre profil plus complet ci-dessous.
            </p>
            <div className={styles.actions}>
              <Button
                className={styles.primaryButton}
                onClick={() => navigate(dashboardPath)}
              >
                Retour dashboard
              </Button>
              <Button
                variant="outline"
                className={styles.secondaryButton}
                onClick={handleResetGuide}
              >
                Reinitialiser le guide
              </Button>
              <Button
                variant="outline"
                className={styles.secondaryButton}
                onClick={() => navigate("/investisseur/profil")}
              >
                Voir mon profil
              </Button>
              <Button
                className={styles.dangerButton}
                onClick={() => void logout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Deconnexion
              </Button>
            </div>
            </Card>
          </section>
        </div>
      </SettingsLayout>
    </InvestorLayout>
  );
}
