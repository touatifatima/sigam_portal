import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepIdentification } from "@/components/wizard/steps/StepIdentification";
import { useToast } from "@/src/hooks/use-toast";
import { Building2, CheckCircle, ChevronRight, Download, LogOut } from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./IdentificationEntreprise.module.css";
import { useAuthStore } from "@/src/store/useAuthStore";
import { getDefaultDashboardPath, isCadastreRole } from "@/src/utils/roleNavigation";

type IdentificationPayload = Record<string, unknown> & {
  actionnaires?: Array<Record<string, unknown>>;
};

const FIELD_LABELS: Record<string, string> = {
  nomSocieteFr: "Nom societe (FR)",
  nomSocieteAr: "Nom societe (AR)",
  statutJuridique: "Statut juridique",
  statutDetenteur: "Statut du detenteur",
  pays: "Pays",
  telephone: "Telephone",
  email: "Email",
  siteWeb: "Site web",
  numeroFax: "Numero de fax",
  adresseComplete: "Adresse complete",
  nationalite: "Nationalite",
  dateConstitution: "Date de constitution",
  representantNomFr: "Representant nom (FR)",
  representantPrenomFr: "Representant prenom (FR)",
  representantNomAr: "Representant nom (AR)",
  representantPrenomAr: "Representant prenom (AR)",
  representantTelephone: "Representant telephone",
  representantEmail: "Representant email",
  representantFax: "Representant fax",
  representantQualite: "Representant qualite",
  representantNationalite: "Representant nationalite",
  representantPays: "Representant pays",
  representantNIN: "Representant NIN",
  representantTauxParticipation: "Taux participation representant",
  numeroRC: "Numero RC",
  dateEnregistrement: "Date enregistrement",
  capitalSocial: "Capital social",
  numeroNIS: "Numero NIS",
  adresseSiege: "Adresse siege",
  numeroNIF: "Numero NIF",
};

const toLabel = (key: string): string =>
  FIELD_LABELS[key] ??
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" ? JSON.stringify(item) : String(item ?? ""),
      )
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const IdentificationEntreprise = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedForReview, setIsSubmittedForReview] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedPayload, setSubmittedPayload] = useState<IdentificationPayload | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [goodbyeMessage, setGoodbyeMessage] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const setEntrepriseVerified = useAuthStore((s) => s.setEntrepriseVerified);
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const handleUpdate = useCallback((data: any) => {
    setFormData(data);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isCadastreRole(auth.role) || auth.isEntrepriseVerified) {
      navigate(getDefaultDashboardPath(auth.role), { replace: true });
    }
  }, [auth.isEntrepriseVerified, auth.role, isLoaded, navigate]);

  const handleConfirm = async () => {
    setIsSubmitting(true);

    try {
      const payload = JSON.parse(
        JSON.stringify((formData?.identification ?? formData) || {}),
      ) as IdentificationPayload;
      if (!apiURL) {
        throw new Error("API URL manquante");
      }

      await axios.post(`${apiURL}/api/investisseur/identification`, payload, {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
      });

      setEntrepriseVerified(false);
      setIsSubmittedForReview(true);
      setSubmittedPayload(payload);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Erreur enregistrement entreprise:", error);
      const err = error as any;
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Echec de l'enregistrement de l'entreprise.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadIdentificationPdf = async () => {
    if (!submittedPayload || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFontSize(16);
      doc.setTextColor(45, 27, 39);
      doc.text("Recapitulatif d'identification entreprise", 14, 16);
      doc.setFontSize(10);
      doc.setTextColor(107, 77, 94);
      doc.text(`Date: ${new Date().toLocaleString("fr-FR")}`, 14, 22);

      const mainRows = Object.entries(submittedPayload)
        .filter(([key]) => key !== "actionnaires")
        .map(([key, value]) => [toLabel(key), toDisplayValue(value)])
        .filter(([, value]) => value);

      autoTable(doc, {
        startY: 28,
        head: [["Champ", "Valeur"]],
        body: mainRows.length ? mainRows : [["Information", "Aucune valeur renseignee"]],
        headStyles: { fillColor: [139, 58, 98], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: "bold" },
          1: { cellWidth: "auto" },
        },
      });

      const actionnaires = Array.isArray(submittedPayload.actionnaires)
        ? submittedPayload.actionnaires
        : [];

      if (actionnaires.length > 0) {
        const body = actionnaires.map((actionnaire, index) => [
          `Actionnaire ${index + 1}`,
          toDisplayValue(actionnaire.nom),
          toDisplayValue(actionnaire.prenom),
          toDisplayValue(actionnaire.nationalite),
          toDisplayValue(actionnaire.tauxParticipation),
          toDisplayValue(actionnaire.pays),
        ]);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 8,
          head: [[
            "Actionnaire",
            "Nom",
            "Prenom",
            "Nationalite",
            "Taux %",
            "Pays",
          ]],
          body,
          headStyles: { fillColor: [22, 128, 136], textColor: [255, 255, 255] },
          styles: { fontSize: 8.5, cellPadding: 2 },
        });
      }

      doc.save(`identification-entreprise-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("Erreur generation PDF identification:", error);
      toast({
        title: "Erreur",
        description: "Impossible de generer le PDF pour le moment.",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const performLogout = async () => {
    try {
      if (apiURL) {
        await axios.post(`${apiURL}/auth/logout`, {}, { withCredentials: true });
      }
    } catch (error) {
      console.warn("Logout API warning:", error);
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth");
      window.localStorage.removeItem("auth-storage");
    }

    useAuthStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        token: null,
        id: null,
        username: null,
        email: null,
        nom: null,
        Prenom: null,
        telephone: null,
        createdAt: null,
        role: null,
        permissions: [],
        isEntrepriseVerified: false,
        identificationStatus: null,
        firstLoginAfterConfirmation: false,
      },
      isLoaded: true,
    }));

  };

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setGoodbyeMessage("A bientot sur le Portail ANAM");

    await performLogout();

    window.setTimeout(() => {
      setShowSuccessModal(false);
      navigate("/auth/login");
    }, 1100);
  };

  const handleOpenLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const handleCloseLogoutModal = () => {
    if (isLoggingOut) return;
    setShowLogoutModal(false);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await performLogout();
    setShowLogoutModal(false);
    navigate("/auth/login");
  };

  return (
    <InvestorLayout hideNavbar>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              <Building2 className={styles.icon} />
            </div>
            <h1 className={styles.title}>Confirmation de votre entreprise</h1>
            <p className={styles.subtitle}>
              Pour acceder a l'espace investisseur, veuillez confirmer les informations de votre entreprise
            </p>
            {isSubmittedForReview && (
              <div className={styles.pendingNotice}>
                Votre dossier a ete transmis a l'administration ANAM. Vous recevrez une
                notification apres verification.
              </div>
            )}
          </div>

          {/* Form Card */}
          <Card className={styles.card}>
            <CardHeader className={styles.cardHeader}>
              <CardTitle className={styles.cardTitle}>
                <CheckCircle className={styles.sectionIcon} />
                Informations de l'entreprise
              </CardTitle>
              <CardDescription className={styles.cardDescription}>
                Remplissez les informations ci-dessous pour valider votre compte entreprise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StepIdentification data={formData} onUpdate={handleUpdate} />
              
              <div className={styles.actions}>
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  size="lg"
                  className={styles.confirmButton}
                >
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner}></span>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      Envoyer pour verification
                      <ChevronRight className={styles.actionIcon} />
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleOpenLogoutModal}
                  disabled={isSubmitting || isLoggingOut}
                  size="lg"
                  className={styles.logoutMainButton}
                >
                  <LogOut className={styles.logoutActionIcon} />
                  {isLoggingOut ? "Deconnexion..." : "Deconnexion du compte"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {showSuccessModal && (
          <div className={styles.successOverlay}>
            <div className={styles.successModal} role="dialog" aria-modal="true">
              <div className={styles.successIconWrap}>
                <CheckCircle className={styles.successIcon} />
              </div>
              <h2 className={styles.successTitle}>
                Demande d&apos;identification envoyee avec succes
              </h2>
              <p className={styles.successText}>
                Votre identification d&apos;entreprise a ete transmise a l&apos;administration ANAM.
              </p>
              <p className={styles.successText}>
                Vous recevrez une reponse par email dans les plus brefs delais
                (generalement sous 48h).
              </p>
              <p className={styles.successText}>
                En attendant, nous avons prepare un recapitulatif de vos informations.
              </p>

              <div className={styles.successActions}>
                <button
                  type="button"
                  className={styles.downloadButton}
                  onClick={() => void downloadIdentificationPdf()}
                  disabled={isDownloadingPdf || isFinishing}
                >
                  <Download size={18} />
                  {isDownloadingPdf ? "Generation du PDF..." : "Telecharger le PDF"}
                </button>
                <button
                  type="button"
                  className={styles.finishButton}
                  onClick={() => void handleFinish()}
                  disabled={isFinishing}
                >
                  <LogOut size={18} />
                  {isFinishing ? "Finalisation..." : "Terminer"}
                </button>
              </div>

              {goodbyeMessage && (
                <p className={styles.goodbyeMessage}>{goodbyeMessage}</p>
              )}
            </div>
          </div>
        )}

        {showLogoutModal && (
          <div
            className={styles.logoutOverlay}
            onClick={handleCloseLogoutModal}
            role="presentation"
          >
            <div
              className={styles.logoutModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.logoutModalHeader}>
                <h3 id="logout-modal-title" className={styles.logoutModalTitle}>
                  Deconnexion du compte
                </h3>
              </div>

              <div className={styles.logoutModalBody}>
                <p className={styles.logoutModalPrimaryText}>
                  Etes-vous sur(e) de vouloir vous deconnecter ?
                </p>
                <p className={styles.logoutModalSecondaryText}>
                  Vous pourrez vous reconnecter a ce compte ulterieurement pour finaliser
                  l&apos;identification et la verification de votre entreprise.
                </p>
              </div>

              <div className={styles.logoutModalActions}>
                <button
                  type="button"
                  className={styles.logoutModalCancel}
                  onClick={handleCloseLogoutModal}
                  disabled={isLoggingOut}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className={styles.logoutModalConfirm}
                  onClick={() => void handleConfirmLogout()}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Deconnexion..." : "Oui, me deconnecter"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </InvestorLayout>
  );
};

export default IdentificationEntreprise;
