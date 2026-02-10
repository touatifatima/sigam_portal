import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/src/hooks/use-toast";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Building2,
  FileText,
  Users,
  MapPin,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Image,
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

const Profil = () => {
  const navigate = useNavigate();
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [entrepriseProfile, setEntrepriseProfile] = useState<EntrepriseProfile | null>(null);
  const [isLoadingEntreprise, setIsLoadingEntreprise] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

    fetchEntreprise();
  }, [apiURL, auth.isEntrepriseVerified, isLoaded]);

  const handleEditBlocked = () => {
    toast({
      title: "Modification indisponible",
      description:
        "Pour modifier ces informations, veuillez soumettre une demande specifique (renonciation, amodiation, etc.).",
    });
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Non renseigne";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "Non renseigne";
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatCurrency = (amount?: number | string | null) => {
    if (amount === null || amount === undefined || String(amount).trim() === "") return "Non renseigne";
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const detenteur = entrepriseProfile?.detenteur;
  const representant = entrepriseProfile?.representant?.personne;
  const registre = entrepriseProfile?.registre;
  const actionnaires = entrepriseProfile?.actionnaires ?? [];
  const statutJuridique =
    detenteur?.FormeJuridiqueDetenteur?.[0]?.statutJuridique?.statut_fr ||
    detenteur?.FormeJuridiqueDetenteur?.[0]?.statutJuridique?.code_statut ||
    "Non renseigne";

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Mon Profil</h1>
          <p className={styles.subtitle}>
            Consultez vos informations personnelles et les details de votre entreprise
          </p>
        </div>

        <div className={styles.content}>
          <Card className={styles.card}>
            <CardHeader className={styles.cardHeader}>
              <div className={styles.cardTitleRow}>
                <CardTitle className={styles.cardTitle}>
                  <User className="w-5 h-5" />
                  Informations Personnelles
                </CardTitle>
                <Badge variant="secondary" className={styles.roleBadge}>
                  <Shield className="w-3 h-3 mr-1" />
                  {auth.role || "Investisseur"}
                </Badge>
              </div>
              <CardDescription>Vos informations de compte utilisateur</CardDescription>
            </CardHeader>
            <CardContent className={styles.cardContent}>
              <div className={styles.profileSection}>
                <div className={styles.avatarContainer}>
                  <div className={styles.avatar}>
                    <User className="w-12 h-12" />
                  </div>
                  <div className={styles.avatarInfo}>
                    <h3 className={styles.userName}>
                      {auth.Prenom || auth.nom
                        ? `${auth.Prenom ?? ""} ${auth.nom ?? ""}`.trim()
                        : auth.username || "Utilisateur"}
                    </h3>
                    <p className={styles.userEmail}>{auth.email || "email@exemple.com"}</p>
                  </div>
                  <Button variant="outline" size="sm" className={styles.editButton} onClick={handleEditBlocked}>
                    <Image className="w-4 h-4 mr-2" />
                    Modifier la photo
                  </Button>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <Mail className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>Email</span>
                      <span className={styles.infoValue}>{auth.email || "Non renseigne"}</span>
                    </div>
                  </div>

                  <div className={styles.infoItem}>
                    <Phone className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>Telephone</span>
                      <span className={styles.infoValue}>
                        {auth.telephone || "Non renseigne"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoItem}>
                    <Calendar className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>Date d'inscription</span>
                      <span className={styles.infoValue}>
                        {formatDate(auth.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoItem}>
                    <Shield className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>Role</span>
                      <span className={styles.infoValue}>{auth.role || "Investisseur"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {auth.isEntrepriseVerified && entrepriseProfile && !isLoadingEntreprise ? (
            <>
              <Card className={styles.card}>
                <CardHeader className={styles.cardHeader}>
                  <div className={styles.cardTitleRow}>
                    <CardTitle className={styles.cardTitle}>
                      <Building2 className="w-5 h-5" />
                      Informations Entreprise
                    </CardTitle>
                    <Badge className={styles.confirmedBadge}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Confirmee
                    </Badge>
                  </div>
                  <CardDescription>Details de votre societe identifiee</CardDescription>
                </CardHeader>
                <CardContent className={styles.cardContent}>
                  <div className={styles.entrepriseGrid}>
                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Nom societe (FR)</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.nom_societeFR || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Nom societe (AR)</span>
                      <span className={`${styles.entrepriseValue} ${styles.arabicText}`}>
                        {detenteur?.nom_societeAR || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Statut juridique</span>
                      <span className={styles.entrepriseValue}>{statutJuridique}</span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Nationalite</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.nationaliteRef?.libelle || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Pays</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.pays?.nom_pays || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Telephone</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.telephone || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Email</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.email || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Fax</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.fax || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Site web</span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.site_web || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Date de constitution</span>
                      <span className={styles.entrepriseValue}>
                        {formatDate(detenteur?.date_constitution)}
                      </span>
                    </div>

                    <div className={`${styles.entrepriseItem} ${styles.fullWidth}`}>
                      <span className={styles.entrepriseLabel}>
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Adresse complete
                      </span>
                      <span className={styles.entrepriseValue}>
                        {detenteur?.adresse_siege || "Non renseigne"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={styles.card}>
                <CardHeader className={styles.cardHeader}>
                  <CardTitle className={styles.cardTitle}>
                    <Briefcase className="w-5 h-5" />
                    Representant Legal
                  </CardTitle>
                  <CardDescription>Personne habilitee a representer l'entreprise</CardDescription>
                </CardHeader>
                <CardContent className={styles.cardContent}>
                  <div className={styles.entrepriseGrid}>
                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Nom complet (FR)</span>
                      <span className={styles.entrepriseValue}>
                        {representant
                          ? `${representant.prenomFR || ""} ${representant.nomFR || ""}`.trim() || "Non renseigne"
                          : "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Nom complet (AR)</span>
                      <span className={`${styles.entrepriseValue} ${styles.arabicText}`}>
                        {representant
                          ? `${representant.prenomAR || ""} ${representant.nomAR || ""}`.trim() || "Non renseigne"
                          : "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Qualite</span>
                      <span className={styles.entrepriseValue}>
                        {representant?.qualification || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Nationalite</span>
                      <span className={styles.entrepriseValue}>
                        {representant?.nationaliteRef?.libelle || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Telephone</span>
                      <span className={styles.entrepriseValue}>
                        {representant?.telephone || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Email</span>
                      <span className={styles.entrepriseValue}>
                        {representant?.email || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>NIN</span>
                      <span className={styles.entrepriseValue}>
                        {representant?.num_carte_identite || "Non renseigne"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={styles.card}>
                <CardHeader className={styles.cardHeader}>
                  <CardTitle className={styles.cardTitle}>
                    <FileText className="w-5 h-5" />
                    Registre de Commerce
                  </CardTitle>
                  <CardDescription>Informations legales et fiscales</CardDescription>
                </CardHeader>
                <CardContent className={styles.cardContent}>
                  <div className={styles.entrepriseGrid}>
                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Numero RC</span>
                      <span className={styles.entrepriseValue}>
                        {registre?.numero_rc || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Date d'enregistrement</span>
                      <span className={styles.entrepriseValue}>
                        {formatDate(registre?.date_enregistrement)}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Capital social</span>
                      <span className={styles.entrepriseValue}>
                        {formatCurrency(registre?.capital_social)}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Numero NIS</span>
                      <span className={styles.entrepriseValue}>
                        {registre?.nis || "Non renseigne"}
                      </span>
                    </div>

                    <div className={styles.entrepriseItem}>
                      <span className={styles.entrepriseLabel}>Numero NIF</span>
                      <span className={styles.entrepriseValue}>
                        {registre?.nif || "Non renseigne"}
                      </span>
                    </div>

                    <div className={`${styles.entrepriseItem} ${styles.fullWidth}`}>
                      <span className={styles.entrepriseLabel}>
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Adresse du siege
                      </span>
                      <span className={styles.entrepriseValue}>
                        {registre?.adresse_legale || "Non renseigne"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={styles.card}>
                <CardHeader className={styles.cardHeader}>
                  <CardTitle className={styles.cardTitle}>
                    <Users className="w-5 h-5" />
                    Actionnaires
                  </CardTitle>
                  <CardDescription>Liste des actionnaires declares</CardDescription>
                </CardHeader>
                <CardContent className={styles.cardContent}>
                  {actionnaires.length === 0 ? (
                    <div className={styles.notConfirmedContent}>
                      <AlertCircle className={styles.notConfirmedIcon} />
                      <p className={styles.notConfirmedText}>Aucun actionnaire renseigne.</p>
                    </div>
                  ) : (
                    <div className={styles.actionnairesList}>
                      {actionnaires.map((actionnaire: any, index: number) => {
                        const personne = actionnaire?.personne;
                        return (
                          <div key={actionnaire.id_actionnaire || index} className={styles.actionnaireCard}>
                            <div className={styles.actionnaireHeader}>
                              <div className={styles.actionnaireAvatar}>
                                <Users className="w-4 h-4" />
                              </div>
                              <div className={styles.actionnaireInfo}>
                                <div className={styles.actionnaireName}>
                                  {personne
                                    ? `${personne.prenomFR || ""} ${personne.nomFR || ""}`.trim() || "Non renseigne"
                                    : "Non renseigne"}
                                </div>
                                <div className={styles.actionnaireNationalite}>
                                  {personne?.nationaliteRef?.libelle || "Non renseigne"}
                                </div>
                              </div>
                            </div>
                            <div className={styles.actionnaireDetails}>
                              <div className={styles.actionnaireDetail}>
                                <span>Identite</span>
                                <strong>{personne?.num_carte_identite || "Non renseigne"}</strong>
                              </div>
                              <div className={styles.actionnaireDetail}>
                                <span>Taux</span>
                                <strong>
                                  {actionnaire?.taux_participation != null
                                    ? `${actionnaire.taux_participation}%`
                                    : "Non renseigne"}
                                </strong>
                              </div>
                              <div className={styles.actionnaireDetail}>
                                <span>Pays</span>
                                <strong>{personne?.pays?.nom_pays || "Non renseigne"}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className={styles.actions}>
                <Button variant="outline" className={styles.editButton} onClick={handleEditBlocked}>
                  Modifier mes informations
                </Button>
                <Button variant="outline" className={styles.editButton} onClick={handleEditBlocked}>
                  Mettre a jour l'entreprise
                </Button>
              </div>
            </>
          ) : (
            <Card className={styles.card}>
              <CardContent className={styles.notConfirmedContent}>
                <AlertCircle className={styles.notConfirmedIcon} />
                <h3 className={styles.notConfirmedTitle}>
                  Identification entreprise incomplete
                </h3>
                <p className={styles.notConfirmedText}>
                  {isLoadingEntreprise
                    ? "Chargement des informations de l'entreprise..."
                    : loadError ||
                      "Vous devez completer l'identification de votre entreprise pour acceder a toutes les fonctionnalites."}
                </p>
                <Button
                  onClick={() => navigate("/investisseur/Identification/identification-entreprise")}
                  className={styles.completeButton}
                >
                  Completer l'identification
                </Button>
              </CardContent>
            </Card>
          )}

          {auth.isEntrepriseVerified && entrepriseProfile && !isLoadingEntreprise && (
            <>
              <Separator />
              <div className={styles.notConfirmedContent}>
                <AlertCircle className={styles.notConfirmedIcon} />
                <p className={styles.notConfirmedText}>
                  Pour modifier ces informations, veuillez soumettre une demande specifique (renonciation, amodiation, etc.).
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </InvestorLayout>
  );
};

export default Profil;
