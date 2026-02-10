import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  CheckCircle, 
  Download, 
  Mail, 
  Home, 
  FileText, 
  Calendar, 
  CreditCard,
  Building,
  Hash,
  Clock
} from "lucide-react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { toast } from "react-toastify";
import styles from "./confirmationpay.module.css";

interface ConfirmationData {
  codedemande: string;
  montant: number;
  societe: string;
  typePermis: string;
  transactionId: string;
  datePaiement: string;
  dernierChiffres: string;
  paymentMethod?: string;
}

const ConfirmationPaiement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const stateData = (location.state as Partial<ConfirmationData> & { idProc?: number | string }) || {};
  const [idProc, setIdProc] = useState<number | null>(null);
  const [idDemande, setIdDemande] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const confirmToastRef = useRef(false);

  const [data, setData] = useState<ConfirmationData>(() => ({
    codedemande: stateData.codedemande || "--",
    montant: typeof stateData.montant === "number" ? stateData.montant : 0,
    societe: stateData.societe || "--",
    typePermis: stateData.typePermis || "--",
    transactionId: stateData.transactionId || `TXN-${Date.now()}`,
    datePaiement: stateData.datePaiement || new Date().toISOString(),
    dernierChiffres: stateData.dernierChiffres || "----",
    paymentMethod: stateData.paymentMethod || "Carte Adahabia",
  }));

  const mergeData = (next: Partial<ConfirmationData>) => {
    setData((prev) => {
      const updated = { ...prev };
      Object.entries(next).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === "string" && value.trim() === "") return;
        (updated as any)[key] = value;
      });
      return updated;
    });
  };

  const coerceNumber = (value: any): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[\s\u00A0\u202F]/g, "").replace(",", ".");
      const num = Number(cleaned);
      if (Number.isFinite(num)) return num;
    }
    return null;
  };

  const pickName = (obj: any, keys: string[]): string | null => {
    if (!obj) return null;
    if (typeof obj === "string") return obj;
    for (const key of keys) {
      const val = obj?.[key];
      if (typeof val === "string" && val.trim() !== "") return val;
    }
    return null;
  };

  const formatPersonName = (obj: any): string | null => {
    if (!obj) return null;
    if (typeof obj === "string") return obj;
    const company = pickName(obj, [
      "nom_societeFR",
      "nom_societeAR",
      "nom_societe",
      "raison_sociale",
      "nom_entreprise",
      "nomEntreprise",
    ]);
    if (company) return company;
    const nom = pickName(obj, ["nom", "nom_fr", "nom_ar", "nom_responsable", "nom_gerant"]);
    const prenom = pickName(obj, ["prenom", "prenom_fr", "prenom_ar"]);
    if (nom && prenom) return `${nom} ${prenom}`.trim();
    return nom || prenom || null;
  };

  const resolveTitulaire = (payload: any): string | null => {
    const candidates = [
      payload?.titulaire,
      payload?.detenteur,
      payload?.detenteurdemande?.[0]?.detenteur,
      payload?.demandeur,
      payload?.societe,
      payload?.entreprise,
      payload?.personne_morale,
      payload?.personneMorale,
      payload?.personne_physique,
      payload?.personnePhysique,
    ];
    for (const candidate of candidates) {
      const name = formatPersonName(candidate);
      if (name) return name;
    }
    return null;
  };

  const resolveTypePermis = (payload: any): string | null => {
    return (
      payload?.typePermis?.lib_type ||
      payload?.typePermis?.libelle ||
      payload?.typePermis?.label ||
      payload?.typePermis?.code_type ||
      payload?.typePermis?.code ||
      payload?.type_permis ||
      null
    );
  };


  const isPlaceholder = (value?: string | null) => {
    if (!value) return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed === "--" || trimmed === "—" || trimmed === "?") return true;
    return /^n\/?a$/i.test(trimmed);
  };

  useEffect(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id")
        : null;
    const fromState = stateData?.idProc != null ? String(stateData.idProc) : null;
    const raw = fromQuery || fromState;
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) setIdProc(parsed);
    }
  }, [stateData?.idProc]);

  useEffect(() => {
    mergeData({
      codedemande: stateData.codedemande,
      montant: typeof stateData.montant === "number" ? stateData.montant : undefined,
      societe: stateData.societe,
      typePermis: stateData.typePermis,
      transactionId: stateData.transactionId,
      datePaiement: stateData.datePaiement,
      dernierChiffres: stateData.dernierChiffres,
      paymentMethod: stateData.paymentMethod,
    });
  }, [
    stateData.codedemande,
    stateData.montant,
    stateData.societe,
    stateData.typePermis,
    stateData.transactionId,
    stateData.datePaiement,
    stateData.dernierChiffres,
    stateData.paymentMethod,
  ]);

  useEffect(() => {
    if (!idProc || !apiURL) return;
    let active = true;
    setIsLoading(true);
    axios
      .get(`${apiURL}/api/procedures/${idProc}/demande`, { withCredentials: true })
      .then((res) => {
        if (!active) return;
        const payload = res.data ?? {};
        if (payload?.id_demande != null) {
          setIdDemande(Number(payload.id_demande));
        }
        const societe = resolveTitulaire(payload);
        const typePermis = resolveTypePermis(payload);
        mergeData({
          codedemande: payload.code_demande ?? payload.codeDemande,
          societe: societe ?? undefined,
          typePermis: typePermis ?? undefined,
        });
      })
      .catch((error) => {
        console.warn("[ConfirmationPay] demande fetch failed", error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [idProc, apiURL]);

  useEffect(() => {
    if (!idDemande || !apiURL) return;
    let active = true;
    axios
      .get(`${apiURL}/api/demande/${idDemande}/summary`, { withCredentials: true })
      .then((res) => {
        if (!active) return;
        const payload = res.data ?? {};
        const societe = resolveTitulaire(payload);
        const typePermis = resolveTypePermis(payload);
        mergeData({
          codedemande: payload.code_demande ?? payload.codeDemande,
          societe: societe ?? undefined,
          typePermis: typePermis ?? undefined,
        });
      })
      .catch((error) => {
        console.warn("[ConfirmationPay] summary fetch failed", error);
      });
    return () => {
      active = false;
    };
  }, [idDemande, apiURL]);

  useEffect(() => {
    if (!idDemande || !apiURL) return;
    if (confirmToastRef.current) return;
    confirmToastRef.current = true;
    const confirmPayment = async () => {
      try {
        await axios.patch(
          `${apiURL}/payments/confirm-demande/${idDemande}`,
          {},
          { withCredentials: true },
        );
      } catch (error) {
        console.warn("[ConfirmationPay] failed to confirm paiement date", error);
      } finally {
        toast.success(
          <div className={styles.successToastContent}>
            <div className={styles.successToastTitle}>Paiement confirmé avec succès !</div>
            <div className={styles.successToastText}>
              Votre demande a bien été enregistrée et est en cours de traitement. Vous recevrez une confirmation officielle sous peu.
            </div>
          </div>,
          {
            position: "top-center",
            autoClose: 7000,
            closeOnClick: true,
            pauseOnHover: true,
          className: styles.successToast,
        });
      }
    };
    confirmPayment();
  }, [idDemande, apiURL]);


  useEffect(() => {
    if (!idDemande || !apiURL) return;
    let active = true;
    const loadFacture = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/facture/demande/${idDemande}`);
        if (!active) return;
        if (res.data?.facture) {
          const montant = coerceNumber(res.data.facture.montant_total);
          if (montant != null) mergeData({ montant });
          return;
        }
        const generated = await axios.post(
          `${apiURL}/api/facture/investisseur/generer`,
          { id_demande: Number(idDemande) },
          { withCredentials: true },
        );
        if (!active) return;
        const montant = coerceNumber(generated.data?.facture?.montant_total);
        if (montant != null) mergeData({ montant });
      } catch (error) {
        console.warn("[ConfirmationPay] facture fetch failed", error);
      }
    };
    loadFacture();
    return () => {
      active = false;
    };
  }, [idDemande, apiURL]);

  useEffect(() => {
    if (!apiURL) return;
    let active = true;
    axios
      .get(`${apiURL}/api/profil/entreprise`, { withCredentials: true })
      .then((res) => {
        if (!active) return;
        const societe = resolveTitulaire(res.data ?? {});
        if (societe && (isPlaceholder(data.societe) || societe.trim() != data.societe.trim())) {
          mergeData({ societe });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [apiURL, data.societe]);

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('fr-DZ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const sanitizeText = (value: string) => value.replace(/[\u00A0\u202F]/g, " ");

  const formattedMontant = useMemo(() => {
    if (typeof data.montant === "number" && Number.isFinite(data.montant)) {
      return data.montant.toLocaleString("fr-DZ");
    }
    return "0";
  }, [data.montant]);


  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // En-tête
    doc.setFillColor(139, 58, 98); // Couleur primary mauve
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("SIGAM - Confirmation de Paiement", pageWidth / 2, 25, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Agence Nationale des Activités Minières", pageWidth / 2, 35, { align: "center" });
    
    // Badge de succès
    doc.setTextColor(34, 139, 34);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("✓ PAIEMENT RÉUSSI", pageWidth / 2, 60, { align: "center" });
    
    // Informations de la transaction
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Détails de la transaction", 20, 80);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 85, pageWidth - 20, 85);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const leftCol = 25;
    const rightCol = 85;
    let yPos = 95;
    const lineHeight = 10;
    
    // Détails
    const details = [
      { label: "N° Transaction:", value: data.transactionId },
      { label: "Code Demande:", value: data.codedemande },
      { label: "Date et Heure:", value: formatDate(data.datePaiement) },
      { label: "Montant payé:", value: `${formattedMontant} DA` },
      { label: "Mode de paiement:", value: `${data.paymentMethod || "Carte Adahabia"} ****${data.dernierChiffres}` },
      { label: "Titulaire:", value: data.societe },
      { label: "Type de permis:", value: data.typePermis },
    ];
    
    details.forEach((item) => {
      doc.setFont("helvetica", "bold");
      doc.text(sanitizeText(item.label), leftCol, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(sanitizeText(item.value), rightCol, yPos);
      yPos += lineHeight;
    });
    
    // Ligne de séparation
    yPos += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    
    // Message d'information
    yPos += 15;
    doc.setFillColor(240, 240, 250);
    doc.roundedRect(20, yPos, pageWidth - 40, 35, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const infoText = [
      "Ce document constitue une preuve de paiement officielle.",
      "Veuillez le conserver pour vos archives.",
      "Pour toute question, contactez-nous à: anam@anam.gov.dz"
    ];
    
    yPos += 10;
    infoText.forEach((line) => {
      doc.text(line, pageWidth / 2, yPos, { align: "center" });
      yPos += 8;
    });
    
    // Pied de page
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "SIGAM - Système Intégré de Gestion des Activités Minières",
      pageWidth / 2,
      280,
      { align: "center" }
    );
    doc.text(
      `Document généré le ${new Date().toLocaleDateString('fr-DZ')}`,
      pageWidth / 2,
      286,
      { align: "center" }
    );
    
    // Télécharger le PDF
    doc.save(`recu-paiement-${data.codedemande || "demande"}.pdf`);
  };

  const handleSendEmail = () => {
    // Simulation d'envoi par email
    // Dans une vraie implémentation, appeler une API
    alert("Un email de confirmation a été envoyé à votre adresse email enregistrée.");
  };

  const handleGoToDashboard = () => {
    navigate("/investisseur/InvestorDashboard");
  };

  const handleViewDemandes = () => {
    navigate("/investisseur/demandes");
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Animation de succès */}
        <div className={styles.successAnimation}>
          <div className={styles.checkCircle}>
            <CheckCircle size={48} />
          </div>
        </div>

        {/* Message de succès */}
        <div className={styles.header}>
          <h1 className={styles.title}>Paiement effectué avec succès !</h1>
          <p className={styles.subtitle}>
            Votre transaction a été traitée. Un reçu vous sera envoyé par email.
          </p>
        </div>

        {/* Carte de confirmation */}
        <div className={styles.confirmationCard}>
          <div className={styles.cardHeader}>
            <FileText className={styles.cardIcon} size={24} />
            <h2 className={styles.cardTitle}>Détails du paiement</h2>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Hash size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>N° Transaction</span>
                <span className={styles.detailValue}>{data.transactionId}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <FileText size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Code Demande</span>
                <span className={styles.detailValue}>{data.codedemande}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Calendar size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Date & Heure</span>
                <span className={styles.detailValue}>{formatDate(data.datePaiement)}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <CreditCard size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Mode de paiement</span>
                <span className={styles.detailValue}>{data.paymentMethod || "Carte Adahabia"} ****{data.dernierChiffres}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Building size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Titulaire</span>
                <span className={styles.detailValue}>{data.societe}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Clock size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Type de permis</span>
                <span className={styles.detailValue}>{data.typePermis}</span>
              </div>
            </div>
          </div>

          {/* Montant total */}
          <div className={styles.totalSection}>
            <span className={styles.totalLabel}>Montant payé</span>
            <span className={styles.totalAmount}>{formattedMontant} DA</span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleDownloadPDF} disabled={isLoading}>
            <Download size={18} />
            Télécharger le reçu PDF
          </button>
          
          <button className={styles.btnSecondary} onClick={handleSendEmail} disabled={isLoading}>
            <Mail size={18} />
            Envoyer par email
          </button>
        </div>

        {/* Navigation */}
        <div className={styles.navigation}>
          <button className={styles.navButton} onClick={handleGoToDashboard}>
            <Home size={18} />
            Retour au tableau de bord
          </button>
          <button className={styles.navButton} onClick={handleViewDemandes}>
            <FileText size={18} />
            Voir mes demandes
          </button>
        </div>

        {/* Message d'info */}
        <div className={styles.infoBox}>
          <p>
            <strong>Prochaines étapes :</strong> Votre demande est maintenant en cours de traitement. 
            Vous recevrez une notification par email dès qu'une mise à jour sera disponible.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPaiement;
