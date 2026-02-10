import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CreditCard, Lock, ArrowLeft, Shield, CheckCircle, AlertCircle } from "lucide-react";
import axios from "axios";
import styles from "./PaiementAdahabia.module.css";

interface PaymentData {
  codedemande: string;
  montant: number;
  societe: string;
  typePermis: string;
}

const PaiementAdahabia = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const idProc = searchParams?.get("id") ?? null;
  const permisParam = searchParams?.get("permisId") ?? null;
  const numericIdProc = idProc ? Number(idProc) : null;
  const stateData = (location.state as Partial<PaymentData>) || {};

  const [idDemande, setIdDemande] = useState<number | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [paymentData, setPaymentData] = useState<PaymentData>(() => ({
    codedemande: stateData.codedemande || "--",
    montant: typeof stateData.montant === "number" ? stateData.montant : 0,
    societe: stateData.societe || "--",
    typePermis: stateData.typePermis || "--",
  }));

  const mergeData = (next: Partial<PaymentData>) => {
    setPaymentData((prev) => {
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
    if (trimmed === "--" || trimmed === "?" || trimmed === "?") return true;
    return /^n\/?a$/i.test(trimmed);
  };

  useEffect(() => {
    mergeData({
      codedemande: stateData.codedemande,
      montant: typeof stateData.montant === "number" ? stateData.montant : undefined,
      societe: stateData.societe,
      typePermis: stateData.typePermis,
    });
  }, [stateData.codedemande, stateData.montant, stateData.societe, stateData.typePermis]);

  useEffect(() => {
    if (!numericIdProc || !apiURL) return;
    let active = true;
    setIsDataLoading(true);
    axios
      .get(`${apiURL}/api/procedures/${numericIdProc}/demande`, { withCredentials: true })
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
        console.warn("[PaiementAdahabia] demande fetch failed", error);
      })
      .finally(() => {
        if (active) setIsDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [numericIdProc, apiURL]);

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
        console.warn("[PaiementAdahabia] summary fetch failed", error);
      });
    return () => {
      active = false;
    };
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
        console.warn("[PaiementAdahabia] facture fetch failed", error);
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
        if (societe && (isPlaceholder(paymentData.societe) || societe.trim() !== paymentData.societe.trim())) {
          mergeData({ societe });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [apiURL, paymentData.societe]);

  const formattedMontant = useMemo(() => {
    if (typeof paymentData.montant === "number" && Number.isFinite(paymentData.montant)) {
      return paymentData.montant.toLocaleString("fr-DZ");
    }
    return "0";
  }, [paymentData.montant]);

  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Formater le numéro de carte (ajouter des espaces tous les 4 chiffres)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, "$1 ");
    return formatted.substring(0, 19); // Max 16 chiffres + 3 espaces
  };

  // Formater la date d'expiration (MM/AA)
  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length <= 2) return cleaned;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  };

  // Validation du formulaire
  const isFormValid = () => {
    const cardDigits = cardNumber.replace(/\s/g, "");
    const expiryParts = expiryDate.split("/");
    
    return (
      cardDigits.length === 16 &&
      expiryParts.length === 2 &&
      expiryParts[0].length === 2 &&
      expiryParts[1].length === 2 &&
      cvv.length >= 3
    );
  };

  // Traitement du paiement
  const handlePayment = async () => {
    if (!isFormValid()) {
      setError("Veuillez remplir tous les champs correctement.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      // Simulation d'appel API Adahabia
      // Dans une vraie implémentation, utiliser:
      // const response = await axios.post('/api/paiement/adahabia', { ... });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulation délai

      // Simuler une réponse réussie
      const transactionId = `TXN-${Date.now()}`;
      
      // Rediriger vers la page de confirmation
      const permisQuery = permisParam ? `&permisId=${permisParam}` : "";
      const confirmationUrl = idProc
        ? `/operateur/renouvellement/step5/confirmationpay?id=${idProc}${permisQuery}`
        : "/operateur/renouvellement/step5/confirmationpay";
      navigate(confirmationUrl, {
        state: {
          ...paymentData,
          idProc,
          transactionId,
          datePaiement: new Date().toISOString(),
          dernierChiffres: cardNumber.replace(/\s/g, "").slice(-4),
          paymentMethod: "Carte Adahabia"
        }
      });

    } catch (err) {
      setError("Une erreur est survenue lors du traitement du paiement. Veuillez réessayer.");
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={20} />
            Retour
          </button>
          <h1 className={styles.title}>Paiement par Carte Adahabia</h1>
          <p className={styles.subtitle}>
            Effectuez votre paiement en toute sécurité
          </p>
        </div>

        <div className={styles.content}>
          {/* Résumé de la commande */}
          <div className={styles.summaryCard}>
            <h2 className={styles.sectionTitle}>Résumé de la demande</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Code Demande</span>
                <span className={styles.summaryValue}>{paymentData.codedemande}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Type de Permis</span>
                <span className={styles.summaryValue}>{paymentData.typePermis}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Titulaire</span>
                <span className={styles.summaryValue}>{paymentData.societe}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Montant à payer</span>
                <span className={styles.summaryAmount}>
                  {formattedMontant} DA
                </span>
              </div>
            </div>
          </div>

          {/* Formulaire de paiement */}
          <div className={styles.paymentCard}>
            <div className={styles.cardHeader}>
              <CreditCard className={styles.cardIcon} size={24} />
              <h2 className={styles.sectionTitle}>Informations de la carte</h2>
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handlePayment(); }}>
              {/* Numéro de carte */}
              <div className={styles.inputGroup}>
                <label htmlFor="cardNumber" className={styles.label}>
                  Numéro de carte
                </label>
                <div className={styles.inputWrapper}>
                  <CreditCard className={styles.inputIcon} size={18} />
                  <input
                    id="cardNumber"
                    type="text"
                    className={styles.input}
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Ligne date + CVV */}
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label htmlFor="expiry" className={styles.label}>
                    Date d'expiration
                  </label>
                  <input
                    id="expiry"
                    type="text"
                    className={styles.input}
                    placeholder="MM/AA"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                    maxLength={5}
                    disabled={isProcessing}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="cvv" className={styles.label}>
                    CVV
                  </label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={18} />
                    <input
                      id="cvv"
                      type="password"
                      className={styles.input}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").substring(0, 4))}
                      maxLength={4}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>

              {/* Bouton de paiement */}
              <button
                type="submit"
                className={styles.payButton}
                disabled={!isFormValid() || isProcessing || isDataLoading}
              >
                {isProcessing ? (
                  <>
                    <div className={styles.spinner}></div>
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    Confirmer le paiement de {formattedMontant} DA
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer sécurité */}
          <div className={styles.securityFooter}>
            <Shield className={styles.securityIcon} size={20} />
            <div className={styles.securityText}>
              <strong>Paiement 100% sécurisé</strong>
              <span>Vos données sont protégées par un cryptage SSL 256 bits</span>
            </div>
            <div className={styles.badges}>
              <span className={styles.badge}>
                <CheckCircle size={14} />
                Adahabia
              </span>
              <span className={styles.badge}>
                <Lock size={14} />
                SSL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaiementAdahabia;
