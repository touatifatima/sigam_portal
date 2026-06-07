import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/src/hooks/use-toast";
import {
  ArrowRight,
  Calendar,
  Camera,
  Mail,
  Phone,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { useAuthStore } from "@/src/store/useAuthStore";
import styles from "./Profil.module.css";

type ProfileUpdateStatus = {
  canEdit: boolean;
  lastProfileUpdateAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
  cooldownMessage: string | null;
  hasPendingRequest: boolean;
  pendingExpiresAt: string | null;
  resendAvailableAt: string | null;
};

const emptyProfileUpdateStatus: ProfileUpdateStatus = {
  canEdit: true,
  lastProfileUpdateAt: null,
  nextAvailableAt: null,
  remainingMs: 0,
  cooldownMessage: null,
  hasPendingRequest: false,
  pendingExpiresAt: null,
  resendAvailableAt: null,
};

type ProfileFieldProps = {
  label: string;
  value: string;
  icon: ReactNode;
  fullWidth?: boolean;
  rtl?: boolean;
};

function ProfileField({
  label,
  value,
  icon,
  fullWidth = false,
  rtl = false,
}: ProfileFieldProps) {
  return (
    <div className={`${styles.field} ${fullWidth ? styles.fieldFull : ""}`}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldBox}>
        <span className={styles.fieldIcon}>{icon}</span>
        <span className={`${styles.fieldValue} ${rtl ? styles.fieldValueRtl : ""}`}>{value}</span>
      </div>
    </div>
  );
}

const Profil = () => {
  const navigate = useNavigate();
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("personal");
  const [profileUpdateStatus, setProfileUpdateStatus] =
    useState<ProfileUpdateStatus>(emptyProfileUpdateStatus);
  const [isProfileUpdateStatusLoading, setIsProfileUpdateStatusLoading] =
    useState(true);
  const [profileUpdateStatusError, setProfileUpdateStatusError] =
    useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profilePhotoStorageKey = `sigam_profile_photo_${auth.email || auth.username || "user"}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(profilePhotoStorageKey);
    if (saved) {
      setProfilePhoto(saved);
    }
  }, [profilePhotoStorageKey]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!apiURL) {
      setProfileUpdateStatusError("Verification de securite indisponible.");
      setIsProfileUpdateStatusLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchProfileUpdateStatus = async () => {
      setIsProfileUpdateStatusLoading(true);
      setProfileUpdateStatusError(null);

      try {
        const response = await axios.get(`${apiURL}/auth/profile-update/status`, {
          withCredentials: true,
        });

        if (isCancelled) return;
        setProfileUpdateStatus({
          ...emptyProfileUpdateStatus,
          ...response.data,
        });
      } catch (error: any) {
        if (isCancelled) return;
        setProfileUpdateStatusError(
          error?.response?.data?.message ||
            "Impossible de verifier la disponibilite de la modification.",
        );
      } finally {
        if (!isCancelled) {
          setIsProfileUpdateStatusLoading(false);
        }
      }
    };

    void fetchProfileUpdateStatus();

    return () => {
      isCancelled = true;
    };
  }, [apiURL, isLoaded]);

  const handleSelectPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Fichier invalide",
        description: "Veuillez choisir une image PNG, JPG ou WEBP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Image trop lourde",
        description: "La taille maximale autorisee est 2 Mo.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setProfilePhoto(result);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(profilePhotoStorageKey, result);
      }
      toast({
        title: "Photo mise a jour",
        description: "Votre photo de profil a ete enregistree localement.",
      });
    };
    reader.readAsDataURL(file);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Non renseigne";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Non renseigne";
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatYear = (dateString?: string | null) => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "--";
    return String(date.getFullYear());
  };

  const identityLabel = useMemo(() => {
    if (auth.Prenom || auth.nom) {
      return `${auth.Prenom ?? ""} ${auth.nom ?? ""}`.trim();
    }
    return auth.username || "Utilisateur";
  }, [auth.Prenom, auth.nom, auth.username]);

  const userInitials = useMemo(() => {
    return identityLabel
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [identityLabel]);

  const sidebarMetrics = useMemo(
    () => [
      { label: "Role", value: auth.role || "Investisseur" },
      { label: "Email", value: auth.email ? "Renseigne" : "A completer" },
      { label: "Telephone", value: auth.telephone ? "Renseigne" : "A completer" },
      { label: "Inscription", value: formatYear(auth.createdAt) },
    ],
    [auth.createdAt, auth.email, auth.role, auth.telephone]
  );

  const sectionLinks = useMemo(
    () => [
      { id: "personal", label: "Mon profil", icon: User },
      { id: "info-zone", label: "Informations utiles", icon: Sparkles },
    ],
    []
  );

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (typeof document === "undefined") return;
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const profileUpdateDisabledReason = useMemo(() => {
    if (!isLoaded || isProfileUpdateStatusLoading) {
      return "Verification de disponibilite en cours.";
    }

    if (!apiURL) {
      return "Configuration API manquante.";
    }

    if (profileUpdateStatusError) {
      return profileUpdateStatusError;
    }

    if (!profileUpdateStatus.canEdit) {
      return (
        profileUpdateStatus.cooldownMessage ||
        "Vous avez deja modifie vos informations personnelles recemment."
      );
    }

    return null;
  }, [
    apiURL,
    isLoaded,
    isProfileUpdateStatusLoading,
    profileUpdateStatus.canEdit,
    profileUpdateStatus.cooldownMessage,
    profileUpdateStatusError,
  ]);

  const profileUpdateHint = useMemo(() => {
    if (profileUpdateDisabledReason) {
      return profileUpdateDisabledReason;
    }

    if (profileUpdateStatus.lastProfileUpdateAt) {
      return `Derniere modification confirmee le ${formatDate(profileUpdateStatus.lastProfileUpdateAt)}. Validation OTP requise pour tout nouveau changement.`;
    }

    return "Toute modification sensible sera confirmee par OTP envoye sur votre adresse email actuelle.";
  }, [profileUpdateDisabledReason, profileUpdateStatus.lastProfileUpdateAt]);

  const openProfileUpdatePage = () => {
    if (profileUpdateDisabledReason) return;
    navigate("/investisseur/modifier-profil");
  };

  const renderProfileUpdateButton = (
    label: string,
    className: string,
    variant: "default" | "outline" = "default",
  ) => {
    const button = (
      <Button
        variant={variant === "outline" ? "outline" : "default"}
        className={className}
        onClick={openProfileUpdatePage}
        disabled={Boolean(profileUpdateDisabledReason)}
      >
        {label}
      </Button>
    );

    if (!profileUpdateDisabledReason) {
      return button;
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={styles.actionButtonWrap}>{button}</span>
          </TooltipTrigger>
          <TooltipContent className={styles.actionTooltip}>
            {profileUpdateDisabledReason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <InvestorLayout>
      <div className={styles.page}>
        <div className={styles.shell}>
          <aside className={styles.sidebar}>
            <div className={`${styles.sideCard} ${styles.identityCard}`}>
              <div className={styles.avatarShell}>
                <div className={styles.avatarCircle}>
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Photo de profil" className={styles.avatarImage} />
                  ) : (
                    <span className={styles.avatarInitials}>{userInitials || "U"}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.avatarEditButton}
                  onClick={handleSelectPhoto}
                  aria-label="Modifier la photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className={styles.identityText}>
                <h2 className={styles.userName}>{identityLabel}</h2>
                <p className={styles.userEmail}>{auth.email || "email@exemple.com"}</p>
              </div>

              <div className={styles.badgeRow}>
                <span className={`${styles.statusPill} ${styles.statusPrimary}`}>
                  <Shield className="w-4 h-4" />
                  {auth.role || "Investisseur"}
                </span>
                <span className={`${styles.statusPill} ${styles.statusSuccess}`}>
                  <User className="w-4 h-4" />
                  Compte utilisateur
                </span>
              </div>

              <div className={styles.metricGrid}>
                {sidebarMetrics.map((metric) => (
                  <div key={metric.label} className={styles.metricCard}>
                    <strong className={styles.metricValue}>{metric.value}</strong>
                    <span className={styles.metricLabel}>{metric.label}</span>
                  </div>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className={styles.hiddenFileInput}
              />
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideEyebrow}>Navigation</span>
                <h3 className={styles.sideTitle}>Sections profil</h3>
              </div>
              <div className={styles.sideNavList}>
                {sectionLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.sideNavButton} ${
                        activeSection === item.id ? styles.sideNavButtonActive : ""
                      }`}
                      onClick={() => scrollToSection(item.id)}
                    >
                      <span className={styles.sideNavLead}>
                        <span className={styles.sideNavIcon}>
                          <Icon className="w-4 h-4" />
                        </span>
                        {item.label}
                      </span>
                      <ArrowRight className={styles.sideNavArrow} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <span className={styles.sideEyebrow}>Compte</span>
                <h3 className={styles.sideTitle}>Actions rapides</h3>
              </div>
              <p className={styles.sideNote}>
                Accedez rapidement a vos parametres ou ouvrez le formulaire securise de
                modification.
              </p>
              <div className={styles.sideActions}>
                <Button className={styles.primaryButton} onClick={() => navigate("/investisseur/parametres")}>
                  Ouvrir les parametres
                </Button>
                {renderProfileUpdateButton(
                  "Modifier mes informations",
                  styles.secondaryButton,
                  "outline",
                )}
              </div>
              <p className={styles.actionHint}>{profileUpdateHint}</p>
            </div>
          </aside>

          <main className={styles.main}>
            <div className={styles.hero}>
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>Mon profil</span>
                <h1 className={styles.title}>Gerez vos informations personnelles</h1>
                <p className={styles.subtitle}>
                  Consultez vos donnees de compte dans une interface plus lisible et plus
                  structuree.
                </p>
              </div>
              <div className={styles.heroActions}>
                <Button variant="outline" className={styles.secondaryButton} onClick={() => navigate("/investisseur/parametres")}>
                  Parametres
                </Button>
                {renderProfileUpdateButton(
                  "Modifier mes informations",
                  styles.primaryButton,
                )}
                <p className={styles.actionHint}>{profileUpdateHint}</p>
              </div>
            </div>

            <section id="personal" className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionLead}>
                  <div className={styles.sectionIcon}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={styles.sectionEyebrow}>Compte utilisateur</span>
                    <h2 className={styles.sectionTitle}>Informations personnelles</h2>
                    <p className={styles.sectionText}>
                      Vos coordonnees principales et les donnees rattachees a votre compte.
                    </p>
                  </div>
                </div>
                <span className={styles.sectionBadge}>{auth.role || "Investisseur"}</span>
              </div>

              <div className={styles.fieldGrid}>
                <ProfileField label="Prenom" value={auth.Prenom || "Non renseigne"} icon={<User className="w-4 h-4" />} />
                <ProfileField label="Nom" value={auth.nom || "Non renseigne"} icon={<User className="w-4 h-4" />} />
                <ProfileField label="Email" value={auth.email || "Non renseigne"} icon={<Mail className="w-4 h-4" />} />
                <ProfileField label="Telephone" value={auth.telephone || "Non renseigne"} icon={<Phone className="w-4 h-4" />} />
                <ProfileField label="Date d'inscription" value={formatDate(auth.createdAt)} icon={<Calendar className="w-4 h-4" />} />
                <ProfileField label="Role" value={auth.role || "Investisseur"} icon={<Shield className="w-4 h-4" />} />
              </div>
            </section>

            <section id="info-zone" className={`${styles.sectionCard} ${styles.noticeCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionLead}>
                  <div className={styles.sectionIcon}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={styles.sectionEyebrow}>Informations utiles</span>
                    <h2 className={styles.sectionTitle}>Mises a jour et modifications</h2>
                    <p className={styles.sectionText}>
                      Certaines informations doivent etre mises a jour par procedure plutot que par
                      edition directe.
                    </p>
                  </div>
                </div>
              </div>

              <p className={styles.noticeText}>
                Pour modifier des informations sensibles de compte, utilisez la procedure adaptee
                depuis votre espace investisseur ou contactez l'administration.
              </p>

              <div className={styles.noticeActions}>
                {renderProfileUpdateButton(
                  "Modifier mes informations",
                  styles.secondaryButton,
                  "outline",
                )}
                <Button className={styles.primaryButton} onClick={() => navigate("/investisseur/parametres")}>
                  Aller aux parametres
                </Button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default Profil;
