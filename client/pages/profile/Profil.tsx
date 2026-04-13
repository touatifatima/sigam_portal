import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { toast } from "@/src/hooks/use-toast";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Shield,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/src/store/useAuthStore";
import styles from "./Profil.module.css";

interface EntrepriseProfile {
  entreprise_verified: boolean;
  detenteur: any;
  representant: any;
  registre: any;
  actionnaires: any[];
}

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

  const [entrepriseProfile, setEntrepriseProfile] = useState<EntrepriseProfile | null>(null);
  const [isLoadingEntreprise, setIsLoadingEntreprise] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("personal");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profilePhotoStorageKey = `sigam_profile_photo_${auth.email || auth.username || "user"}`;

  useEffect(() => {
    if (!isLoaded) return;
    if (!auth.isEntrepriseVerified) {
      setEntrepriseProfile(null);
      return;
    }
    if (!apiURL) {
      setLoadError("API URL manquante");
      return;
    }

    const fetchEntreprise = async () => {
      setIsLoadingEntreprise(true);
      setLoadError(null);
      try {
        const res = await axios.get(`${apiURL}/api/profil/entreprise`, {
          withCredentials: true,
        });
        setEntrepriseProfile(res.data);
      } catch (error: any) {
        setEntrepriseProfile(null);
        setLoadError(
          error?.response?.data?.message ||
            error?.message ||
            "Impossible de charger les informations de l'entreprise"
        );
      } finally {
        setIsLoadingEntreprise(false);
      }
    };

    void fetchEntreprise();
  }, [apiURL, auth.isEntrepriseVerified, isLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(profilePhotoStorageKey);
    if (saved) {
      setProfilePhoto(saved);
    }
  }, [profilePhotoStorageKey]);

  const handleEditBlocked = () => {
    toast({
      title: "Modification indisponible",
      description:
        "Pour modifier ces informations, veuillez soumettre une demande specifique.",
    });
  };

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

  const formatCurrency = (amount?: number | string | null) => {
    if (amount === null || amount === undefined || String(amount).trim() === "") {
      return "Non renseigne";
    }

    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const formatYear = (dateString?: string | null) => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "--";
    return String(date.getFullYear());
  };

  const detenteur = entrepriseProfile?.detenteur;
  const representant = entrepriseProfile?.representant?.personne;
  const registre = entrepriseProfile?.registre;
  const actionnaires = entrepriseProfile?.actionnaires ?? [];
  const statutJuridique =
    detenteur?.FormeJuridiqueDetenteur?.[0]?.statutJuridique?.statut_fr ||
    detenteur?.FormeJuridiqueDetenteur?.[0]?.statutJuridique?.code_statut ||
    "Non renseigne";

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
      { label: "Entreprise", value: auth.isEntrepriseVerified ? "Verifiee" : "En attente" },
      { label: "Actionnaires", value: String(actionnaires.length) },
      { label: "Inscription", value: formatYear(auth.createdAt) },
    ],
    [actionnaires.length, auth.createdAt, auth.isEntrepriseVerified, auth.role]
  );

  const sectionLinks = useMemo(
    () => [
      { id: "personal", label: "Mon profil", icon: User },
      ...(auth.isEntrepriseVerified
        ? [
            { id: "company", label: "Entreprise", icon: Building2 },
            { id: "representative", label: "Representant", icon: Briefcase },
            { id: "registry", label: "Registre", icon: FileText },
            { id: "shareholders", label: "Actionnaires", icon: Users },
          ]
        : []),
      { id: "info-zone", label: "Informations utiles", icon: Sparkles },
    ],
    [auth.isEntrepriseVerified]
  );

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
                <span
                  className={`${styles.statusPill} ${
                    auth.isEntrepriseVerified ? styles.statusSuccess : styles.statusWarning
                  }`}
                >
                  {auth.isEntrepriseVerified ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {auth.isEntrepriseVerified ? "Entreprise verifiee" : "Identification requise"}
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
                Accedez rapidement a vos parametres ou lancez une demande de mise a jour.
              </p>
              <div className={styles.sideActions}>
                <Button className={styles.primaryButton} onClick={() => navigate("/investisseur/parametres")}>
                  Ouvrir les parametres
                </Button>
                <Button variant="outline" className={styles.secondaryButton} onClick={handleEditBlocked}>
                  Demander une modification
                </Button>
              </div>
            </div>
          </aside>

          <main className={styles.main}>
            <div className={styles.hero}>
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>Mon profil</span>
                <h1 className={styles.title}>Gerez vos informations personnelles et professionnelles</h1>
                <p className={styles.subtitle}>
                  Consultez vos donnees de compte, votre entreprise et les informations
                  reglementaires dans une interface plus lisible et plus structurée.
                </p>
              </div>
              <div className={styles.heroActions}>
                <Button variant="outline" className={styles.secondaryButton} onClick={() => navigate("/investisseur/parametres")}>
                  Parametres
                </Button>
                <Button className={styles.primaryButton} onClick={handleEditBlocked}>
                  Modifier mes informations
                </Button>
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

            {auth.isEntrepriseVerified && entrepriseProfile && !isLoadingEntreprise ? (
              <>
                <section id="company" className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionLead}>
                      <div className={styles.sectionIcon}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={styles.sectionEyebrow}>Entreprise</span>
                        <h2 className={styles.sectionTitle}>Informations juridiques</h2>
                        <p className={styles.sectionText}>
                          Les informations principales de la societe rattachee a votre compte.
                        </p>
                      </div>
                    </div>
                    <span className={`${styles.sectionBadge} ${styles.sectionBadgeSuccess}`}>
                      Verifiee
                    </span>
                  </div>

                  <div className={styles.fieldGrid}>
                    <ProfileField
                      label="Nom societe (FR)"
                      value={detenteur?.nom_societeFR || "Non renseigne"}
                      icon={<Building2 className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Nom societe (AR)"
                      value={detenteur?.nom_societeAR || "Non renseigne"}
                      icon={<Building2 className="w-4 h-4" />}
                      rtl
                    />
                    <ProfileField label="Statut juridique" value={statutJuridique} icon={<Shield className="w-4 h-4" />} />
                    <ProfileField
                      label="Nationalite"
                      value={detenteur?.nationaliteRef?.libelle || "Non renseigne"}
                      icon={<Globe2 className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Pays"
                      value={detenteur?.pays?.nom_pays || "Non renseigne"}
                      icon={<MapPin className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Telephone"
                      value={detenteur?.telephone || "Non renseigne"}
                      icon={<Phone className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Email"
                      value={detenteur?.email || "Non renseigne"}
                      icon={<Mail className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Date de constitution"
                      value={formatDate(detenteur?.date_constitution)}
                      icon={<Calendar className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Adresse complete"
                      value={detenteur?.adresse_siege || "Non renseigne"}
                      icon={<MapPin className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                </section>

                <section id="representative" className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionLead}>
                      <div className={styles.sectionIcon}>
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={styles.sectionEyebrow}>Representant</span>
                        <h2 className={styles.sectionTitle}>Representant legal</h2>
                        <p className={styles.sectionText}>
                          Personne habilitee a representer l'entreprise dans les demarches.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.fieldGrid}>
                    <ProfileField
                      label="Nom complet (FR)"
                      value={
                        representant
                          ? `${representant.prenomFR || ""} ${representant.nomFR || ""}`.trim() || "Non renseigne"
                          : "Non renseigne"
                      }
                      icon={<User className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Nom complet (AR)"
                      value={
                        representant
                          ? `${representant.prenomAR || ""} ${representant.nomAR || ""}`.trim() || "Non renseigne"
                          : "Non renseigne"
                      }
                      icon={<User className="w-4 h-4" />}
                      rtl
                    />
                    <ProfileField
                      label="Qualite"
                      value={representant?.qualification || "Non renseigne"}
                      icon={<Briefcase className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Nationalite"
                      value={representant?.nationaliteRef?.libelle || "Non renseigne"}
                      icon={<Globe2 className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Telephone"
                      value={representant?.telephone || "Non renseigne"}
                      icon={<Phone className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Email"
                      value={representant?.email || "Non renseigne"}
                      icon={<Mail className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="NIN"
                      value={representant?.num_carte_identite || "Non renseigne"}
                      icon={<Shield className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                </section>

                <section id="registry" className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionLead}>
                      <div className={styles.sectionIcon}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={styles.sectionEyebrow}>Registre</span>
                        <h2 className={styles.sectionTitle}>Registre de commerce</h2>
                        <p className={styles.sectionText}>
                          Informations legales et fiscales declarees pour votre entreprise.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.fieldGrid}>
                    <ProfileField label="Numero RC" value={registre?.numero_rc || "Non renseigne"} icon={<FileText className="w-4 h-4" />} />
                    <ProfileField
                      label="Date d'enregistrement"
                      value={formatDate(registre?.date_enregistrement)}
                      icon={<Calendar className="w-4 h-4" />}
                    />
                    <ProfileField
                      label="Capital social"
                      value={formatCurrency(registre?.capital_social)}
                      icon={<Building2 className="w-4 h-4" />}
                    />
                    <ProfileField label="Numero NIS" value={registre?.nis || "Non renseigne"} icon={<Shield className="w-4 h-4" />} />
                    <ProfileField label="Numero NIF" value={registre?.nif || "Non renseigne"} icon={<Shield className="w-4 h-4" />} />
                    <ProfileField
                      label="Adresse du siege"
                      value={registre?.adresse_legale || "Non renseigne"}
                      icon={<MapPin className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                </section>

                <section id="shareholders" className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionLead}>
                      <div className={styles.sectionIcon}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={styles.sectionEyebrow}>Gouvernance</span>
                        <h2 className={styles.sectionTitle}>Actionnaires declares</h2>
                        <p className={styles.sectionText}>
                          Consultez les personnes declarees ainsi que leur taux de participation.
                        </p>
                      </div>
                    </div>
                  </div>

                  {actionnaires.length === 0 ? (
                    <div className={styles.emptyState}>
                      <AlertCircle className={styles.emptyStateIcon} />
                      <p className={styles.emptyStateText}>Aucun actionnaire renseigne.</p>
                    </div>
                  ) : (
                    <div className={styles.actionnaireGrid}>
                      {actionnaires.map((actionnaire: any, index: number) => {
                        const personne = actionnaire?.personne;
                        return (
                          <article
                            key={actionnaire.id_actionnaire || index}
                            className={styles.actionnaireCard}
                          >
                            <div className={styles.actionnaireHeader}>
                              <div className={styles.actionnaireAvatar}>
                                <Users className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className={styles.actionnaireName}>
                                  {personne
                                    ? `${personne.prenomFR || ""} ${personne.nomFR || ""}`.trim() || "Non renseigne"
                                    : "Non renseigne"}
                                </h3>
                                <p className={styles.actionnaireMeta}>
                                  {personne?.nationaliteRef?.libelle || "Non renseigne"}
                                </p>
                              </div>
                            </div>

                            <div className={styles.actionnaireFields}>
                              <div className={styles.actionnaireField}>
                                <span>Identite</span>
                                <strong>{personne?.num_carte_identite || "Non renseigne"}</strong>
                              </div>
                              <div className={styles.actionnaireField}>
                                <span>Taux</span>
                                <strong>
                                  {actionnaire?.taux_participation != null
                                    ? `${actionnaire.taux_participation}%`
                                    : "Non renseigne"}
                                </strong>
                              </div>
                              <div className={styles.actionnaireField}>
                                <span>Pays</span>
                                <strong>{personne?.pays?.nom_pays || "Non renseigne"}</strong>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section className={`${styles.sectionCard} ${styles.emptySection}`}>
                <div className={styles.emptyState}>
                  <AlertCircle className={styles.emptyStateIcon} />
                  <h2 className={styles.emptyStateTitle}>Identification entreprise incomplete</h2>
                  <p className={styles.emptyStateText}>
                    {isLoadingEntreprise
                      ? "Chargement des informations de l'entreprise..."
                      : loadError ||
                        "Completez l'identification de votre entreprise pour afficher le dossier complet."}
                  </p>
                  <div className={styles.noticeActions}>
                    <Button
                      className={styles.primaryButton}
                      onClick={() => navigate("/investisseur/Identification/identification-entreprise")}
                    >
                      Completer l'identification
                    </Button>
                    <Button variant="outline" className={styles.secondaryButton} onClick={() => navigate("/investisseur/parametres")}>
                      Ouvrir les parametres
                    </Button>
                  </div>
                </div>
              </section>
            )}

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
                Pour modifier des informations sensibles de compte ou d'entreprise, utilisez la
                procedure adaptee depuis votre espace investisseur ou contactez l'administration.
              </p>

              <div className={styles.noticeActions}>
                <Button variant="outline" className={styles.secondaryButton} onClick={handleEditBlocked}>
                  Demander une mise a jour
                </Button>
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
