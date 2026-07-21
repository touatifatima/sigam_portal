import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { KeyRound, Mail, Shield, User, Users2 } from "lucide-react";
import { useAuthStore } from "@/src/store/useAuthStore";
import SettingsLayout from "@/components/settings/SettingsLayout";
import PageHeader from "@/components/settings/PageHeader";
import Card from "@/components/settings/Card";
import ProfileSidebar from "@/components/settings/ProfileSidebar";
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

const Profil = () => {
  const navigate = useNavigate();
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [profileUpdateStatus, setProfileUpdateStatus] =
    useState<ProfileUpdateStatus>(emptyProfileUpdateStatus);
  const [isProfileUpdateStatusLoading, setIsProfileUpdateStatusLoading] =
    useState(true);
  const [profileUpdateStatusError, setProfileUpdateStatusError] =
    useState<string | null>(null);

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
      { label: "Email", value: auth.email || "Non renseigne" },
      { label: "Telephone", value: auth.telephone || "Non renseigne" },
      { label: "Inscription", value: formatYear(auth.createdAt) },
    ],
    [auth.createdAt, auth.email, auth.role, auth.telephone]
  );

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
    return (
      <Button
        variant={variant === "outline" ? "outline" : "default"}
        className={className}
        onClick={openProfileUpdatePage}
        disabled={Boolean(profileUpdateDisabledReason)}
        title={profileUpdateDisabledReason || undefined}
      >
        {label}
      </Button>
    );
  };

  return (
    <InvestorLayout>
      <SettingsLayout
        className={styles.page}
        sidebar={
          <ProfileSidebar
            initials={userInitials || "U"}
            displayName={identityLabel}
            role={auth.role || "Investisseur"}
            plan={auth.isEntrepriseVerified ? "Verifie" : "A completer"}
            className={styles.sidebar}
            stats={[
              { label: "Role", value: auth.role || "Investisseur" },
              { label: "Email", value: auth.email || "Non renseigne" },
              { label: "Telephone", value: auth.telephone || "Non renseigne" },
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
        <PageHeader crumb="Profile Overview" />

        <div className={styles.stack}>
          <Card
            title="About Me"
            className={styles.card}
            action={
              <Button
                variant="outline"
                className={styles.secondaryButton}
                onClick={() => navigate("/investisseur/modifier-profil")}
                disabled={Boolean(profileUpdateDisabledReason)}
                title={profileUpdateDisabledReason || undefined}
              >
                Edit Profile
              </Button>
            }
          >
            <p className={styles.aboutText}>
              {profileUpdateHint}
            </p>
          </Card>

          <Card title="Personal Details" className={styles.card}>
            <dl className={styles.detailList}>
              {[
                { label: "Full Name", value: identityLabel || "Non renseigne" },
                { label: "Username", value: auth.username || "Non renseigne" },
                { label: "Email", value: auth.email || "Non renseigne" },
                { label: "Phone", value: auth.telephone || "Non renseigne" },
                { label: "Role", value: auth.role || "Investisseur" },
                { label: "Created At", value: formatDate(auth.createdAt) },
              ].map((row) => (
                <div key={row.label} className={styles.detailRow}>
                  <dt className={styles.detailLabel}>{row.label}</dt>
                  <dd className={styles.detailValue}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Skills" className={styles.card}>
            <div className={styles.skillsList}>
              {[
                auth.role || "Investisseur",
                auth.email ? "Email renseigne" : "Email a completer",
                auth.telephone ? "Telephone renseigne" : "Telephone a completer",
                auth.isEntrepriseVerified ? "Entreprise verifiee" : "Verification en attente",
              ].map((skill) => (
                <span
                  key={skill}
                  className={styles.skillPill}
                >
                  {skill}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </SettingsLayout>
    </InvestorLayout>
  );
};

export default Profil;
